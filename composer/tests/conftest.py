import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

from bot.db import ensure_schema
from composer.app import create_app
from composer.deps import get_conn


@pytest.fixture
def engine():
    eng = sa.create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with eng.begin() as c:
        ensure_schema(c)
    yield eng
    eng.dispose()


@pytest.fixture
def conn(engine):
    with engine.connect() as c:
        yield c


@pytest.fixture
def client(conn):
    app = create_app()
    app.state.artifact = None

    def _override() -> object:
        yield conn

    app.dependency_overrides[get_conn] = _override
    # Skip the real lifespan (no live DB / no artifact) by not using a context manager.
    return TestClient(app)
