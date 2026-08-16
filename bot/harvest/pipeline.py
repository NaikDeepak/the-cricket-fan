"""Master Story Harvesting & Deduplication Pipeline.

Orchestrates multi-source story harvesting from Wikipedia, Reddit r/Cricket,
Quora anecdotes, Cricsheet thrillers, and Gemini discovery, filtering out
duplicates and populating the content_bank table in SQLite/Postgres.
"""

import argparse
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa

from bot.db import content_bank, ensure_schema, get_engine
from bot.dedup import check_duplicate, enrich_story, generate_canonical_key
from bot.harvest.cricsheet import harvest_cricsheet_anomalies
from bot.harvest.llm_harvester import harvest_llm_obscure_stories
from bot.harvest.quora_memoirs import harvest_quora_memoirs
from bot.harvest.reddit import harvest_reddit_lore
from bot.harvest.wikipedia import harvest_wikipedia_stories

logger = logging.getLogger(__name__)


def harvest_all_sources(sources: list[str] | None = None) -> list[dict[str, Any]]:
    """Gather candidate stories across all requested sources."""
    if sources is None:
        sources = ["wikipedia", "reddit", "quora", "cricsheet", "llm"]

    candidates: list[dict[str, Any]] = []

    if "wikipedia" in sources:
        candidates.extend(harvest_wikipedia_stories())
    if "reddit" in sources:
        candidates.extend(harvest_reddit_lore())
    if "quora" in sources:
        candidates.extend(harvest_quora_memoirs())
    if "cricsheet" in sources:
        candidates.extend(harvest_cricsheet_anomalies())
    if "llm" in sources:
        candidates.extend(harvest_llm_obscure_stories())

    return candidates


def load_existing_db_stories(conn: sa.Connection) -> list[dict[str, Any]]:
    """Fetch existing stories from content_bank table as dicts."""
    rows = conn.execute(sa.select(content_bank)).mappings().all()
    entries = []
    for r in rows:
        entries.append(
            {
                "id": r["id"],
                "content_key": r["content_key"],
                "category": r["category"],
                "format": r["format"],
                "segments": json.loads(r["segments_json"]) if r["segments_json"] else [],
                "source": r["source"],
                "title": r["title"] or "",
                "summary": r["summary"] or "",
                "source_type": r["source_type"] or "wikipedia",
                "source_ref": r["source_ref"] or "",
                "teams": json.loads(r["teams_json"]) if r["teams_json"] else [],
                "players": json.loads(r["players_json"]) if r["players_json"] else [],
                "venue": r["venue"],
                "year": r["year"],
                "match_format": r["match_format"],
                "tags": json.loads(r["tags_json"]) if r["tags_json"] else [],
                "event_month_day": r["event_month_day"],
                "is_published": r["is_published"],
            }
        )
    return entries


def run_pipeline(
    conn: sa.Connection,
    sources: list[str] | None = None,
    commit: bool = True,
    similarity_threshold: float = 0.68,
) -> dict[str, Any]:
    """Execute harvesting, deduplication against existing database, and optional ingestion."""
    now = datetime.now(timezone.utc)
    candidates = harvest_all_sources(sources)
    existing_entries = load_existing_db_stories(conn)

    inserted_count = 0
    skipped_count = 0
    enriched_count = 0
    novel_candidates: list[dict[str, Any]] = []
    duplicate_reports: list[dict[str, Any]] = []

    # Maintain an in-memory tracking list of existing items so candidates don't duplicate each other
    active_pool = list(existing_entries)

    for c in candidates:
        # Ensure canonical key
        if not c.get("content_key"):
            c["content_key"] = generate_canonical_key(c)

        is_dup, match, score, reason = check_duplicate(
            c, active_pool, similarity_threshold=similarity_threshold
        )

        if is_dup:
            skipped_count += 1
            duplicate_reports.append(
                {
                    "candidate_key": c["content_key"],
                    "candidate_title": c.get("title", ""),
                    "matched_key": match.get("content_key", "") if match else None,
                    "score": round(score, 2),
                    "reason": reason,
                }
            )
            # Try enrichment if match exists
            if match and commit:
                enriched = enrich_story(match, c)
                conn.execute(
                    content_bank.update()
                    .where(content_bank.c.content_key == match["content_key"])
                    .values(
                        teams_json=json.dumps(enriched.get("teams", [])),
                        players_json=json.dumps(enriched.get("players", [])),
                        tags_json=json.dumps(enriched.get("tags", [])),
                        event_month_day=enriched.get("event_month_day"),
                        venue=enriched.get("venue"),
                        year=enriched.get("year"),
                    )
                )
                enriched_count += 1
        else:
            novel_candidates.append(c)
            active_pool.append(c)

            if commit:
                conn.execute(
                    content_bank.insert().values(
                        category=c.get("category", "story"),
                        format=c.get("format", "single" if len(c.get("segments", [])) <= 1 else "thread"),
                        segments_json=json.dumps(c.get("segments", [])),
                        content_key=c["content_key"],
                        source=c.get("source", c.get("source_ref", "manual")),
                        source_type=c.get("source_type", "manual"),
                        source_ref=c.get("source_ref", c.get("source", "")),
                        title=c.get("title"),
                        summary=c.get("summary"),
                        teams_json=json.dumps(c.get("teams", [])),
                        players_json=json.dumps(c.get("players", [])),
                        venue=c.get("venue"),
                        year=c.get("year"),
                        match_format=c.get("match_format"),
                        tags_json=json.dumps(c.get("tags", [])),
                        event_month_day=c.get("event_month_day"),
                        is_published=c.get("is_published", True),
                        created_at=now,
                    )
                )
                inserted_count += 1

    return {
        "harvested_total": len(candidates),
        "inserted": inserted_count,
        "skipped_duplicates": skipped_count,
        "enriched": enriched_count,
        "novel_candidates": novel_candidates,
        "duplicate_reports": duplicate_reports,
    }


def main():
    parser = argparse.ArgumentParser(description="Cricket Story Harvesting & Deduplication Pipeline")
    parser.add_argument("--database-url", default=None, help="Database connection URL")
    parser.add_argument("--sources", nargs="+", default=["wikipedia", "reddit", "quora", "cricsheet"], help="Sources to harvest")
    parser.add_argument("--no-commit", action="store_true", help="Dry run without writing to DB")
    parser.add_argument("--threshold", type=float, default=0.68, help="Deduplication similarity threshold")
    args = parser.parse_args()

    url = args.database_url or os.environ.get("COMPOSER_DATABASE_URL") or os.environ.get("BOT_DATABASE_URL") or "sqlite:///composer.db"
    engine = get_engine(url)

    with engine.begin() as conn:
        ensure_schema(conn)
        result = run_pipeline(
            conn,
            sources=args.sources,
            commit=not args.no_commit,
            similarity_threshold=args.threshold,
        )

    print("\n=== Story Harvesting Pipeline Complete ===")
    print(f"Total Harvested Candidates: {result['harvested_total']}")
    print(f"Newly Inserted Stories:    {result['inserted']}")
    print(f"Duplicates Skipped:        {result['skipped_duplicates']}")
    print(f"Existing Stories Enriched: {result['enriched']}")


if __name__ == "__main__":
    main()
