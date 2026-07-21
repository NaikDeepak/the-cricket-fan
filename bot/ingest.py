"""Refresh the Neon feature store: create tables, seed aliases, reload team_matches.

Raw Cricsheet JSON stays local to the runner — only aggregates enter Postgres
(Neon 500MB free-tier budget).
"""

import argparse
import json
from pathlib import Path

import sqlalchemy as sa

from .aliases import seed_aliases
from .db import get_engine, metadata, team_matches
from .train import build_team_matches


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cricsheet-dir", type=Path, required=True)
    ap.add_argument("--league-map", type=Path, required=True)
    ap.add_argument("--database-url", required=True)
    args = ap.parse_args()

    df = build_team_matches(args.cricsheet_dir, json.loads(args.league_map.read_text()))
    engine = get_engine(args.database_url)
    with engine.begin() as conn:
        # Schema change: team_matches is a fully rebuildable cache (deleted + reinserted
        # below on every run), so dropping and recreating it inside this single
        # transaction is safe and picks up new columns that create_all() alone would
        # not add to an already-existing table -- and keeps the table never missing
        # or empty to any concurrent reader (e.g. the live prediction cron tick),
        # since nothing commits until this whole block finishes.
        team_matches.drop(conn, checkfirst=True)
        metadata.create_all(conn)
        seed_aliases(conn)
        conn.execute(sa.delete(team_matches))
        if not df.empty:
            conn.execute(team_matches.insert(), df.to_dict(orient="records"))
    print(f"loaded {len(df)} team-match rows")


if __name__ == "__main__":
    main()
