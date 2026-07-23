from collections.abc import Iterator

import sqlalchemy as sa

from bot.db import get_engine as _bot_get_engine

_engine: sa.Engine | None = None


def get_engine(url: str) -> sa.Engine:
    return _bot_get_engine(url)


def init_engine(url: str) -> sa.Engine:
    global _engine
    _engine = get_engine(url)
    return _engine


def get_conn() -> Iterator[sa.Connection]:
    assert _engine is not None, "engine not initialised; call init_engine in lifespan"
    with _engine.connect() as conn:
        yield conn
