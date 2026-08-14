from datetime import datetime, timezone

from bot.db import fixtures, posts


def _mk_fixture(conn, fid=1):
    conn.execute(
        fixtures.insert().values(
            id=fid,
            provider_match_id=f"m{fid}",
            team_a="Chennai Super Kings",
            team_b="Mumbai Indians",
            venue="Wankhede Stadium",
            league="IPL",
            start_time=datetime(2026, 7, 25, tzinfo=timezone.utc),
            status="upcoming",
        )
    )


def test_lists_posted_post_with_fixture_teams(client, conn):
    _mk_fixture(conn)
    conn.execute(
        posts.insert().values(
            fixture_id=1,
            post_type="prediction",
            state="posted",
            text="CSK favoured at 62%",
            tweet_count=1,
            posted_at=datetime(2026, 7, 24, tzinfo=timezone.utc),
        )
    )
    conn.commit()
    rows = client.get("/posts").json()
    assert len(rows) == 1
    assert rows[0]["team_a"] == "Chennai Super Kings"
    assert rows[0]["state"] == "posted"


def test_standalone_post_has_no_fixture_teams(client, conn):
    conn.execute(
        posts.insert().values(
            fixture_id=None,
            post_type="standalone_trivia",
            state="posted",
            text="Rwanda vs Zambia: Rwanda lead 2-1",
            tweet_count=1,
            posted_at=datetime(2026, 7, 24, tzinfo=timezone.utc),
        )
    )
    conn.commit()
    rows = client.get("/posts").json()
    assert len(rows) == 1
    assert rows[0]["fixture_id"] is None
    assert rows[0]["team_a"] is None


def test_filters_by_state(client, conn):
    conn.execute(
        posts.insert().values(
            fixture_id=None,
            post_type="standalone_trivia",
            state="failed",
            text="a",
            tweet_count=1,
            posted_at=None,
        )
    )
    conn.execute(
        posts.insert().values(
            fixture_id=None,
            post_type="standalone_trivia",
            state="posted",
            text="b",
            tweet_count=1,
            posted_at=datetime(2026, 7, 24, tzinfo=timezone.utc),
        )
    )
    conn.commit()
    rows = client.get("/posts", params={"state": "failed"}).json()
    assert len(rows) == 1
    assert rows[0]["text"] == "a"


def test_empty_when_no_posts(client, conn):
    assert client.get("/posts").json() == []
