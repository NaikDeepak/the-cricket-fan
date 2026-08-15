from datetime import datetime, timedelta, timezone

from bot.db import content_bank, drafts


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


def _draft_from_bank(conn, content_key: str, created_at: datetime) -> None:
    conn.execute(
        drafts.insert().values(
            source="bank",
            category="anecdote",
            text="x",
            status="draft",
            created_at=created_at,
            content_key=content_key,
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


def test_never_used_item_has_null_last_used_days_and_sorts_first(client, conn):
    _seed(conn)
    now = datetime.now(timezone.utc)
    _draft_from_bank(conn, "anecdote:bodyline", now - timedelta(days=1))
    rows = client.get("/content-bank").json()
    by_key = {r["content_key"]: r for r in rows}
    assert by_key["wiki_record:test:most-wickets"]["last_used_days"] is None
    assert by_key["anecdote:bodyline"]["last_used_days"] == 1
    assert rows[0]["content_key"] == "wiki_record:test:most-wickets"


def test_longest_unused_sorts_before_recently_used(client, conn):
    _seed(conn)
    now = datetime.now(timezone.utc)
    _draft_from_bank(conn, "anecdote:bodyline", now - timedelta(days=2))
    _draft_from_bank(conn, "wiki_record:test:most-wickets", now - timedelta(days=40))
    rows = client.get("/content-bank").json()
    assert [r["content_key"] for r in rows] == [
        "wiki_record:test:most-wickets",
        "anecdote:bodyline",
    ]


def test_last_used_days_reflects_most_recent_draft_not_first(client, conn):
    _seed(conn)
    now = datetime.now(timezone.utc)
    _draft_from_bank(conn, "anecdote:bodyline", now - timedelta(days=30))
    _draft_from_bank(conn, "anecdote:bodyline", now - timedelta(days=3))
    rows = client.get("/content-bank").json()
    by_key = {r["content_key"]: r for r in rows}
    assert by_key["anecdote:bodyline"]["last_used_days"] == 3


def test_freeform_draft_does_not_affect_bank_item_usage(client, conn):
    _seed(conn)
    client.post("/drafts", json={"source": "freeform", "text": "unrelated"})
    rows = client.get("/content-bank").json()
    assert all(r["last_used_days"] is None for r in rows)


def test_on_this_day_item_sorts_ahead_of_evergreen_sort(client, conn):
    """An on-this-day match must outrank even a never-used item -- proving
    the date match is checked ahead of, not folded into, the evergreen sort."""
    today_md = datetime.now(timezone.utc).strftime("%m-%d")
    conn.execute(
        content_bank.insert().values(
            category="anecdote",
            format="single",
            segments_json='["On this day in history."]',
            content_key="anecdote:on-this-day",
            source="wikipedia:Test",
            created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
            event_month_day=today_md,
        )
    )
    conn.execute(
        content_bank.insert().values(
            category="anecdote",
            format="single",
            segments_json='["Never used, no date."]',
            content_key="anecdote:never-used",
            source="wikipedia:Test",
            created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
        )
    )
    conn.commit()
    rows = client.get("/content-bank").json()
    assert rows[0]["content_key"] == "anecdote:on-this-day"
    assert rows[0]["on_this_day"] is True
    by_key = {r["content_key"]: r for r in rows}
    assert by_key["anecdote:never-used"]["on_this_day"] is False


def test_non_matching_event_month_day_does_not_get_on_this_day_boost(client, conn):
    off_day = (
        "01-01" if datetime.now(timezone.utc).strftime("%m-%d") != "01-01" else "02-02"
    )
    conn.execute(
        content_bank.insert().values(
            category="anecdote",
            format="single",
            segments_json='["Some other anniversary."]',
            content_key="anecdote:other-day",
            source="wikipedia:Test",
            created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
            event_month_day=off_day,
        )
    )
    conn.commit()
    rows = client.get("/content-bank").json()
    by_key = {r["content_key"]: r for r in rows}
    assert by_key["anecdote:other-day"]["on_this_day"] is False
