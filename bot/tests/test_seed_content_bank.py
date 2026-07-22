import json
from datetime import datetime, timezone
from pathlib import Path

import sqlalchemy as sa

from bot.db import content_bank
from bot.scripts.seed_content_bank import (
    commit_reviewed,
    extract_wiki_records,
)

DATA = Path(__file__).parent / "data" / "wiki_records_sample.html"


def test_extract_wiki_records_templates_own_sentence():
    html = DATA.read_text()
    entries = extract_wiki_records(
        html, fmt="test", source="wikipedia:List_of_Test_cricket_records"
    )
    keys = {e["content_key"] for e in entries}
    assert "wiki_record:test:most-wickets" in keys
    murali = next(
        e for e in entries if e["content_key"] == "wiki_record:test:most-wickets"
    )
    assert murali["category"] == "wiki_record"
    assert murali["format"] == "single"
    assert len(murali["segments"]) == 1
    assert "800" in murali["segments"][0]
    assert len(murali["segments"][0]) <= 280


def test_commit_reviewed_inserts_and_skips_existing(engine, tmp_path):
    review = {
        "entries": [
            {
                "category": "wiki_record",
                "format": "single",
                "content_key": "wiki_record:test:most-wickets",
                "source": "wikipedia:List_of_Test_cricket_records",
                "segments": ["800 Test wickets. #Cricket"],
            },
            {
                "category": "story",
                "format": "thread",
                "content_key": "story:bodyline",
                "source": "wikipedia:Bodyline",
                "segments": ["Bodyline 1", "Bodyline 2"],
            },
        ]
    }
    f = tmp_path / "reviewed.json"
    f.write_text(json.dumps(review))
    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    with engine.begin() as conn:
        n1 = commit_reviewed(conn, f, now)
        n2 = commit_reviewed(conn, f, now)  # re-run is additive, not destructive
        rows = conn.execute(sa.select(content_bank.c.content_key)).scalars().all()
    assert n1 == 2
    assert n2 == 0  # both content_keys already exist
    assert sorted(rows) == ["story:bodyline", "wiki_record:test:most-wickets"]


def test_commit_skips_unauthored_skeletons(engine, tmp_path):
    review = {
        "entries": [
            {
                "category": "anecdote",
                "format": "single",
                "content_key": "anecdote:bodyline",
                "source": "wikipedia:Bodyline",
                "segments": [],  # not yet authored
            }
        ]
    }
    f = tmp_path / "reviewed.json"
    f.write_text(json.dumps(review))
    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    with engine.begin() as conn:
        n = commit_reviewed(conn, f, now)
        count = conn.execute(
            sa.select(sa.func.count()).select_from(content_bank)
        ).scalar_one()
    assert n == 0  # empty-segments skeletons are never inserted
    assert count == 0
