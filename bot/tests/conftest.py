import pytest
from sqlalchemy import create_engine

from bot.db import metadata


@pytest.fixture
def engine():
    eng = create_engine("sqlite:///:memory:")
    metadata.create_all(eng)
    yield eng
    eng.dispose()
