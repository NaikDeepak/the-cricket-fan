# IPL 2026 Real Fixtures + Match Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded MI vs CSK seed with the full IPL 2026 fixture table; expose `GET /matches` and date-parameterised story/trivia/prediction endpoints; add `/archive` and `/match/[date]` frontend pages.

**Architecture:** `Match.is_today` is dropped — today's fixture resolves via `match_date == date.today()`. All 74 IPL 2026 fixtures are seeded once. Each domain handler gains a `/{date}` route that shares a private helper with the existing `/today` route.

**Tech Stack:** FastAPI / SQLAlchemy 2.0 async / Pydantic v2 / pytest-asyncio (asyncio_mode=auto) / Next.js 16 App Router (params is a Promise) / Tailwind v4

---

## File Map

**Backend — modify:**
- `backend/app/models/match.py` — drop `is_today`
- `backend/app/api/story.py` — query + `/{date}` route
- `backend/app/api/trivia.py` — query + `/{date}` route
- `backend/app/api/prediction.py` — query + `/{date}` route
- `backend/app/main.py` — register matches router
- `backend/scripts/seed_match.py` — remove `is_today`
- `backend/tests/test_services.py` — fix Gemini mocks
- `backend/tests/test_api.py` — new tests

**Backend — create:**
- `backend/app/api/matches.py`
- `backend/scripts/seed_schedule.py`

**Frontend — modify:**
- `frontend/src/lib/api.ts`
- `frontend/src/app/layout.tsx`

**Frontend — create:**
- `frontend/src/components/archive/MatchArchiveCard.tsx`
- `frontend/src/app/archive/page.tsx`
- `frontend/src/app/match/[date]/page.tsx`

---

### Task 1: Fix test_services.py for Gemini

The existing tests mock `anthropic_client.messages.create` which no longer exists. Patch `gemini_client.aio.models.generate_content` instead. `response.parsed.model_dump()` is the new return path.

**Files:**
- Modify: `backend/tests/test_services.py`

- [ ] **Step 1: Run existing tests to see the failures**

```bash
cd backend && source .venv/bin/activate
pytest tests/test_services.py -v
```
Expected: 2 failures — `AttributeError` or `ModuleNotFoundError` on `anthropic_client`.

- [ ] **Step 2: Rewrite test_services.py with Gemini mocks**

```python
# backend/tests/test_services.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_story_service_returns_required_fields():
    from app.services.story_service import generate_story

    mock_stats = {
        "team_a": {"name": "Mumbai Indians", "short_name": "MI", "color": "#004BA0"},
        "team_b": {"name": "Chennai Super Kings", "short_name": "CSK", "color": "#FFCB05"},
        "venue": "Wankhede Stadium",
        "match_time": "7:30 PM",
        "shock_stat_value": 0,
        "shock_stat_label": "ROHIT 50+ VS CSK (L10)",
        "mi_win_pct": 78,
        "jadeja_dismissals": 5,
    }

    mock_parsed = MagicMock()
    mock_parsed.model_dump.return_value = {
        "headline": "ROHIT HASN'T SCORED >30 vs CSK IN 6 MATCHES.",
        "shock_stat": {
            "value": "0",
            "label": "ROHIT 50+ VS CSK (L10)",
            "one_liner": "0. In 10 matches. Tonight changes that.",
        },
    }
    mock_response = MagicMock()
    mock_response.parsed = mock_parsed

    with patch(
        "app.services.story_service.gemini_client.aio.models.generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await generate_story(mock_stats)

    assert "headline" in result
    assert "shock_stat" in result
    assert "value" in result["shock_stat"]
    assert "label" in result["shock_stat"]
    assert "one_liner" in result["shock_stat"]


@pytest.mark.asyncio
async def test_trivia_service_returns_required_fields():
    from app.services.trivia_service import generate_trivia

    mock_parsed = MagicMock()
    mock_parsed.model_dump.return_value = {
        "question": "HOW MANY TIMES HAS DHONI FINISHED A CHASE IN THE LAST OVER AT WANKHEDE",
        "options": ["3", "7", "11", "2"],
        "correct_index": 2,
        "emphasis": "ZERO FAILURES.",
        "fact": "11. Every single time. Dhoni has never lost a chase at Wankhede in the last 2 overs.",
    }
    mock_response = MagicMock()
    mock_response.parsed = mock_parsed

    with patch(
        "app.services.trivia_service.gemini_client.aio.models.generate_content",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await generate_trivia("Wankhede Stadium", "CSK", "MI")

    assert "question" in result
    assert len(result["options"]) == 4
    assert "correct_index" in result
    assert "emphasis" in result
    assert "fact" in result


@pytest.mark.asyncio
async def test_prediction_returns_exactly_3_evidence_items():
    from app.services.prediction_service import calculate_prediction

    stats = {
        "team_a_short": "MI",
        "team_b_short": "CSK",
        "venue": "Wankhede Stadium",
        "mi_chase_win_pct": 80,
        "csk_chase_win_pct": 37,
        "mi_death_economy": 7.2,
        "csk_death_economy": 8.9,
        "csk_vs_spin_avg": 18,
        "mi_vs_spin_avg": 34,
    }

    result = calculate_prediction(stats)
    assert "team" in result
    assert "probability" in result
    assert 0 <= result["probability"] <= 100
    assert len(result["evidence"]) == 3
    for item in result["evidence"]:
        assert "label" in item
        assert "detail" in item
```

- [ ] **Step 3: Run tests — all three must pass**

```bash
pytest tests/test_services.py -v
```
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/test_services.py
git commit -m "fix: update service tests for Gemini mock pattern"
```

---

### Task 2: Drop `Match.is_today`

**Files:**
- Modify: `backend/app/models/match.py`
- Modify: `backend/scripts/seed_match.py`

- [ ] **Step 1: Write failing test that uses match_date query**

Add to `backend/tests/test_api.py`:

```python
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
```

- [ ] **Step 2: Run test — note whether it passes or fails before change**

```bash
pytest tests/test_api.py::test_trivia_today_no_match_returns_404 -v
```

- [ ] **Step 3: Update `match.py` — drop `is_today`**

```python
# backend/app/models/match.py
import datetime

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    short_name: Mapped[str] = mapped_column(String(10))
    primary_color: Mapped[str] = mapped_column(String(7))


class Match(Base):
    __tablename__ = "matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    team_a_id: Mapped[int]
    team_b_id: Mapped[int]
    venue: Mapped[str] = mapped_column(String(200))
    match_date: Mapped[datetime.date] = mapped_column(Date)
    match_time: Mapped[str] = mapped_column(String(20))
```

- [ ] **Step 4: Update `seed_match.py` — remove `is_today`**

```python
# backend/scripts/seed_match.py
"""
Seeds one MI vs CSK match at Wankhede for today's date.
Run: python -m scripts.seed_match (from backend/ with .venv active)
"""
import asyncio
from datetime import date
from sqlalchemy import delete
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team, Match
from app.models.player import Player, PlayerVsPlayer, VenueStats


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for model in [PlayerVsPlayer, VenueStats, Player, Match, Team]:
            await session.execute(delete(model))
        await session.commit()

        mi = Team(name="Mumbai Indians", short_name="MI", primary_color="#004BA0")
        csk = Team(name="Chennai Super Kings", short_name="CSK", primary_color="#FFCB05")
        session.add_all([mi, csk])
        await session.flush()

        today_match = Match(
            team_a_id=mi.id,
            team_b_id=csk.id,
            venue="Wankhede Stadium",
            match_date=date.today(),
            match_time="7:30 PM",
        )
        session.add(today_match)
        await session.flush()

        rohit = Player(name="Rohit Sharma", team_id=mi.id)
        jadeja = Player(name="Ravindra Jadeja", team_id=csk.id)
        session.add_all([rohit, jadeja])
        await session.flush()

        session.add(PlayerVsPlayer(
            batsman_id=rohit.id, bowler_id=jadeja.id,
            balls=147, runs=89, dismissals=5, dot_balls=54,
        ))
        session.add_all([
            VenueStats(venue="Wankhede Stadium", team_id=mi.id,
                       matches=18, wins=14, chase_wins=8, chase_attempts=10, avg_score=182.0),
            VenueStats(venue="Wankhede Stadium", team_id=csk.id,
                       matches=16, wins=7, chase_wins=3, chase_attempts=8, avg_score=168.0),
        ])
        await session.commit()
        print("Seed complete.")


asyncio.run(seed())
```

- [ ] **Step 5: Re-seed and run tests**

```bash
python -m scripts.seed_match
pytest tests/test_api.py::test_trivia_today_no_match_returns_404 -v
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/models/match.py scripts/seed_match.py tests/test_api.py
git commit -m "feat: drop Match.is_today — derive today from match_date"
```

---

### Task 3: Update today-queries in story, trivia, prediction handlers

**Files:**
- Modify: `backend/app/api/story.py`
- Modify: `backend/app/api/trivia.py`
- Modify: `backend/app/api/prediction.py`

- [ ] **Step 1: Replace story.py**

```python
# backend/app/api/story.py
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import PlayerVsPlayer, Player, VenueStats, DailyCache
from ..services.story_service import generate_story

router = APIRouter(prefix="/match-story", tags=["story"])


async def _get_story_for_date(target_date: date_type, session: AsyncSession) -> dict:
    cache_key = f"story_{target_date}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == target_date))
    if not match:
        raise HTTPException(status_code=404, detail="No match on this date")

    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    mi_venue = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id)
    )
    mi_chase_pct = round((mi_venue.chase_wins / mi_venue.chase_attempts) * 100) if (mi_venue and mi_venue.chase_attempts) else 0

    rohit = await session.scalar(select(Player).where(Player.name == "Rohit Sharma"))
    jadeja = await session.scalar(select(Player).where(Player.name == "Ravindra Jadeja"))
    pvp = None
    if rohit and jadeja:
        pvp = await session.scalar(
            select(PlayerVsPlayer).where(
                PlayerVsPlayer.batsman_id == rohit.id,
                PlayerVsPlayer.bowler_id == jadeja.id,
            )
        )

    stats = {
        "team_a": {"name": team_a.name, "short_name": team_a.short_name, "color": team_a.primary_color},
        "team_b": {"name": team_b.name, "short_name": team_b.short_name, "color": team_b.primary_color},
        "venue": match.venue,
        "match_time": match.match_time,
        "shock_stat_value": 0,
        "shock_stat_label": "ROHIT 50+ VS CSK (L10)",
        "mi_win_pct": mi_chase_pct,
        "jadeja_dismissals": pvp.dismissals if pvp else 0,
    }

    generated = await generate_story(stats)

    response_data = {
        "headline": generated["headline"],
        "shock_stat": generated["shock_stat"],
        "team_a": stats["team_a"],
        "team_b": stats["team_b"],
        "venue": match.venue,
        "match_time": match.match_time,
        "stats_row": [
            {"value": str(generated["shock_stat"]["value"]), "label": generated["shock_stat"]["label"], "color": "team_a"},
            {"value": f"{mi_chase_pct}%", "label": "MI WIN % WANKHEDE", "color": "muted"},
            {"value": str(pvp.dismissals if pvp else 0), "label": "JADEJA DISMISSALS VS ROHIT", "color": "team_b"},
        ],
        "scroll_bait": "ROHIT vs JADEJA — THE KEY BATTLE",
    }

    session.add(DailyCache(cache_key=cache_key, data=response_data))
    await session.commit()
    return response_data


@router.get("/today")
async def get_today_story(session: AsyncSession = Depends(get_session)):
    return await _get_story_for_date(date_type.today(), session)


@router.get("/{match_date}")
async def get_story_for_date(match_date: str, session: AsyncSession = Depends(get_session)):
    try:
        target = date_type.fromisoformat(match_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    if target > date_type.today():
        raise HTTPException(status_code=400, detail="Cannot request future dates")
    return await _get_story_for_date(target, session)
```

- [ ] **Step 2: Replace trivia.py**

```python
# backend/app/api/trivia.py
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import DailyCache
from ..services.trivia_service import generate_trivia

router = APIRouter(prefix="/trivia", tags=["trivia"])


async def _get_trivia_for_date(target_date: date_type, session: AsyncSession) -> dict:
    cache_key = f"trivia_{target_date}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == target_date))
    if not match:
        raise HTTPException(status_code=404, detail="No match on this date")
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    result = await generate_trivia(match.venue, team_a.short_name, team_b.short_name)
    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result


@router.get("/today")
async def get_today_trivia(session: AsyncSession = Depends(get_session)):
    return await _get_trivia_for_date(date_type.today(), session)


@router.get("/{match_date}")
async def get_trivia_for_date(match_date: str, session: AsyncSession = Depends(get_session)):
    try:
        target = date_type.fromisoformat(match_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    if target > date_type.today():
        raise HTTPException(status_code=400, detail="Cannot request future dates")
    return await _get_trivia_for_date(target, session)
```

- [ ] **Step 3: Replace prediction.py**

```python
# backend/app/api/prediction.py
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import VenueStats, DailyCache
from ..services.prediction_service import calculate_prediction

router = APIRouter(prefix="/prediction", tags=["prediction"])


async def _get_prediction_for_date(target_date: date_type, session: AsyncSession) -> dict:
    cache_key = f"prediction_{target_date}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == target_date))
    if not match:
        raise HTTPException(status_code=404, detail="No match on this date")
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    mi_v = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id)
    )
    csk_v = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_b_id)
    )

    stats = {
        "team_a_short": team_a.short_name,
        "team_b_short": team_b.short_name,
        "venue": match.venue,
        "mi_chase_win_pct": round((mi_v.chase_wins / mi_v.chase_attempts) * 100) if (mi_v and mi_v.chase_attempts) else 50,
        "csk_chase_win_pct": round((csk_v.chase_wins / csk_v.chase_attempts) * 100) if (csk_v and csk_v.chase_attempts) else 50,
        "mi_death_economy": 7.2,
        "csk_death_economy": 8.9,
        "csk_vs_spin_avg": 18,
        "mi_vs_spin_avg": 34,
    }

    result = calculate_prediction(stats)
    result["team_color"] = team_a.primary_color if result["team"] == team_a.short_name else team_b.primary_color

    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result


@router.get("/today")
async def get_today_prediction(session: AsyncSession = Depends(get_session)):
    return await _get_prediction_for_date(date_type.today(), session)


@router.get("/{match_date}")
async def get_prediction_for_date(match_date: str, session: AsyncSession = Depends(get_session)):
    try:
        target = date_type.fromisoformat(match_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    if target > date_type.today():
        raise HTTPException(status_code=400, detail="Cannot request future dates")
    return await _get_prediction_for_date(target, session)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/ -v
```
Expected: all existing tests pass (including the new 404 test from Task 2).

- [ ] **Step 5: Smoke test the live server**

```bash
curl -s http://localhost:8000/trivia/today | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/trivia/2099-01-01
```
Expected: trivia JSON, then `400`.

- [ ] **Step 6: Add pytest tests for date endpoint validation**

Add to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_trivia_for_date_returns_cached():
    from unittest.mock import AsyncMock, MagicMock
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
    from unittest.mock import AsyncMock
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
    from unittest.mock import AsyncMock
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
```

- [ ] **Step 7: Run new tests**

```bash
pytest tests/test_api.py::test_trivia_for_date_returns_cached tests/test_api.py::test_trivia_for_future_date_returns_400 tests/test_api.py::test_trivia_for_invalid_date_returns_400 tests/test_api.py::test_trivia_for_date_no_fixture_returns_404 -v
```
Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add app/api/story.py app/api/trivia.py app/api/prediction.py tests/test_api.py
git commit -m "feat: date-parameterised story/trivia/prediction endpoints"
```

---

### Task 4: `GET /matches` endpoint

**Files:**
- Create: `backend/app/api/matches.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_matches_returns_list():
    from datetime import date
    from unittest.mock import MagicMock, AsyncMock
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database import get_session

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
```

- [ ] **Step 2: Run tests — both must fail (404 on /matches)**

```bash
pytest tests/test_api.py::test_matches_returns_list tests/test_api.py::test_matches_includes_headline_when_story_cached -v
```
Expected: FAIL — `404 Not Found`.

- [ ] **Step 3: Create `matches.py`**

```python
# backend/app/api/matches.py
from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import DailyCache

router = APIRouter(prefix="/matches", tags=["matches"])


class TeamSummary(BaseModel):
    short_name: str
    name: str
    primary_color: str


class MatchSummary(BaseModel):
    date: str
    team_a: TeamSummary
    team_b: TeamSummary
    venue: str
    match_time: str
    has_story: bool
    headline: str | None


@router.get("", response_model=list[MatchSummary])
async def list_matches(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Match)
        .where(Match.match_date <= date.today())
        .order_by(Match.match_date.desc())
    )
    matches = result.scalars().all()

    output = []
    for m in matches:
        team_a = await session.get(Team, m.team_a_id)
        team_b = await session.get(Team, m.team_b_id)
        cache_key = f"story_{m.match_date}"
        cached = await session.scalar(
            select(DailyCache).where(DailyCache.cache_key == cache_key)
        )
        has_story = cached is not None
        headline = (
            cached.data.get("headline")
            if (cached and isinstance(cached.data, dict))
            else None
        )
        output.append(
            MatchSummary(
                date=str(m.match_date),
                team_a=TeamSummary(
                    short_name=team_a.short_name,
                    name=team_a.name,
                    primary_color=team_a.primary_color,
                ),
                team_b=TeamSummary(
                    short_name=team_b.short_name,
                    name=team_b.name,
                    primary_color=team_b.primary_color,
                ),
                venue=m.venue,
                match_time=m.match_time,
                has_story=has_story,
                headline=headline,
            )
        )
    return output
```

- [ ] **Step 4: Register router in `main.py`**

```python
# backend/app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models.base import Base
from .models import match, player  # noqa: F401
from .api import story, trivia, prediction, stats, matches


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="The Cricket Fan API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(story.router)
app.include_router(trivia.router)
app.include_router(prediction.router)
app.include_router(stats.router)
app.include_router(matches.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests — both must pass**

```bash
pytest tests/test_api.py::test_matches_returns_list tests/test_api.py::test_matches_includes_headline_when_story_cached -v
```
Expected: 2 passed.

- [ ] **Step 6: Full test suite**

```bash
pytest tests/ -v
```
Expected: all pass.

- [ ] **Step 7: Smoke test**

```bash
curl -s http://localhost:8000/matches | python3 -m json.tool
```
Expected: JSON array with today's MI vs CSK match.

- [ ] **Step 8: Commit**

```bash
git add app/api/matches.py app/main.py tests/test_api.py
git commit -m "feat: GET /matches — past match list with cached headline"
```

---

### Task 5: `seed_schedule.py` — full IPL 2026 fixture table

**Files:**
- Create: `backend/scripts/seed_schedule.py`

**Data sourcing:** Before writing the FIXTURES list, visit `https://www.iplt20.com/matches/schedule` and collect all 74 league matches. Format each as `{"date": "YYYY-MM-DD", "team_a": "SHORT", "team_b": "SHORT", "venue": "Full Venue Name", "time": "H:MM AM/PM"}`. The script structure below is complete — only FIXTURES needs populating.

- [ ] **Step 1: Create `seed_schedule.py`**

```python
# backend/scripts/seed_schedule.py
"""
Seeds all 10 IPL 2026 teams and all 74 league fixtures.
Safe to re-run — clears and re-seeds matches and teams.
Run: python -m scripts.seed_schedule (from backend/ with .venv active)
"""
import asyncio
from datetime import date
from sqlalchemy import delete
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team, Match
from app.models.player import Player, PlayerVsPlayer, VenueStats, DailyCache

TEAMS = {
    "MI":   {"name": "Mumbai Indians",            "color": "#004BA0"},
    "CSK":  {"name": "Chennai Super Kings",        "color": "#FFCB05"},
    "RCB":  {"name": "Royal Challengers Bengaluru","color": "#EC1C24"},
    "KKR":  {"name": "Kolkata Knight Riders",      "color": "#3A225D"},
    "SRH":  {"name": "Sunrisers Hyderabad",        "color": "#F7A721"},
    "DC":   {"name": "Delhi Capitals",             "color": "#0078BC"},
    "PBKS": {"name": "Punjab Kings",               "color": "#ED1B24"},
    "RR":   {"name": "Rajasthan Royals",           "color": "#254AA5"},
    "GT":   {"name": "Gujarat Titans",             "color": "#1C1C1C"},
    "LSG":  {"name": "Lucknow Super Giants",       "color": "#A4C2F4"},
}

# Populate from https://www.iplt20.com/matches/schedule
# Format: {"date": "YYYY-MM-DD", "team_a": "SHORT", "team_b": "SHORT",
#           "venue": "Full Venue Name", "time": "7:30 PM"}
FIXTURES = [
    # Example entry — replace with the full 74-match schedule:
    {"date": "2026-04-24", "team_a": "MI", "team_b": "CSK",
     "venue": "Wankhede Stadium", "time": "7:30 PM"},
    # ... add remaining 73 fixtures here
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Clear match-related tables; preserve player stats
        await session.execute(delete(DailyCache))
        await session.execute(delete(Match))
        await session.execute(delete(Team))
        await session.commit()

        # Insert teams
        team_rows = {}
        for short, info in TEAMS.items():
            t = Team(name=info["name"], short_name=short, primary_color=info["color"])
            session.add(t)
            await session.flush()
            team_rows[short] = t

        # Insert fixtures
        for f in FIXTURES:
            session.add(Match(
                team_a_id=team_rows[f["team_a"]].id,
                team_b_id=team_rows[f["team_b"]].id,
                venue=f["venue"],
                match_date=date.fromisoformat(f["date"]),
                match_time=f["time"],
            ))

        await session.commit()
        print(f"Seeded {len(TEAMS)} teams, {len(FIXTURES)} fixtures.")
        today = date.today()
        today_match = next((f for f in FIXTURES if f["date"] == str(today)), None)
        if today_match:
            print(f"Today: {today_match['team_a']} vs {today_match['team_b']} @ {today_match['venue']}")
        else:
            print(f"No match scheduled for {today}.")


asyncio.run(seed())
```

- [ ] **Step 2: Populate FIXTURES from the official schedule**

Visit `https://www.iplt20.com/matches/schedule` (or `https://www.cricbuzz.com/cricket-series/ipl-2026/schedule`). Add all 74 entries to `FIXTURES` in the format shown. Verify:
- All 10 short names match the keys in `TEAMS`
- All dates are in `YYYY-MM-DD` format
- Today's date (`2026-04-24`) has exactly one entry

- [ ] **Step 3: Run seed and verify**

```bash
python -m scripts.seed_schedule
```
Expected output:
```
Seeded 10 teams, 74 fixtures.
Today: MI vs CSK @ Wankhede Stadium
```

- [ ] **Step 4: Re-seed player stats (seed_match.py no longer seeds teams/matches)**

Because `seed_schedule.py` deletes and re-creates teams, player foreign keys break. Run:

```bash
python -m scripts.seed_match
```

Wait — `seed_match.py` also deletes teams. These two scripts conflict. Fix `seed_match.py` to only seed players/stats, not teams/matches. Replace `seed_match.py` with:

```python
# backend/scripts/seed_match.py
"""
Seeds Rohit vs Jadeja player stats and venue stats for Wankhede.
Run AFTER seed_schedule.py.
Run: python -m scripts.seed_match (from backend/ with .venv active)
"""
import asyncio
from sqlalchemy import delete, select
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team
from app.models.player import Player, PlayerVsPlayer, VenueStats


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for model in [PlayerVsPlayer, VenueStats, Player]:
            await session.execute(delete(model))
        await session.commit()

        mi = await session.scalar(select(Team).where(Team.short_name == "MI"))
        csk = await session.scalar(select(Team).where(Team.short_name == "CSK"))
        if not mi or not csk:
            print("ERROR: Run seed_schedule.py first.")
            return

        rohit = Player(name="Rohit Sharma", team_id=mi.id)
        jadeja = Player(name="Ravindra Jadeja", team_id=csk.id)
        session.add_all([rohit, jadeja])
        await session.flush()

        session.add(PlayerVsPlayer(
            batsman_id=rohit.id, bowler_id=jadeja.id,
            balls=147, runs=89, dismissals=5, dot_balls=54,
        ))
        session.add_all([
            VenueStats(venue="Wankhede Stadium", team_id=mi.id,
                       matches=18, wins=14, chase_wins=8, chase_attempts=10, avg_score=182.0),
            VenueStats(venue="Wankhede Stadium", team_id=csk.id,
                       matches=16, wins=7, chase_wins=3, chase_attempts=8, avg_score=168.0),
        ])
        await session.commit()
        print("Player/venue stats seeded.")


asyncio.run(seed())
```

- [ ] **Step 5: Run both scripts in order**

```bash
python -m scripts.seed_schedule
python -m scripts.seed_match
```

- [ ] **Step 6: Verify today's match and past matches via API**

```bash
curl -s http://localhost:8000/matches | python3 -m json.tool
```
Expected: array of all past-or-today matches in date-descending order.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed_schedule.py scripts/seed_match.py
git commit -m "feat: seed_schedule.py — full IPL 2026 fixture table"
```

---

### Task 6: Frontend — `api.ts` additions

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update `api.ts`**

```typescript
// frontend/src/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type StatRow = { value: string; label: string; color: "team_a" | "team_b" | "muted" };
export type TeamInfo = { name: string; short_name: string; color: string };

export type StoryData = {
  headline: string;
  shock_stat: { value: string; label: string; one_liner: string };
  team_a: TeamInfo;
  team_b: TeamInfo;
  venue: string;
  match_time: string;
  stats_row: StatRow[];
  scroll_bait: string;
};

export type PvPStat = { label: string; batsman_val: number; bowler_val: number };
export type BattleData = { batsman: string; bowler: string; stats: PvPStat[] };

export type TriviaData = {
  question: string;
  options: string[];
  correct_index: number;
  emphasis: string;
  fact: string;
};

export type EvidenceItem = { label: string; detail: string };
export type PredictionData = {
  team: string;
  probability: number;
  evidence: EvidenceItem[];
  team_color: string;
};

export type TeamSummary = { short_name: string; name: string; primary_color: string };
export type MatchSummary = {
  date: string;
  team_a: TeamSummary;
  team_b: TeamSummary;
  venue: string;
  match_time: string;
  has_story: boolean;
  headline: string | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  story: () => get<StoryData>("/match-story/today"),
  battle: (a: string, b: string) =>
    get<BattleData>(`/stats/player-vs-player?player_a=${encodeURIComponent(a)}&player_b=${encodeURIComponent(b)}`),
  trivia: () => get<TriviaData>("/trivia/today"),
  prediction: () => get<PredictionData>("/prediction/today"),
  matches: () => get<MatchSummary[]>("/matches"),
  storyFor: (date: string) => get<StoryData>(`/match-story/${date}`),
  triviaFor: (date: string) => get<TriviaData>(`/trivia/${date}`),
  predictionFor: (date: string) => get<PredictionData>(`/prediction/${date}`),
};
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: api.ts — matches, storyFor, triviaFor, predictionFor"
```

---

### Task 7: `MatchArchiveCard` component

**Files:**
- Create: `frontend/src/components/archive/MatchArchiveCard.tsx`

- [ ] **Step 1: Create component**

```tsx
// frontend/src/components/archive/MatchArchiveCard.tsx
import Link from "next/link";
import { MatchSummary } from "@/lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function MatchArchiveCard({ match }: { match: MatchSummary }) {
  return (
    <Link href={`/match/${match.date}`} className="block group">
      <div className="flex items-center gap-4 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-4 group-hover:border-zinc-600 transition-colors">
        <span className="text-zinc-500 text-sm w-28 shrink-0">{formatDate(match.date)}</span>
        <div className="flex items-center gap-2 font-bold text-white shrink-0">
          <span style={{ color: match.team_a.primary_color }}>{match.team_a.short_name}</span>
          <span className="text-zinc-600 text-xs">vs</span>
          <span style={{ color: match.team_b.primary_color }}>{match.team_b.short_name}</span>
        </div>
        <span className="text-zinc-500 text-sm hidden sm:block shrink-0">{match.venue}</span>
        <div className="ml-auto text-right min-w-0">
          {match.headline ? (
            <span className="text-zinc-300 text-sm line-clamp-1">{match.headline}</span>
          ) : (
            <span className="text-zinc-700 text-sm">—</span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/archive/MatchArchiveCard.tsx
git commit -m "feat: MatchArchiveCard — date, teams, venue, headline"
```

---

### Task 8: `/archive` page

**Files:**
- Create: `frontend/src/app/archive/page.tsx`

- [ ] **Step 1: Create archive page**

```tsx
// frontend/src/app/archive/page.tsx
import { api } from "@/lib/api";
import MatchArchiveCard from "@/components/archive/MatchArchiveCard";

export default async function ArchivePage() {
  const matches = await api.matches();
  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Past Matches</h1>
        <p className="text-zinc-500 text-sm mb-8">IPL 2026 season</p>
        {matches.length === 0 ? (
          <p className="text-zinc-600">No matches recorded yet this season.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map((m) => (
              <MatchArchiveCard key={m.date} match={m} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in browser**

With `npm run dev` running, open `http://localhost:3000/archive`. Expect: list of past matches.

- [ ] **Step 3: Commit**

```bash
git add src/app/archive/page.tsx
git commit -m "feat: /archive page — past match list"
```

---

### Task 9: `/match/[date]` dynamic route

**Files:**
- Create: `frontend/src/app/match/[date]/page.tsx`

Note: In Next.js 16, `params` is a `Promise<{ date: string }>` — you must `await params` before accessing properties.

- [ ] **Step 1: Create dynamic route**

```tsx
// frontend/src/app/match/[date]/page.tsx
import { api } from "@/lib/api";
import MatchHero from "@/components/hero/MatchHero";
import PlayerBattle from "@/components/battle/PlayerBattle";
import TriviaCard from "@/components/trivia/TriviaCard";
import PredictionCard from "@/components/prediction/PredictionCard";
import SectionCounter from "@/components/ui/SectionCounter";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [story, battle, trivia, prediction] = await Promise.all([
    api.storyFor(date),
    api.battle("Rohit Sharma", "Ravindra Jadeja"),
    api.triviaFor(date),
    api.predictionFor(date),
  ]);

  return (
    <main
      style={
        {
          "--team-a": story.team_a.color,
          "--team-b": story.team_b.color,
        } as React.CSSProperties
      }
    >
      <SectionCounter total={4} />
      <MatchHero data={story} />
      <PlayerBattle data={battle} teamA={story.team_a} teamB={story.team_b} />
      <TriviaCard data={trivia} />
      <PredictionCard data={prediction} />
    </main>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/match/2026-04-24`. Expect: same layout as homepage.

- [ ] **Step 3: Verify 404 handling**

Open `http://localhost:3000/match/2026-01-01`. Expect: Next.js error page (the API returns 404 and the fetch throws — acceptable for now).

- [ ] **Step 4: Commit**

```bash
git add src/app/match/
git commit -m "feat: /match/[date] — per-date match page"
```

---

### Task 10: Navigation in `layout.tsx`

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Update layout**

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cricket Fan",
  description: "Fan-first IPL match stories, battles, trivia, and predictions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-black/80 backdrop-blur border-b border-zinc-900">
          <Link href="/" className="text-white font-bold tracking-tight text-sm">
            The Cricket Fan
          </Link>
          <Link
            href="/archive"
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Past Matches
          </Link>
        </nav>
        <div className="pt-12">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify nav renders on all pages**

Check `http://localhost:3000`, `http://localhost:3000/archive`, `http://localhost:3000/match/2026-04-24` — nav bar visible on all three.

- [ ] **Step 3: Full test suite one last time**

```bash
cd backend && pytest tests/ -v
```
Expected: all pass.

- [ ] **Step 4: Final commit**

```bash
cd frontend && git add src/app/layout.tsx
git commit -m "feat: nav bar — home + past matches links"
```
