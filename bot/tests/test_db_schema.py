import json
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.pool import StaticPool

from bot.db import content_bank, ensure_schema, metadata, resolved_leagues


def _engine():
    return sa.create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_is_published_has_no_server_default():
    # Convention: defaults explicit at insert time. server_default=sa.text("1")
    # also breaks Postgres (1 is not a boolean literal).
    assert content_bank.c.is_published.server_default is None
    assert content_bank.c.is_published.default is not None
    assert content_bank.c.is_published.default.arg is True


def test_insert_without_is_published_defaults_true():
    eng = _engine()
    metadata.create_all(eng)
    with eng.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:test",
                category="story",
                format="single",
                segments_json=json.dumps(["a"]),
                source="test",
                created_at=datetime.now(timezone.utc),
            )
        )
    with eng.connect() as conn:
        row = conn.execute(sa.select(content_bank)).one()
    assert row.is_published is True
    eng.dispose()


def test_ensure_schema_adds_is_published_to_legacy_table():
    """
    Simulate a legacy database: create content_bank without is_published,
    call ensure_schema, verify the ALTER TABLE added it with correct
    constraints and default behavior.
    """
    eng = _engine()

    # Create only the original columns, omit is_published and other story
    # cols to simulate a pre-migration schema.
    with eng.begin() as conn:
        conn.execute(
            sa.text(
                """\
CREATE TABLE IF NOT EXISTS content_bank (
    id INTEGER PRIMARY KEY,
    category VARCHAR(16) NOT NULL,
    format VARCHAR(8) NOT NULL,
    segments_json TEXT NOT NULL,
    content_key VARCHAR(128) NOT NULL UNIQUE,
    source VARCHAR(256) NOT NULL,
    created_at DATETIME NOT NULL,
    event_month_day VARCHAR(5)
)
"""
            )
        )

    # Verify is_published does not exist yet.
    with eng.connect() as conn:
        inspector = sa.inspect(conn)
        cols_before = {c["name"] for c in inspector.get_columns("content_bank")}
        assert "is_published" not in cols_before

    # Call ensure_schema to add the column.
    with eng.begin() as conn:
        ensure_schema(conn)

    # Verify is_published now exists with NOT NULL constraint.
    with eng.connect() as conn:
        inspector = sa.inspect(conn)
        cols_after = {c["name"] for c in inspector.get_columns("content_bank")}
        assert "is_published" in cols_after

        # Verify the column has NOT NULL constraint.
        is_pub_col = next(
            c
            for c in inspector.get_columns("content_bank")
            if c["name"] == "is_published"
        )
        assert is_pub_col["nullable"] is False

    # Insert a row without is_published and verify it defaults to True (1 in
    # SQLite).
    with eng.begin() as conn:
        conn.execute(
            sa.text(
                """\
INSERT INTO content_bank (id, category, format, segments_json, \
content_key, source, created_at)
VALUES (1, 'wiki_record', 'single', '["test"]', 'test:key', \
'test_source', CURRENT_TIMESTAMP)
"""
            )
        )

    # Read back and verify is_published is truthy.
    with eng.connect() as conn:
        row = conn.execute(sa.select(content_bank).where(content_bank.c.id == 1)).one()
        assert bool(row.is_published) is True

    eng.dispose()


def test_resolved_leagues_table_columns():
    assert {c.name for c in resolved_leagues.c} == {
        "series_id",
        "series_name",
        "canonical_league",
        "resolved_at",
    }
    assert resolved_leagues.c.series_id.primary_key is True
    assert resolved_leagues.c.canonical_league.nullable is True
    assert resolved_leagues.c.series_name.nullable is False


def test_resolved_leagues_created_by_ensure_schema_and_roundtrips():
    eng = _engine()
    metadata.create_all(eng)
    with eng.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            resolved_leagues.insert().values(
                series_id="s1",
                series_name="Indian Premier League 2026",
                canonical_league="IPL",
                resolved_at=datetime.now(timezone.utc),
            )
        )
        row = conn.execute(
            sa.select(resolved_leagues).where(resolved_leagues.c.series_id == "s1")
        ).first()
        assert row.canonical_league == "IPL"
        assert row.series_name == "Indian Premier League 2026"
