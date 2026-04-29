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


@pytest.mark.asyncio
async def test_trivia_today_no_match_returns_404():
    from app.main import app
    from app.database import get_session
    from unittest.mock import AsyncMock

    mock_session = AsyncMock()
    mock_session.scalar.return_value = None  # no cache, no match

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/trivia/today")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_trivia_for_date_returns_cached():
    from unittest.mock import AsyncMock, MagicMock

    mock_cached = MagicMock()
    mock_cached.data = {
        "question": "HOW MANY TIMES", "options": ["1", "2", "3", "4"],
        "correct_index": 0, "emphasis": "ONCE.", "fact": "1 time only.",
    }
    mock_session = AsyncMock()
    mock_session.scalar.return_value = mock_cached

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/trivia/2026-04-20")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert r.json()["question"] == "HOW MANY TIMES"


@pytest.mark.asyncio
async def test_trivia_for_future_date_returns_400():
    async def override():
        yield AsyncMock()

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/trivia/2099-01-01")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_trivia_for_invalid_date_returns_400():
    async def override():
        yield AsyncMock()

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/trivia/not-a-date")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_trivia_for_date_no_fixture_returns_404():
    from unittest.mock import AsyncMock

    mock_session = AsyncMock()
    mock_session.scalar.side_effect = [None, None]  # no cache, no match

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/trivia/2026-01-01")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_matches_returns_list():
    from datetime import date
    from unittest.mock import MagicMock, AsyncMock

    mock_match = MagicMock()
    mock_match.team_a_id = 1
    mock_match.team_b_id = 2
    mock_match.venue = "Wankhede Stadium"
    mock_match.match_time = "7:30 PM"
    mock_match.match_date = date(2026, 4, 24)

    mock_team_a = MagicMock()
    mock_team_a.short_name = "MI"
    mock_team_a.name = "Mumbai Indians"
    mock_team_a.primary_color = "#004BA0"

    mock_team_b = MagicMock()
    mock_team_b.short_name = "CSK"
    mock_team_b.name = "Chennai Super Kings"
    mock_team_b.primary_color = "#FFCB05"

    mock_session = AsyncMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [mock_match]
    mock_session.execute.return_value = mock_execute_result
    mock_session.get.side_effect = [mock_team_a, mock_team_b]
    mock_session.scalar.return_value = None  # no DailyCache entry

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/matches")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["date"] == "2026-04-24"
    assert data[0]["team_a"]["short_name"] == "MI"
    assert data[0]["team_b"]["short_name"] == "CSK"
    assert data[0]["has_story"] is False
    assert data[0]["headline"] is None


@pytest.mark.asyncio
async def test_matches_includes_headline_when_story_cached():
    from datetime import date
    from unittest.mock import MagicMock, AsyncMock

    mock_match = MagicMock()
    mock_match.team_a_id = 1
    mock_match.team_b_id = 2
    mock_match.venue = "Wankhede Stadium"
    mock_match.match_time = "7:30 PM"
    mock_match.match_date = date(2026, 4, 24)

    mock_team_a = MagicMock()
    mock_team_a.short_name = "MI"
    mock_team_a.name = "Mumbai Indians"
    mock_team_a.primary_color = "#004BA0"

    mock_team_b = MagicMock()
    mock_team_b.short_name = "CSK"
    mock_team_b.name = "Chennai Super Kings"
    mock_team_b.primary_color = "#FFCB05"

    mock_cached = MagicMock()
    mock_cached.data = {"headline": "ROHIT OWNS THIS GROUND.", "other": "data"}

    mock_session = AsyncMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [mock_match]
    mock_session.execute.return_value = mock_execute_result
    mock_session.get.side_effect = [mock_team_a, mock_team_b]
    mock_session.scalar.return_value = mock_cached

    async def override():
        yield mock_session

    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/matches")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    data = r.json()
    assert data[0]["has_story"] is True
    assert data[0]["headline"] == "ROHIT OWNS THIS GROUND."


@pytest.mark.asyncio
async def test_players_short_query_returns_empty():
    from unittest.mock import AsyncMock
    async def override():
        yield AsyncMock()
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/players?q=b")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_players_returns_matching():
    from unittest.mock import AsyncMock, MagicMock
    mock_player = MagicMock()
    mock_player.id = 1
    mock_player.name = "Jasprit Bumrah"
    mock_player.team_id = 5
    mock_team = MagicMock()
    mock_team.short_name = "MI"
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [mock_player]
    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_execute_result
    mock_session.get.return_value = mock_team
    async def override():
        yield mock_session
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/players?q=bumrah")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "Jasprit Bumrah"
    assert data[0]["team"] == "MI"
