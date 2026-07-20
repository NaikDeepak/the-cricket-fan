import pytest
from sqlalchemy import inspect

from bot.config import Settings


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
    import sqlalchemy as sa
    from bot.db import posts

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
