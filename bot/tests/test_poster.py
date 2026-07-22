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
