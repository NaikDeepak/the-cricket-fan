from datetime import datetime, timezone

from bot.config import Settings
from bot.db import posts
from bot.poster import (RESULTS_ONLY_CUTOFF, TRIVIA_CUTOFF, Poster, allowed,
                        month_post_count)


def _settings(dry=True):
    return Settings(database_url="", dry_run=dry, cricket_api_key="",
                    cricket_api_base="", x_api_key="", x_api_secret="",
                    x_access_token="", x_access_token_secret="")


def test_month_count_only_current_month(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(posts.insert().values(fixture_id=1, post_type="prediction",
                     state="posted", attempts=1,
                     posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc)))
        conn.execute(posts.insert().values(fixture_id=2, post_type="prediction",
                     state="posted", attempts=1,
                     posted_at=datetime(2026, 6, 30, tzinfo=timezone.utc)))
        conn.execute(posts.insert().values(fixture_id=3, post_type="prediction",
                     state="failed", attempts=1, posted_at=None))
        assert month_post_count(conn, now) == 1


def test_circuit_breaker_thresholds():
    assert allowed("trivia", TRIVIA_CUTOFF - 1) is True
    assert allowed("trivia", TRIVIA_CUTOFF) is False
    assert allowed("prediction", TRIVIA_CUTOFF) is True
    assert allowed("prediction", RESULTS_ONLY_CUTOFF) is False
    assert allowed("result", RESULTS_ONLY_CUTOFF) is True


def test_dry_run_prints_and_succeeds(capsys):
    p = Poster(_settings(dry=True))
    assert p.send("hello") is True
    assert "DRY RUN POST:" in capsys.readouterr().out
