"""Lists content_bank entries old enough to warrant a manual fact re-check.

Records get broken (ODI/T20I especially). This doesn't verify anything
automatically -- it just tells the owner what to look at. Run periodically:

  python -m bot.scripts.check_stale_content            # 180-day default
  python -m bot.scripts.check_stale_content --days 90
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from bot.db import content_bank, get_engine


def find_stale(conn, cutoff: datetime) -> list:
    q = (
        sa.select(content_bank)
        .where(content_bank.c.category == "wiki_record")
        .where(content_bank.c.created_at < cutoff)
        .order_by(content_bank.c.created_at.asc())
    )
    return conn.execute(q).all()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args(argv)

    url = args.database_url or os.environ["BOT_DATABASE_URL"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    engine = get_engine(url)
    with engine.connect() as conn:
        rows = find_stale(conn, cutoff)

    if not rows:
        print(f"No wiki_record entries older than {args.days} days.")
        return

    print(
        f"{len(rows)} wiki_record entries older than {args.days} days -- re-verify these facts still hold:\n"
    )
    for r in rows:
        age_days = (datetime.now(timezone.utc) - r.created_at).days
        print(f"  [{age_days}d] {r.content_key}  ({r.source})")


if __name__ == "__main__":
    main(sys.argv[1:])
