import contextlib
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy import inspect

from bot.config import Settings
from bot.db import content_bank, posts


def test_settings_reads_env(monkeypatch):
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite:///x.db")
    monkeypatch.setenv("BOT_DRY_RUN", "1")
    s = Settings.from_env()
    assert s.database_url == "sqlite:///x.db"
    assert s.dry_run is True


def test_all_tables_defined(engine):
    names = set(inspect(engine).get_table_names())
    assert {"team_matches", "aliases", "fixtures", "predictions", "posts"} <= names


def test_posts_unique_constraint(engine):
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=1, post_type="prediction", state="scheduled", attempts=0
            )
        )
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                posts.insert().values(
                    fixture_id=1, post_type="prediction", state="scheduled", attempts=0
                )
            )


def test_team_matches_has_phase_columns():
    from bot.db import team_matches

    cols = {c.name for c in team_matches.columns}
    assert {
        "batted_first",
        "pp_runs_scored",
        "pp_overs_faced",
        "death_runs_conceded",
        "death_overs_bowled",
    } <= cols


def test_posts_fixture_id_nullable_for_standalone(engine):
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=None,
                post_type="standalone_trivia",
                state="scheduled",
                attempts=0,
                slot_key="2026-07-22-08",
            )
        )


def test_posts_slot_key_unique(engine):
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=None,
                post_type="standalone_trivia",
                state="scheduled",
                attempts=0,
                slot_key="2026-07-22-08",
            )
        )
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                posts.insert().values(
                    fixture_id=None,
                    post_type="standalone_trivia",
                    state="scheduled",
                    attempts=0,
                    slot_key="2026-07-22-08",
                )
            )


def test_trivia_log_table_roundtrip(engine):
    from bot.db import trivia_log

    with engine.begin() as conn:
        conn.execute(
            trivia_log.insert().values(
                content_key="h2h:CSK:MI",
                posted_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
            )
        )
        got = conn.execute(sa.select(trivia_log.c.content_key)).scalar_one()
        assert got == "h2h:CSK:MI"


def test_ensure_schema_idempotent_on_sqlite(engine):
    """ensure_schema() must not run Postgres-only DDL (ALTER COLUMN ... DROP
    NOT NULL) against the sqlite test engine — that syntax doesn't exist in
    sqlite and would raise OperationalError."""
    from bot.db import ensure_schema

    with engine.begin() as conn:
        ensure_schema(conn)
        ensure_schema(conn)  # second call must also be a no-op, not an error


def test_content_bank_table_roundtrips(engine):
    with engine.begin() as conn:
        conn.execute(
            content_bank.insert().values(
                category="wiki_record",
                format="single",
                segments_json='["fact"]',
                content_key="wiki_record:test:most-runs",
                source="wikipedia:List_of_Test_cricket_records",
                created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
            )
        )
        row = conn.execute(sa.select(content_bank)).one()
    assert row.content_key == "wiki_record:test:most-runs"
    assert row.format == "single"


def test_content_key_is_unique(engine):
    vals = dict(
        category="anecdote",
        format="single",
        segments_json='["x"]',
        content_key="anecdote:dupe",
        source="wikipedia:X",
        created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
    )
    with engine.begin() as conn:
        conn.execute(content_bank.insert().values(**vals))
        with pytest_raises_integrity():
            conn.execute(content_bank.insert().values(**vals))


def test_posts_insert_defaults_tweet_count_to_one(engine):
    with engine.begin() as conn:
        pid = conn.execute(
            posts.insert().values(post_type="standalone_trivia", state="posted")
        ).inserted_primary_key[0]
        tc = conn.execute(
            sa.select(posts.c.tweet_count).where(posts.c.id == pid)
        ).scalar_one()
    assert tc == 1


@contextlib.contextmanager
def pytest_raises_integrity():
    with pytest.raises(sa.exc.IntegrityError):
        yield
