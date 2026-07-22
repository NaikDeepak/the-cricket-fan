from datetime import datetime, timezone

from bot.config import Settings
from bot.db import posts
from bot.poster import (
    RESULTS_ONLY_CUTOFF,
    TRIVIA_CUTOFF,
    Poster,
    allowed,
    month_post_count,
)


def _settings(dry=True):
    return Settings(
        database_url="",
        dry_run=dry,
        force_trivia=False,
        cricket_api_key="",
        cricket_api_base="",
        x_api_key="",
        x_api_secret="",
        x_access_token="",
        x_access_token_secret="",
    )


def test_month_count_only_current_month(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=1,
                post_type="prediction",
                state="posted",
                attempts=1,
                posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                fixture_id=2,
                post_type="prediction",
                state="posted",
                attempts=1,
                posted_at=datetime(2026, 6, 30, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                fixture_id=3,
                post_type="prediction",
                state="failed",
                attempts=1,
                posted_at=None,
            )
        )
        assert month_post_count(conn, now) == 1


def test_circuit_breaker_thresholds():
    assert allowed("trivia", TRIVIA_CUTOFF - 1) is True
    assert allowed("trivia", TRIVIA_CUTOFF) is False
    assert allowed("prediction", TRIVIA_CUTOFF) is True
    assert allowed("prediction", RESULTS_ONLY_CUTOFF) is False
    assert allowed("result", RESULTS_ONLY_CUTOFF) is True


def test_circuit_breaker_treats_standalone_trivia_like_trivia():
    assert allowed("standalone_trivia", TRIVIA_CUTOFF - 1) is True
    assert allowed("standalone_trivia", TRIVIA_CUTOFF) is False
    assert allowed("standalone_trivia", RESULTS_ONLY_CUTOFF) is False


def test_dry_run_prints_and_succeeds(capsys):
    p = Poster(_settings(dry=True))
    assert p.send("hello") is True
    assert "DRY RUN POST:" in capsys.readouterr().out


def test_x_client_session_has_finite_request_timeout(monkeypatch):
    """tweepy.Client has no timeout constructor param, so a stalled
    create_tweet() would otherwise block a tick indefinitely."""
    import requests

    captured = {}
    real_request = requests.Session.request

    def spy_request(self, method, url, **kwargs):
        captured.update(kwargs)
        kwargs.setdefault("timeout", 0.001)
        try:
            return real_request(self, method, url, **kwargs)
        except requests.exceptions.RequestException:
            return None

    monkeypatch.setattr(requests.Session, "request", spy_request)

    p = Poster(_settings(dry=False))
    client = p._x_client()
    client.session.request("GET", "https://example.invalid")
    assert captured.get("timeout") is not None


def test_month_count_sums_tweet_count_including_partial(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="posted",
                tweet_count=1,
                posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="posted",
                tweet_count=3,
                posted_at=datetime(2026, 7, 3, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="partial",
                tweet_count=2,
                posted_at=datetime(2026, 7, 4, tzinfo=timezone.utc),
            )
        )
        conn.execute(  # failed row does not count
            posts.insert().values(
                post_type="standalone_trivia", state="failed", tweet_count=1
            )
        )
        assert month_post_count(conn, now) == 6  # 1 + 3 + 2


def test_month_count_zero_when_no_rows(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        assert month_post_count(conn, now) == 0


def test_send_thread_dry_run_returns_all_and_count(capsys):
    p = Poster(_settings(dry=True))
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert (all_ok, sent) == (True, 3)
    out = capsys.readouterr().out
    assert "a" in out and "b" in out and "c" in out


def test_send_thread_chains_reply_ids(monkeypatch):
    calls = []

    class _Resp:
        def __init__(self, tid):
            self.data = {"id": tid}

    class _FakeClient:
        def create_tweet(self, **kwargs):
            calls.append(kwargs)
            return _Resp(len(calls))  # ids 1, 2, 3

    p = Poster(_settings(dry=False))
    monkeypatch.setattr(p, "_x_client", lambda: _FakeClient())
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert (all_ok, sent) == (True, 3)
    assert "in_reply_to_tweet_id" not in calls[0]
    assert calls[1]["in_reply_to_tweet_id"] == 1
    assert calls[2]["in_reply_to_tweet_id"] == 2


def test_send_thread_partial_failure_reports_sent_count(monkeypatch):
    class _Resp:
        def __init__(self, tid):
            self.data = {"id": tid}

    class _FlakyClient:
        def __init__(self):
            self.n = 0

        def create_tweet(self, **kwargs):
            self.n += 1
            if self.n == 2:
                raise RuntimeError("X 500")
            return _Resp(self.n)

    p = Poster(_settings(dry=False))
    monkeypatch.setattr(p, "_x_client", lambda: _FlakyClient())
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert all_ok is False
    assert sent == 1  # only tweet 1 posted; tweet 2 failed, tweet 3 never attempted
