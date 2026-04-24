# backend/tests/test_api.py
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock

from app.main import app
from app.database import get_session


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_player_vs_player_missing_params():
    mock_session = AsyncMock()

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/player-vs-player")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 422  # FastAPI validates required query params before hitting the DB


@pytest.mark.asyncio
async def test_player_vs_player_unknown_players():
    mock_session = AsyncMock()
    mock_session.scalar.return_value = None  # simulate "player not found"

    async def override_get_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/player-vs-player?player_a=Unknown&player_b=Also+Unknown")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 404
