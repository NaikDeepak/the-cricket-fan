from datetime import datetime, timedelta, timezone

from bot.db import content_bank
from bot.scripts.check_stale_content import find_stale


def _insert(conn, key: str, category: str, created_at: datetime) -> None:
    conn.execute(
        content_bank.insert().values(
            category=category,
            format="single",
            segments_json='["x"]',
            content_key=key,
            source="curated:test",
            created_at=created_at,
        )
    )
    conn.commit()


def test_find_stale_only_returns_old_wiki_records(engine):
    now = datetime.now(timezone.utc)
    with engine.connect() as conn:
        _insert(conn, "wiki_record:old", "wiki_record", now - timedelta(days=200))
        _insert(conn, "wiki_record:new", "wiki_record", now - timedelta(days=5))
        _insert(conn, "anecdote:old", "anecdote", now - timedelta(days=200))
        rows = find_stale(conn, now - timedelta(days=180))
    assert [r.content_key for r in rows] == ["wiki_record:old"]


def test_find_stale_empty_when_nothing_old_enough(engine):
    now = datetime.now(timezone.utc)
    with engine.connect() as conn:
        _insert(conn, "wiki_record:new", "wiki_record", now - timedelta(days=5))
        rows = find_stale(conn, now - timedelta(days=180))
    assert rows == []
