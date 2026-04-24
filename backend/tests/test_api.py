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


@pytest.mark.asyncio
async def test_player_vs_player_found():
    from app.main import app
    from app.database import get_session
    from unittest.mock import AsyncMock, MagicMock
    from httpx import AsyncClient, ASGITransport

    mock_batsman = MagicMock()
    mock_batsman.id = 1
    mock_bowler = MagicMock()
    mock_bowler.id = 2
    mock_pvp = MagicMock()
    mock_pvp.balls = 20
    mock_pvp.runs = 25
    mock_pvp.dismissals = 2
    mock_pvp.dot_balls = 8

    # scalar() is called 3 times: batsman, bowler, pvp
    mock_session = AsyncMock()
    mock_session.scalar.side_effect = [mock_batsman, mock_bowler, mock_pvp]

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/player-vs-player?player_a=Rohit+Sharma&player_b=Ravindra+Jadeja")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    data = r.json()
    assert data["batsman"] == "Rohit Sharma"
    assert data["bowler"] == "Ravindra Jadeja"
    assert len(data["stats"]) == 4
    # SR = (25/20)*100 = 125.0, Economy = (25/20)*6 = 7.5
    sr_row = next(s for s in data["stats"] if "STRIKE RATE" in s["label"])
    assert sr_row["batsman_val"] == 125.0
    assert sr_row["bowler_val"] == 7.5
