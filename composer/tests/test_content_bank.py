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
