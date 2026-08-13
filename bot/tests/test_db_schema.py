import json
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.pool import StaticPool

from bot.db import content_bank, ensure_schema, metadata


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
