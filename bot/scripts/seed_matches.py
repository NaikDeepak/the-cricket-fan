"""Seed local database with historical Cricsheet matches.

Usage:
  bot/.venv/bin/python -m bot.scripts.seed_matches
"""

import json
import os
from pathlib import Path

from bot.ingest import main as ingest_main


def main():
    repo_root = Path(__file__).resolve().parent.parent.parent
    cricsheet_dir = repo_root / "backend" / "data" / "cricsheet"
    league_map = repo_root / "bot" / "league_map.json"
    db_url = (
        os.environ.get("COMPOSER_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "sqlite:///composer.db"
    )

    if not league_map.exists():
        league_map.write_text(json.dumps({"*": "IPL"}, indent=2))

    import sys

    sys.argv = [
        "seed_matches",
        "--cricsheet-dir",
        str(cricsheet_dir),
        "--league-map",
        str(league_map),
        "--database-url",
        db_url,
    ]
    ingest_main()


if __name__ == "__main__":
    main()
