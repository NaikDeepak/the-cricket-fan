"""Two-phase local seed for content_bank. NOT wired into any GitHub Actions
workflow -- records/anecdotes change rarely, so this is a manual one-off.

Phase 1  python -m bot.scripts.seed_content_bank --draft draft.json
  Fetches Wikipedia records tables (MediaWiki API), writes wiki_record
  candidates plus empty-segment anecdote/story skeletons to a review file.
  Anecdote/story text is then hand-authored INTO that file (facts-only, own
  phrasing) and the owner reviews every wiki_record sentence.

Phase 2  python -m bot.scripts.seed_content_bank --commit draft.json
  Inserts the reviewed entries, skipping any content_key already present and
  any entry whose segments are still empty (unauthored skeleton).
"""

import argparse
import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
import sqlalchemy as sa

from bot.db import content_bank, ensure_schema, get_engine

WIKI_API = "https://en.wikipedia.org/w/api.php"
RECORD_PAGES = {  # fmt tag -> Wikipedia page title
    "test": "List_of_Test_cricket_records",
    "odi": "List_of_One_Day_International_cricket_records",
    "t20i": "List_of_Twenty20_International_cricket_records",
}
# Anecdote/story source pages seeded as empty skeletons for hand-authoring.
ANECDOTE_PAGES = ["Bodyline", "Jim_Laker", "Kolkata_Test_2001"]  # single tweet
STORY_PAGES = ["2005_Ashes_series"]  # multi-tweet thread (2-4 segments)

# format -> (min_segments, max_segments); mirrors content_bank's documented shape
CONTENT_FORMATS = {"single": (1, 1), "thread": (2, 4)}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fetch_page_html(title: str) -> str:
    resp = requests.get(
        WIKI_API,
        params={
            "action": "parse",
            "page": title,
            "prop": "text",
            "format": "json",
            "redirects": 1,
        },
        headers={"User-Agent": "the-cricket-fan-bot/1.0 (seed)"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["parse"]["text"]["*"]


def extract_wiki_records(html: str, fmt: str, source: str) -> list[dict]:
    """First wikitable -> one wiki_record per row. Columns 0/1 are label/value;
    the bot writes its own sentence (facts-only, no verbatim prose)."""
    # pandas >=2.1 deprecates (and pandas 3.0 removes) passing a literal HTML
    # string directly -- it's parsed as a file path/URL otherwise. Wrap in
    # StringIO so read_html treats it as in-memory HTML.
    tables = pd.read_html(io.StringIO(html), flavor="lxml")
    if not tables:
        return []
    table = tables[0]
    entries = []
    for _, row in table.iterrows():
        cells = [str(c).strip() for c in row.tolist()]
        if len(cells) < 2:
            continue
        label, value = cells[0], cells[1]
        text = f"🏏 {value} — {label} ({fmt.upper()}). #Cricket"
        if len(text) > 280:
            continue
        entries.append(
            {
                "category": "wiki_record",
                "format": "single",
                "content_key": f"wiki_record:{fmt}:{_slug(label)}",
                "source": source,
                "segments": [text],
            }
        )
    return entries


def anecdote_skeletons() -> list[dict]:
    skeletons = [
        {
            "category": "anecdote",
            "format": "single",
            "content_key": f"anecdote:{_slug(page)}",
            "source": f"wikipedia:{page}",
            "segments": [],  # hand-author 1 tweet before --commit
        }
        for page in ANECDOTE_PAGES
    ]
    skeletons += [
        {
            "category": "story",
            "format": "thread",
            "content_key": f"story:{_slug(page)}",
            "source": f"wikipedia:{page}",
            "segments": [],  # hand-author 2-4 tweets before --commit
        }
        for page in STORY_PAGES
    ]
    return skeletons


def write_draft(records_html: dict[str, str], path: Path) -> None:
    entries: list[dict] = []
    for fmt, html in records_html.items():
        entries.extend(
            extract_wiki_records(html, fmt, f"wikipedia:{RECORD_PAGES[fmt]}")
        )
    entries.extend(anecdote_skeletons())
    path.write_text(json.dumps({"entries": entries}, indent=2))


def commit_reviewed(conn, path: Path, now: datetime) -> int:
    review = json.loads(Path(path).read_text())
    existing = set(conn.execute(sa.select(content_bank.c.content_key)).scalars().all())
    inserted = 0
    for e in review["entries"]:
        if not e["segments"]:  # unauthored skeleton
            continue
        if e["content_key"] in existing:
            continue
        if any(len(seg) > 280 for seg in e["segments"]):  # over the post limit
            continue
        bounds = CONTENT_FORMATS.get(e["format"])  # unknown format / bad cardinality
        if bounds is None or not bounds[0] <= len(e["segments"]) <= bounds[1]:
            continue
        conn.execute(
            content_bank.insert().values(
                category=e["category"],
                format=e["format"],
                segments_json=json.dumps(e["segments"]),
                content_key=e["content_key"],
                source=e["source"],
                created_at=now,
            )
        )
        existing.add(e["content_key"])
        inserted += 1
    return inserted


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--draft", metavar="OUTFILE")
    group.add_argument("--commit", metavar="REVIEWED_FILE")
    parser.add_argument("--database-url", default=None, help="only needed for --commit")
    args = parser.parse_args(argv)

    if args.draft:
        records_html = {
            fmt: fetch_page_html(title) for fmt, title in RECORD_PAGES.items()
        }
        write_draft(records_html, Path(args.draft))
        print(
            f"Wrote draft to {args.draft} -- author anecdote/story text, then --commit"
        )
        return

    import os

    url = args.database_url or os.environ["BOT_DATABASE_URL"]
    engine = get_engine(url)
    now = datetime.now(timezone.utc)
    with engine.connect() as conn:
        ensure_schema(conn)
        conn.commit()
        n = commit_reviewed(conn, Path(args.commit), now)
        conn.commit()
    print(f"Inserted {n} content_bank rows from {args.commit}")


if __name__ == "__main__":
    main(sys.argv[1:])
