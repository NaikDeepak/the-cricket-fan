from datetime import datetime, timezone

from bot.db import content_bank


def _seed(conn):
    conn.execute(
        content_bank.insert().values(
            category="anecdote",
            format="single",
            segments_json='["Bodyline changed cricket."]',
            content_key="anecdote:bodyline",
            source="wikipedia:Bodyline",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )
    conn.execute(
        content_bank.insert().values(
            category="wiki_record",
            format="single",
            segments_json='["800 Test wickets."]',
            content_key="wiki_record:test:most-wickets",
            source="wikipedia:List_of_Test_cricket_records",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )
    conn.commit()


def test_content_bank_lists_and_parses_segments(client, conn):
    _seed(conn)
    rows = client.get("/content-bank").json()
    keys = {r["content_key"] for r in rows}
    assert keys == {"anecdote:bodyline", "wiki_record:test:most-wickets"}
    bodyline = next(r for r in rows if r["content_key"] == "anecdote:bodyline")
    assert bodyline["segments"] == ["Bodyline changed cricket."]


def test_content_bank_filters_by_category(client, conn):
    _seed(conn)
    rows = client.get("/content-bank", params={"category": "anecdote"}).json()
    assert [r["content_key"] for r in rows] == ["anecdote:bodyline"]


def test_content_bank_marks_used_and_sorts_unused_first(client, conn):
    _seed(conn)
    client.post(
        "/drafts",
        json={
            "source": "bank",
            "category": "anecdote",
            "text": "Bodyline changed cricket.",
            "content_key": "anecdote:bodyline",
        },
    )
    rows = client.get("/content-bank").json()
    by_key = {r["content_key"]: r for r in rows}
    assert by_key["anecdote:bodyline"]["used"] is True
    assert by_key["wiki_record:test:most-wickets"]["used"] is False
    # unused surfaces first regardless of insertion order
    assert rows[0]["content_key"] == "wiki_record:test:most-wickets"


def test_freeform_draft_does_not_mark_bank_item_used(client, conn):
    _seed(conn)
    client.post("/drafts", json={"source": "freeform", "text": "unrelated"})
    rows = client.get("/content-bank").json()
    assert all(r["used"] is False for r in rows)
