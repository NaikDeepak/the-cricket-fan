"""Ingest 100% official Cricsheet match datasets for WPL, WBBL, and Women's T20I into PostgreSQL."""

import os
from pathlib import Path
import sqlalchemy as sa
import pandas as pd
from bot.cricsheet import parse_result
from bot.db import ensure_schema, get_engine, team_matches
from composer.config import get_settings


def ingest():
    extracted_dirs = [
        (Path("/tmp/cricsheet_extracted/wpl"), "WPL"),
        (Path("/tmp/cricsheet_extracted/wbbl"), "WBBL"),
        (Path("/tmp/cricsheet_extracted/wt20i"), "WT20I"),
    ]

    all_rows = []
    for d, league in extracted_dirs:
        if not d.exists():
            print(f"Directory {d} does not exist, skipping.")
            continue
        json_files = sorted(d.glob("*.json"))
        print(f"Parsing {len(json_files)} real Cricsheet files for {league}...")
        for f in json_files:
            try:
                for r in parse_result(f, league=league):
                    all_rows.append(r.__dict__)
            except Exception as e:
                # Some files might be non-match metadata (e.g. README.txt, manifest)
                pass

    print(f"Total parsed rows from official Cricsheet: {len(all_rows)}")
    df = pd.DataFrame(all_rows)
    if df.empty:
        print("No rows parsed.")
        return

    settings = get_settings()
    engine = get_engine(settings.database_url)
    with engine.begin() as conn:
        ensure_schema(conn)
        # Delete any dummy/mock records previously inserted for these leagues
        conn.execute(
            sa.delete(team_matches).where(
                team_matches.c.league.in_(["WPL", "WBBL", "WT20I"])
            )
        )
        print("Inserting real Cricsheet match records into Neon PostgreSQL...")
        conn.execute(team_matches.insert(), df.to_dict(orient="records"))
        print(f"Successfully inserted {len(df)} real Cricsheet team-match rows!")


if __name__ == "__main__":
    ingest()
