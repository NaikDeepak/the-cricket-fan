"""Download and ingest major T20 leagues directly from Cricsheet into database.

Leagues included:
  - IPL (Indian Premier League)
  - BBL (Big Bash League)
  - PSL (Pakistan Super League)
  - CPL (Caribbean Premier League)
  - SA20 (SA20)
  - The Hundred
  - T20I (Men's International T20s)

Usage:
  bot/.venv/bin/python -m bot.scripts.ingest_all_leagues
"""

import io
import json
import os
from pathlib import Path
import ssl
import urllib.request
import zipfile

from dotenv import load_dotenv
import pandas as pd
import sqlalchemy as sa

_repo_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_repo_root / ".env.local")
load_dotenv(_repo_root / ".env")

from bot.aliases import seed_aliases
from bot.cricsheet import parse_match_dict
from bot.db import ensure_schema, get_engine, team_matches

LEAGUES = [
    # Men's Major Leagues
    ("ipl", "IPL"),
    ("hnd_male", "The Hundred"),
    ("bbl_male", "BBL"),
    ("psl", "PSL"),
    ("cpl_male", "CPL"),
    ("sat", "SA20"),
    ("mlc", "MLC"),
    ("ilt", "ILT20"),
    ("lpl", "LPL"),
    ("bpl", "BPL"),
    ("ntb", "T20 Blast"),
    ("ssm_male", "Super Smash"),
    ("msl", "MSL"),
    ("npl", "NPL"),
    ("ctc", "CSA T20"),
    ("sma", "SMAT"),
    # Women's Major Leagues
    ("hnd_female", "The Hundred Women"),
    ("wpl", "WPL"),
    ("wbb", "WBBL"),
    ("wcl", "WCPL"),
    ("ssm_female", "Super Smash Women"),
    ("cec", "Charlotte Edwards Cup"),
    ("wtb", "Women's T20 Blast"),
    ("wsl", "WSL"),
    ("wtc", "Women's T20 Challenge"),
    ("frb", "FairBreak"),
    # International T20s
    ("t20s_male", "T20I"),
    ("t20s_female", "WT20I"),
]


def _get_ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def ingest_all(database_url: str) -> None:
    engine = get_engine(database_url)
    all_rows: list[dict] = []
    ssl_ctx = _get_ssl_context()

    print("Fetching and parsing T20 leagues from Cricsheet...")
    for code, league_name in LEAGUES:
        url = f"https://cricsheet.org/downloads/{code}_json.zip"
        print(f"  Downloading {league_name} ({url})...")
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "TheCricketFanBot/1.0"}
            )
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=60) as resp:
                zip_data = resp.read()

            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                json_files = [n for n in zf.namelist() if n.endswith(".json")]
                print(f"  Parsing {len(json_files)} {league_name} match JSONs...")
                count = 0
                for name in json_files:
                    try:
                        raw = zf.read(name)
                        data = json.loads(raw.decode("utf-8"))
                        match_rows = parse_match_dict(data, league=league_name)
                        for r in match_rows:
                            all_rows.append(r.__dict__)
                        count += len(match_rows) // 2
                    except Exception:
                        continue
                print(
                    f"  ✓ {league_name}: {count} matches parsed ({count * 2} team rows)"
                )
        except Exception as exc:
            print(f"  ⚠ Failed to download/parse {league_name}: {exc}")

    if not all_rows:
        print("No rows parsed. Ingestion aborted.")
        return

    df = pd.DataFrame(all_rows)
    print(
        f"\nWriting {len(df)} total team-match rows across {len(df['league'].unique())} leagues to DB..."
    )

    # Bug fix: this used to be the full static LEAGUES list, so a league whose
    # download/parse failed (network blip, Cricsheet rate-limit, corrupt zip —
    # anything caught by the try/except above) still had its existing rows
    # DELETEd here with nothing to replace them, silently wiping that league's
    # history. Only delete leagues we actually parsed at least one row for.
    fetched_leagues = sorted({r["league"] for r in all_rows})
    with engine.begin() as conn:
        ensure_schema(conn)
        seed_aliases(conn)
        conn.execute(
            sa.delete(team_matches).where(team_matches.c.league.in_(fetched_leagues))
        )
        conn.execute(team_matches.insert(), df.to_dict(orient="records"))

    print(f"✓ Ingestion complete! {len(df)} rows loaded successfully into {database_url.split('@')[-1] if '@' in database_url else database_url}.")


def main() -> None:
    db_url = (
        os.environ.get("COMPOSER_DATABASE_URL")
        or os.environ.get("BOT_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "sqlite:///composer.db"
    )
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)

    ingest_all(db_url)

    # If remote DB was targeted, also sync local SQLite for offline/dev workflows
    if not db_url.startswith("sqlite:"):
        print("\nAlso syncing to local sqlite:///composer.db for local workflows...")
        try:
            local_engine = get_engine("sqlite:///composer.db")
            with local_engine.begin() as conn:
                ensure_schema(conn)
                seed_aliases(conn)
                remote_engine = get_engine(db_url)
                with remote_engine.connect() as r_conn:
                    rows = r_conn.execute(sa.select(team_matches)).mappings().all()
                    if rows:
                        conn.execute(sa.delete(team_matches))
                        conn.execute(team_matches.insert(), [dict(r) for r in rows])
            print("✓ Local SQLite composer.db synced!")
        except Exception as exc:
            print(f"⚠ Could not sync local SQLite: {exc}")


if __name__ == "__main__":
    main()
