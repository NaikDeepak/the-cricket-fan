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
import ssl
import urllib.request
import zipfile

import pandas as pd
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.cricsheet import parse_match_dict
from bot.db import ensure_schema, get_engine, team_matches

LEAGUES = [
    ("ipl", "IPL"),
    ("bbl", "BBL"),
    ("psl", "PSL"),
    ("cpl", "CPL"),
    ("sat", "SA20"),
    ("hnd", "The Hundred"),
    ("t20s", "T20I"),
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

    with engine.begin() as conn:
        team_matches.drop(conn, checkfirst=True)
        ensure_schema(conn)
        seed_aliases(conn)
        conn.execute(sa.delete(team_matches))
        conn.execute(team_matches.insert(), df.to_dict(orient="records"))

    print(f"✓ Ingestion complete! {len(df)} rows loaded successfully into database.")


def main() -> None:
    db_url = (
        os.environ.get("COMPOSER_DATABASE_URL")
        or os.environ.get("BOT_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "sqlite:///composer.db"
    )
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    ingest_all(db_url)


if __name__ == "__main__":
    main()
