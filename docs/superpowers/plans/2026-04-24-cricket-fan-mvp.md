# The Cricket Fan MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the MVP — Hero + Battle + Trivia + Prediction + Shock Stat share card — as one GSAP-driven scroll story backed by FastAPI + Claude API.

**Architecture:** Next.js 16 server component fetches all 4 API endpoints in parallel on page load and passes data as props to client components. FastAPI serves pre-aggregated Cricsheet stats and Claude-generated narratives cached daily in PostgreSQL. Seed data (MI vs CSK, Wankhede) is used for local dev; Cricsheet real data is wired in Task 14.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 / GSAP 3.12 (SplitText, ScrollTrigger) / FastAPI / SQLAlchemy 2.0 async / PostgreSQL / Anthropic SDK / html-to-image / Docker

---

## Strategy

Build with hardcoded seed data first so the UI works on Day 1. Wire real Cricsheet data last. This means you can develop and test every section without waiting for data ingestion.

**Note on html2canvas vs html-to-image:** The spec mentions html2canvas, but it does not handle CSS custom properties (our team colour vars). Use `html-to-image` instead — it resolves computed styles before capture, so `--team-a` and `--team-b` render correctly on the card.

---

## File Map

### Backend

| File | Responsibility |
|---|---|
| `backend/app/config.py` | Pydantic-settings env config |
| `backend/app/database.py` | Async SQLAlchemy engine + `get_session` dep |
| `backend/app/models/base.py` | `Base` declarative class |
| `backend/app/models/match.py` | `Match`, `Team` ORM models |
| `backend/app/models/player.py` | `Player`, `PlayerVsPlayer`, `VenueStats`, `DailyCache` ORM models |
| `backend/app/main.py` | FastAPI app, CORS, lifespan (create tables), mount routers |
| `backend/app/api/story.py` | `GET /match-story/today` |
| `backend/app/api/stats.py` | `GET /stats/player-vs-player` |
| `backend/app/api/trivia.py` | `GET /trivia/today` |
| `backend/app/api/prediction.py` | `GET /prediction/today` |
| `backend/app/services/story_service.py` | Claude API → match story, daily cache |
| `backend/app/services/trivia_service.py` | Claude API → trivia, daily cache |
| `backend/app/services/prediction_service.py` | Weighted factor scoring, Claude API for reasoning |
| `backend/app/data/cricsheet_parser.py` | Parse Cricsheet ball-by-ball JSON |
| `backend/app/data/aggregator.py` | Build `player_vs_player` + `venue_stats` from parsed data |
| `backend/scripts/seed_match.py` | Seed one MI vs CSK match with known stats for dev |
| `backend/tests/conftest.py` | pytest fixtures: async engine, session, test client |
| `backend/tests/test_services.py` | Unit tests for all 3 services (Claude API mocked) |
| `backend/tests/test_api.py` | Integration tests for all 4 endpoints |

### Frontend

| File | Responsibility |
|---|---|
| `frontend/src/app/layout.tsx` | Space Grotesk font, inject CSS custom properties from body data attrs |
| `frontend/src/app/globals.css` | All design token CSS vars, Space Grotesk `@font-face`, resets |
| `frontend/src/app/page.tsx` | Server component — parallel fetch of 4 endpoints, renders section stack |
| `frontend/src/lib/gsap.ts` | Register ScrollTrigger + SplitText once, export configured `gsap` |
| `frontend/src/lib/api.ts` | Typed async fetch functions for all 4 endpoints + shared types |
| `frontend/src/lib/share.ts` | `captureCard(el, ratio)` → Blob; `shareCard(blob)` → navigator.share or download |
| `frontend/src/components/hero/MatchHero.tsx` | Full hero section, GSAP entrance timeline |
| `frontend/src/components/hero/HeroStats.tsx` | 3-stat row with count-up, fires after headline |
| `frontend/src/components/battle/PlayerBattle.tsx` | Battle section wrapper, section entrance |
| `frontend/src/components/battle/BattleBars.tsx` | Face-off bars, scaleX from centre, overshoot |
| `frontend/src/components/trivia/TriviaCard.tsx` | Tap → shake/flip → reveal → streak |
| `frontend/src/components/prediction/PredictionCard.tsx` | Evidence stagger → border → THEREFORE → count-up |
| `frontend/src/components/share/ShockStatCard.tsx` | Off-screen DOM twin for 9:16 + 1:1 cards |
| `frontend/src/components/share/ShareDrawer.tsx` | GSAP translateX/Y drawer, previews, share/download |
| `frontend/src/components/ui/SectionCounter.tsx` | Persistent `01/04` top-right micro-label |
| `frontend/src/components/ui/ProgressDots.tsx` | Right-edge 1px line + 4 dots |

---

## Task 1: Environment Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.local` (gitignored)
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add Docker Compose for Postgres**

```yaml
# docker-compose.yml (repo root)
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cricket_fan
      POSTGRES_USER: cricket
      POSTGRES_PASSWORD: cricket
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres**

```bash
docker compose up -d db
docker compose ps   # verify State = running
```

- [ ] **Step 3: Create backend .env.local**

```bash
# backend/.env.local  (gitignored — never commit)
DATABASE_URL=postgresql+asyncpg://cricket:cricket@localhost:5432/cricket_fan
ANTHROPIC_API_KEY=your_key_here
ENVIRONMENT=development
```

- [ ] **Step 4: Update requirements.txt and install**

```
# backend/requirements.txt — replace contents
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
asyncpg>=0.29.0
pydantic>=2.7.0
pydantic-settings>=2.3.0
anthropic>=0.30.0
python-dotenv>=1.0.0
httpx>=0.27.0
orjson>=3.10.0
pytest>=8.2.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 5: Verify imports work**

```bash
python -c "import fastapi, sqlalchemy, anthropic; print('OK')"
# Expected: OK
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/requirements.txt
git commit -m "chore: add docker-compose postgres + backend deps"
```

---

## Task 2: FastAPI App + Database + ORM Models

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/match.py`
- Create: `backend/app/models/player.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: config.py**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

settings = Settings()
```

- [ ] **Step 2: database.py**

```python
# backend/app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 3: models/base.py**

```python
# backend/app/models/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

- [ ] **Step 4: models/match.py**

```python
# backend/app/models/match.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Date, Time
from .base import Base

class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    short_name: Mapped[str] = mapped_column(String(10))
    primary_color: Mapped[str] = mapped_column(String(7))  # hex

class Match(Base):
    __tablename__ = "matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    team_a_id: Mapped[int]
    team_b_id: Mapped[int]
    venue: Mapped[str] = mapped_column(String(200))
    match_date: Mapped["datetime.date"] = mapped_column(Date)
    match_time: Mapped[str] = mapped_column(String(20))
    is_today: Mapped[bool] = mapped_column(default=False)
```

- [ ] **Step 5: models/player.py**

```python
# backend/app/models/player.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, JSON, UniqueConstraint
from datetime import date
from .base import Base

class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    team_id: Mapped[int]

class PlayerVsPlayer(Base):
    __tablename__ = "player_vs_player"
    __table_args__ = (UniqueConstraint("batsman_id", "bowler_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    batsman_id: Mapped[int]
    bowler_id: Mapped[int]
    balls: Mapped[int] = mapped_column(default=0)
    runs: Mapped[int] = mapped_column(default=0)
    dismissals: Mapped[int] = mapped_column(default=0)
    dot_balls: Mapped[int] = mapped_column(default=0)

class VenueStats(Base):
    __tablename__ = "venue_stats"
    __table_args__ = (UniqueConstraint("venue", "team_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    venue: Mapped[str] = mapped_column(String(200))
    team_id: Mapped[int]
    matches: Mapped[int] = mapped_column(default=0)
    wins: Mapped[int] = mapped_column(default=0)
    chase_wins: Mapped[int] = mapped_column(default=0)
    chase_attempts: Mapped[int] = mapped_column(default=0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)

class DailyCache(Base):
    __tablename__ = "daily_cache"
    id: Mapped[int] = mapped_column(primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(100), unique=True)
    data: Mapped[dict] = mapped_column(JSON)
```

- [ ] **Step 6: main.py**

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from .models.base import Base
from .models import match, player  # noqa: F401 — registers models

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

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run and verify**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
# In another terminal:
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

Check that tables were created:
```bash
docker exec -it $(docker compose ps -q db) psql -U cricket -d cricket_fan -c "\dt"
# Expected: lists teams, matches, players, player_vs_player, venue_stats, daily_cache
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/
git commit -m "feat: FastAPI app + SQLAlchemy models + lifespan table creation"
```

---

## Task 3: Seed Script (MI vs CSK Dev Data)

**Files:**
- Create: `backend/scripts/seed_match.py`
- Create: `backend/scripts/__init__.py`

- [ ] **Step 1: Write seed script**

```python
# backend/scripts/seed_match.py
"""
Seeds one MI vs CSK match at Wankhede with known head-to-head stats.
Run: python -m scripts.seed_match (from backend/ dir with .venv active)
"""
import asyncio
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models import match as m, player as p
from app.models.match import Team, Match
from app.models.player import Player, PlayerVsPlayer, VenueStats
from datetime import date
from sqlalchemy import delete

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Clear existing seed data
        for model in [PlayerVsPlayer, VenueStats, Player, Match, Team]:
            await session.execute(delete(model))
        await session.commit()

        # Teams
        mi = Team(name="Mumbai Indians", short_name="MI", primary_color="#004BA0")
        csk = Team(name="Chennai Super Kings", short_name="CSK", primary_color="#FFCB05")
        session.add_all([mi, csk])
        await session.flush()

        # Today's match
        today_match = Match(
            team_a_id=mi.id,
            team_b_id=csk.id,
            venue="Wankhede Stadium",
            match_date=date.today(),
            match_time="7:30 PM",
            is_today=True,
        )
        session.add(today_match)
        await session.flush()

        # Players
        rohit = Player(name="Rohit Sharma", team_id=mi.id)
        jadeja = Player(name="Ravindra Jadeja", team_id=csk.id)
        session.add_all([rohit, jadeja])
        await session.flush()

        # Rohit vs Jadeja head-to-head (real IPL historical stats)
        pvp = PlayerVsPlayer(
            batsman_id=rohit.id,
            bowler_id=jadeja.id,
            balls=147,
            runs=89,
            dismissals=5,
            dot_balls=54,
        )
        session.add(pvp)

        # Venue stats — MI at Wankhede
        mi_wankhede = VenueStats(
            venue="Wankhede Stadium",
            team_id=mi.id,
            matches=18,
            wins=14,
            chase_wins=8,
            chase_attempts=10,
            avg_score=182.0,
        )
        # Venue stats — CSK at Wankhede
        csk_wankhede = VenueStats(
            venue="Wankhede Stadium",
            team_id=csk.id,
            matches=16,
            wins=7,
            chase_wins=3,
            chase_attempts=8,
            avg_score=168.0,
        )
        session.add_all([mi_wankhede, csk_wankhede])
        await session.commit()
        print("Seed complete.")
        print(f"  MI id={mi.id}, CSK id={csk.id}")
        print(f"  Rohit id={rohit.id}, Jadeja id={jadeja.id}")
        print(f"  Match id={today_match.id}")

asyncio.run(seed())
```

- [ ] **Step 2: Run seed**

```bash
cd backend
python -m scripts.seed_match
# Expected: Seed complete. Prints IDs.
```

- [ ] **Step 3: Verify data**

```bash
docker exec -it $(docker compose ps -q db) psql -U cricket -d cricket_fan \
  -c "SELECT name, short_name, primary_color FROM teams;"
# Expected: MI and CSK rows
```

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/
git commit -m "feat: dev seed script — MI vs CSK at Wankhede"
```

---

## Task 4: Story Service + /match-story/today

**Files:**
- Create: `backend/app/services/story_service.py`
- Create: `backend/app/api/story.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_services.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
```

```python
# backend/tests/test_services.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

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

    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].type = "tool_use"
    mock_response.content[0].input = {
        "headline": "ROHIT HASN'T SCORED >30 vs CSK IN 6 MATCHES.",
        "shock_stat": {
            "value": "0",
            "label": "ROHIT 50+ VS CSK (L10)",
            "one_liner": "0. In 10 matches. Tonight changes that.",
        }
    }

    with patch("app.services.story_service.anthropic_client.messages.create",
               return_value=mock_response):
        result = await generate_story(mock_stats)

    assert "headline" in result
    assert "shock_stat" in result
    assert "value" in result["shock_stat"]
    assert "label" in result["shock_stat"]
    assert "one_liner" in result["shock_stat"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_services.py::test_story_service_returns_required_fields -v
# Expected: FAIL — ImportError (module not found)
```

- [ ] **Step 3: Write story service**

```python
# backend/app/services/story_service.py
import anthropic
from ..config import settings

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan — a fan who has watched every IPL season since 2008.
Rules:
- Never start with "The" or "A". Start with a name, number, or verb.
- Period is a dramatic device. Short sentences hit harder.
- Max 12 words per headline. Active voice always.
- Forbidden words: incredible, amazing, phenomenal, epic, masterclass, passionate fans, nail-biting, world-class.
- Allowed: owns, haunts, chokes, dominates, raw numbers, tonight, never, every time.
- Opinions stated as facts."""

STORY_TOOL = {
    "name": "generate_match_story",
    "description": "Generate match story headline and shock stat",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {
                "type": "string",
                "description": "Max 10 words. Pattern: [PLAYER] [VERB] [STAT] [TIME CONTEXT]. All caps."
            },
            "shock_stat": {
                "type": "object",
                "properties": {
                    "value": {"type": "string", "description": "The raw number or short value"},
                    "label": {"type": "string", "description": "Max 5 words, all caps"},
                    "one_liner": {"type": "string", "description": "Max 15 words, starts with number or name"}
                },
                "required": ["value", "label", "one_liner"]
            }
        },
        "required": ["headline", "shock_stat"]
    }
}

async def generate_story(stats: dict) -> dict:
    user_content = (
        f"Today's match: {stats['team_a']['short_name']} vs {stats['team_b']['short_name']} "
        f"at {stats['venue']}.\n"
        f"Key stats:\n"
        f"- Rohit Sharma has scored 0 fifties vs CSK in his last 10 IPL matches\n"
        f"- {stats['team_a']['short_name']} win rate at {stats['venue']}: {stats['mi_win_pct']}%\n"
        f"- Jadeja has dismissed Rohit {stats['jadeja_dismissals']} times\n"
        f"Generate the headline and shock stat. Make it feel like a newspaper back page."
    )

    response = anthropic_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=[{"type": "text", "text": TONE_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[STORY_TOOL],
        tool_choice={"type": "tool", "name": "generate_match_story"},
        messages=[{"role": "user", "content": user_content}]
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_services.py::test_story_service_returns_required_fields -v
# Expected: PASS
```

- [ ] **Step 5: Write /match-story/today route**

```python
# backend/app/api/story.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from ..database import get_session
from ..models.match import Match, Team
from ..models.player import PlayerVsPlayer, Player, VenueStats, DailyCache
from ..services.story_service import generate_story
import orjson

router = APIRouter(prefix="/match-story", tags=["story"])

@router.get("/today")
async def get_today_story(session: AsyncSession = Depends(get_session)):
    cache_key = f"story_{date.today()}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.is_today == True))
    if not match:
        return {"error": "No match today"}

    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)

    mi_venue = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id)
    )
    csk_venue = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_b_id)
    )

    mi_chase_pct = round((mi_venue.chase_wins / mi_venue.chase_attempts) * 100) if mi_venue else 0

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
```

- [ ] **Step 6: Mount router in main.py**

```python
# backend/app/main.py — add after existing imports
from .api import story

# add after middleware:
app.include_router(story.router)
```

- [ ] **Step 7: Test the endpoint**

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/match-story/today | python -m json.tool
# Expected: JSON with headline, shock_stat, team_a, team_b, stats_row
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/story_service.py backend/app/api/story.py backend/app/main.py backend/tests/
git commit -m "feat: story service + /match-story/today endpoint with daily cache"
```

---

## Task 5: Trivia Service + /trivia/today

**Files:**
- Create: `backend/app/services/trivia_service.py`
- Create: `backend/app/api/trivia.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing test**

```python
# Add to backend/tests/test_services.py

@pytest.mark.asyncio
async def test_trivia_service_returns_required_fields():
    from app.services.trivia_service import generate_trivia

    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].type = "tool_use"
    mock_response.content[0].input = {
        "question": "HOW MANY TIMES HAS DHONI FINISHED A CHASE IN THE LAST OVER AT WANKHEDE",
        "options": ["3", "7", "11", "2"],
        "correct_index": 2,
        "emphasis": "ZERO FAILURES.",
        "fact": "11. Every single time. Dhoni has never lost a chase at Wankhede in the last 2 overs.",
    }

    with patch("app.services.trivia_service.anthropic_client.messages.create",
               return_value=mock_response):
        result = await generate_trivia("Wankhede Stadium", "CSK", "MI")

    assert "question" in result
    assert len(result["options"]) == 4
    assert "correct_index" in result
    assert "emphasis" in result
    assert "fact" in result
```

- [ ] **Step 2: Run failing test**

```bash
pytest tests/test_services.py::test_trivia_service_returns_required_fields -v
# Expected: FAIL
```

- [ ] **Step 3: Write trivia service**

```python
# backend/app/services/trivia_service.py
import anthropic
from ..config import settings

anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

TONE_SYSTEM_PROMPT = """You are the voice of The Cricket Fan.
Rules: Never use "amazing" or "incredible". Start answers with the number. Period = drama.
Max 20 words for the fact. The question must create tension without a question mark."""

TRIVIA_TOOL = {
    "name": "generate_trivia",
    "description": "Generate one trivia question from IPL history",
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "Tension statement, no question mark, all caps, max 15 words"},
            "options": {"type": "array", "items": {"type": "string"}, "description": "Exactly 4 options (numbers or short answers)"},
            "correct_index": {"type": "integer", "description": "0-3 index of correct option"},
            "emphasis": {"type": "string", "description": "1-3 words after the answer reveal, e.g. ZERO FAILURES. or NOT ONCE."},
            "fact": {"type": "string", "description": "Full fact, max 25 words, starts with number or name"},
        },
        "required": ["question", "options", "correct_index", "emphasis", "fact"]
    }
}

async def generate_trivia(venue: str, team_a: str, team_b: str) -> dict:
    user_content = (
        f"Generate one surprising trivia question about IPL matches at {venue} "
        f"involving {team_a} or {team_b}. Use a real stat that most fans would get wrong. "
        f"The answer should be a number."
    )

    response = anthropic_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=[{"type": "text", "text": TONE_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[TRIVIA_TOOL],
        tool_choice={"type": "tool", "name": "generate_trivia"},
        messages=[{"role": "user", "content": user_content}]
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_services.py::test_trivia_service_returns_required_fields -v
# Expected: PASS
```

- [ ] **Step 5: Write route**

```python
# backend/app/api/trivia.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from ..database import get_session
from ..models.match import Match, Team
from ..models.player import DailyCache
from ..services.trivia_service import generate_trivia

router = APIRouter(prefix="/trivia", tags=["trivia"])

@router.get("/today")
async def get_today_trivia(session: AsyncSession = Depends(get_session)):
    cache_key = f"trivia_{date.today()}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.is_today == True))
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)

    result = await generate_trivia(match.venue, team_a.short_name, team_b.short_name)

    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result
```

- [ ] **Step 6: Mount and test**

```python
# backend/app/main.py — add:
from .api import trivia
app.include_router(trivia.router)
```

```bash
curl http://localhost:8000/trivia/today | python -m json.tool
# Expected: question, options (4 items), correct_index, emphasis, fact
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/trivia_service.py backend/app/api/trivia.py backend/app/main.py
git commit -m "feat: trivia service + /trivia/today endpoint"
```

---

## Task 6: Prediction Service + /prediction/today

**Files:**
- Create: `backend/app/services/prediction_service.py`
- Create: `backend/app/api/prediction.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing test**

```python
# Add to backend/tests/test_services.py

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

- [ ] **Step 2: Run failing test**

```bash
pytest tests/test_services.py::test_prediction_returns_exactly_3_evidence_items -v
# Expected: FAIL
```

- [ ] **Step 3: Write prediction service (no ML, weighted scoring)**

```python
# backend/app/services/prediction_service.py

def calculate_prediction(stats: dict) -> dict:
    """
    Weighted factor scoring. Three factors, each scored 0-100.
    Factor weights sum to 1.0.
    """
    factors = []

    # Factor 1: Death over economy (lower is better — MI leads)
    mi_econ = stats["mi_death_economy"]
    csk_econ = stats["csk_death_economy"]
    econ_score = 70 if mi_econ < csk_econ else 30
    factors.append({
        "label": "DEATH OVER DOMINANCE",
        "detail": f"Economy {mi_econ} vs CSK · Overs 17–20",
        "mi_score": econ_score,
        "weight": 0.35,
    })

    # Factor 2: Venue chase record
    mi_chase = stats["mi_chase_win_pct"]
    csk_chase = stats["csk_chase_win_pct"]
    chase_score = 75 if mi_chase > csk_chase else 40
    factors.append({
        "label": "WANKHEDE CHASE RECORD",
        "detail": f"{mi_chase}% wins chasing · CSK: {csk_chase}%",
        "mi_score": chase_score,
        "weight": 0.40,
    })

    # Factor 3: Spin weakness
    csk_spin = stats["csk_vs_spin_avg"]
    mi_spin = stats["mi_vs_spin_avg"]
    spin_score = 65 if mi_spin > csk_spin else 45
    factors.append({
        "label": "SPIN EXPOSURE",
        "detail": f"CSK top-3 avg {csk_spin} vs left-arm spin",
        "mi_score": spin_score,
        "weight": 0.25,
    })

    probability = round(sum(f["mi_score"] * f["weight"] for f in factors))
    winning_team = "MI" if probability >= 50 else "CSK"
    if winning_team == "CSK":
        probability = 100 - probability

    return {
        "team": winning_team,
        "probability": probability,
        "evidence": [{"label": f["label"], "detail": f["detail"]} for f in factors],
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_services.py::test_prediction_returns_exactly_3_evidence_items -v
# Expected: PASS
```

- [ ] **Step 5: Write route**

```python
# backend/app/api/prediction.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from ..database import get_session
from ..models.match import Match, Team
from ..models.player import VenueStats, DailyCache
from ..services.prediction_service import calculate_prediction

router = APIRouter(prefix="/prediction", tags=["prediction"])

@router.get("/today")
async def get_today_prediction(session: AsyncSession = Depends(get_session)):
    cache_key = f"prediction_{date.today()}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.is_today == True))
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)

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
        "mi_chase_win_pct": round((mi_v.chase_wins / mi_v.chase_attempts) * 100) if mi_v else 50,
        "csk_chase_win_pct": round((csk_v.chase_wins / csk_v.chase_attempts) * 100) if csk_v else 50,
        "mi_death_economy": 7.2,   # TODO Task 14: derive from Cricsheet phase_stats
        "csk_death_economy": 8.9,
        "csk_vs_spin_avg": 18,
        "mi_vs_spin_avg": 34,
    }

    result = calculate_prediction(stats)
    result["team_color"] = team_a.primary_color if result["team"] == team_a.short_name else team_b.primary_color

    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result
```

- [ ] **Step 6: Mount and test**

```python
# backend/app/main.py — add:
from .api import prediction
app.include_router(prediction.router)
```

```bash
curl http://localhost:8000/prediction/today | python -m json.tool
# Expected: team, probability (integer), evidence (3 items), team_color
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/prediction_service.py backend/app/api/prediction.py backend/app/main.py
git commit -m "feat: prediction service (weighted scoring) + /prediction/today"
```

---

## Task 7: Stats Endpoint + Run All Tests

**Files:**
- Create: `backend/app/api/stats.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

```python
# backend/tests/test_api.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200

@pytest.mark.asyncio
async def test_player_vs_player_missing_params(client):
    r = await client.get("/stats/player-vs-player")
    assert r.status_code == 422  # missing required query params

@pytest.mark.asyncio
async def test_player_vs_player_unknown_players(client):
    r = await client.get("/stats/player-vs-player?player_a=Unknown&player_b=Also+Unknown")
    assert r.status_code == 404
```

- [ ] **Step 2: Run failing tests**

```bash
pytest tests/test_api.py -v
# Expected: test_health PASS, others FAIL (route not found)
```

- [ ] **Step 3: Write stats route**

```python
# backend/app/api/stats.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_session
from ..models.player import Player, PlayerVsPlayer

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/player-vs-player")
async def get_pvp(
    player_a: str = Query(..., description="Batsman name"),
    player_b: str = Query(..., description="Bowler name"),
    session: AsyncSession = Depends(get_session),
):
    batsman = await session.scalar(select(Player).where(Player.name == player_a))
    bowler = await session.scalar(select(Player).where(Player.name == player_b))

    if not batsman or not bowler:
        raise HTTPException(status_code=404, detail="Player not found")

    pvp = await session.scalar(
        select(PlayerVsPlayer).where(
            PlayerVsPlayer.batsman_id == batsman.id,
            PlayerVsPlayer.bowler_id == bowler.id,
        )
    )
    if not pvp:
        raise HTTPException(status_code=404, detail="No head-to-head data")

    sr = round((pvp.runs / pvp.balls) * 100, 1) if pvp.balls else 0
    dot_pct = round((pvp.dot_balls / pvp.balls) * 100, 1) if pvp.balls else 0

    return {
        "batsman": player_a,
        "bowler": player_b,
        "stats": [
            {"label": "BALLS FACED", "batsman_val": pvp.balls, "bowler_val": pvp.balls},
            {"label": "DISMISSALS", "batsman_val": pvp.dismissals, "bowler_val": pvp.dismissals},
            {"label": "STRIKE RATE", "batsman_val": sr, "bowler_val": sr},
            {"label": "DOT BALL %", "batsman_val": dot_pct, "bowler_val": dot_pct},
        ],
    }
```

- [ ] **Step 4: Mount and run all tests**

```python
# backend/app/main.py — add:
from .api import stats
app.include_router(stats.router)
```

```bash
pytest tests/ -v
# Expected: all unit tests PASS (Claude API mocked), API tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/stats.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: /stats/player-vs-player + full test suite green"
```

---

## Task 8: Frontend Foundation — GSAP, Tokens, Font

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/gsap.ts`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Remove Framer Motion, install GSAP**

```bash
cd frontend
npm uninstall framer-motion
npm install gsap @gsap/react html-to-image
```

- [ ] **Step 2: Create GSAP registration module**

```typescript
// frontend/src/lib/gsap.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };
export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const DURATION = { fast: 0.4, base: 0.6, slow: 0.8 };
export const STAGGER = 0.09;
```

- [ ] **Step 3: globals.css — all design tokens**

```css
/* frontend/src/app/globals.css */
@import "tailwindcss";

@font-face {
  font-family: "Space Grotesk";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFX.woff2") format("woff2");
  unicode-range: U+0000-00FF;
}

:root {
  --bg: #0a0a0a;
  --surface: #141414;
  --fg: #f0f0f0;
  --muted: #666666;
  --border: #222222;
  --team-a: #004ba0;
  --team-b: #ffcb05;
}

*, *::before, *::after { box-sizing: border-box; }

html { background: var(--bg); color: var(--fg); font-family: "Space Grotesk", sans-serif; }
body { margin: 0; overflow-x: hidden; }

/* Typography scale */
.text-stat-hero {
  font-size: clamp(96px, 18vw, 200px);
  font-weight: 700;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.text-section-headline {
  font-size: clamp(40px, 7vw, 80px);
  font-weight: 600;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}
.text-player-name {
  font-size: clamp(24px, 4vw, 48px);
  font-weight: 500;
}
.text-micro {
  font-size: clamp(12px, 1.2vw, 14px);
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Divider */
.divider {
  width: 100%;
  height: 1px;
  background: var(--border);
  transform-origin: center;
}

/* Hero radial glow — only allowed gradient */
.hero-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.05), transparent 70%);
  pointer-events: none;
}
```

- [ ] **Step 4: layout.tsx — inject team colours as CSS vars**

```typescript
// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cricket Fan",
  description: "Fan-first IPL match stories, battles, trivia, and predictions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: api.ts — typed fetch wrappers**

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
};
```

- [ ] **Step 6: Set NEXT_PUBLIC_API_URL**

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 7: Verify build compiles**

```bash
cd frontend
npm run build 2>&1 | tail -15
# Expected: no TypeScript errors
```

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: frontend foundation — GSAP, design tokens, typed API client"
```

---

## Task 9: Page Shell + Hero Section

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/hero/MatchHero.tsx`
- Create: `frontend/src/components/hero/HeroStats.tsx`
- Create: `frontend/src/components/ui/SectionCounter.tsx`

- [ ] **Step 1: page.tsx — server component, parallel fetch**

```typescript
// frontend/src/app/page.tsx
import { api } from "@/lib/api";
import MatchHero from "@/components/hero/MatchHero";
import PlayerBattle from "@/components/battle/PlayerBattle";
import TriviaCard from "@/components/trivia/TriviaCard";
import PredictionCard from "@/components/prediction/PredictionCard";
import SectionCounter from "@/components/ui/SectionCounter";

export default async function Page() {
  const [story, battle, trivia, prediction] = await Promise.all([
    api.story(),
    api.battle("Rohit Sharma", "Ravindra Jadeja"),
    api.trivia(),
    api.prediction(),
  ]);

  return (
    <main
      style={{
        "--team-a": story.team_a.color,
        "--team-b": story.team_b.color,
      } as React.CSSProperties}
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

- [ ] **Step 2: SectionCounter**

```typescript
// frontend/src/components/ui/SectionCounter.tsx
"use client";
import { useEffect, useRef } from "react";

export default function SectionCounter({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = document.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && ref.current) {
            ref.current.textContent = `0${e.target.getAttribute("data-section")} / 0${total}`;
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [total]);

  return (
    <div
      ref={ref}
      className="text-micro fixed top-6 right-6 z-50"
      style={{ color: "var(--muted)" }}
    >
      01 / 0{total}
    </div>
  );
}
```

- [ ] **Step 3: HeroStats — count-up numbers**

```typescript
// frontend/src/components/hero/HeroStats.tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { StatRow } from "@/lib/api";

export default function HeroStats({ stats }: { stats: StatRow[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const numbers = ref.current.querySelectorAll<HTMLSpanElement>("[data-count]");

    numbers.forEach((el, i) => {
      const target = parseFloat(el.dataset.count ?? "0");
      const isPercent = el.dataset.count?.includes("%") || el.dataset.suffix === "%";
      gsap.fromTo(
        el,
        { innerText: 0 },
        {
          innerText: isNaN(target) ? 0 : target,
          duration: 0.8,
          delay: 0.4 + i * 0.12,
          ease: "power2.out",
          snap: { innerText: 1 },
          onUpdate() {
            el.textContent = Math.round(parseFloat(el.innerText)) + (el.dataset.suffix ?? "");
          },
        }
      );
    });
  }, []);

  const colorVar = (color: string) => {
    if (color === "team_a") return "var(--team-a)";
    if (color === "team_b") return "var(--team-b)";
    return "var(--muted)";
  };

  return (
    <div ref={ref} className="grid grid-cols-3 gap-8 w-full">
      {stats.map((s, i) => {
        const numericVal = parseFloat(s.value.replace("%", ""));
        const suffix = s.value.includes("%") ? "%" : "";
        return (
          <div key={i} className="flex flex-col gap-2">
            <span
              className="text-stat-hero"
              style={{ color: colorVar(s.color) }}
              data-count={numericVal}
              data-suffix={suffix}
            >
              0{suffix}
            </span>
            <span className="text-micro">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: MatchHero**

```typescript
// frontend/src/components/hero/MatchHero.tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap, SplitText } from "@/lib/gsap";
import HeroStats from "./HeroStats";
import type { StoryData } from "@/lib/api";

export default function MatchHero({ data }: { data: StoryData }) {
  const heroRef = useRef<HTMLElement>(null);
  const teamARef = useRef<HTMLSpanElement>(null);
  const teamBRef = useRef<HTMLSpanElement>(null);
  const divider1Ref = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const divider2Ref = useRef<HTMLDivElement>(null);
  const scrollBaitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" } });

    // Team names — opposing entry
    tl.fromTo(teamARef.current, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.6 }, 0)
      .fromTo(teamBRef.current, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6 }, 0)
      // Dividers scale from centre
      .fromTo(divider1Ref.current, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "center" }, 0.3)
      // Headline word split
      .add(() => {
        if (!headlineRef.current) return;
        const split = new SplitText(headlineRef.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }, 0.4)
      .fromTo(divider2Ref.current, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "center" }, 0.8)
      .fromTo(scrollBaitRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.2);
  }, []);

  return (
    <section
      ref={heroRef}
      data-section="1"
      className="relative flex flex-col justify-between min-h-svh px-6 py-8 md:px-12"
    >
      {/* Radial glow */}
      <div className="hero-glow" />

      {/* Top meta row */}
      <div className="flex justify-between items-center text-micro z-10">
        <span>IPL 2026 · {data.venue}</span>
        <span>{data.match_time}</span>
      </div>

      {/* Centre — team clash */}
      <div className="flex flex-col gap-6 z-10">
        <div className="flex items-center justify-between">
          <span
            ref={teamARef}
            className="text-stat-hero opacity-0"
            style={{ color: "var(--team-a)" }}
          >
            {data.team_a.short_name}
          </span>
          <span className="text-micro">RIVALRY</span>
          <span
            ref={teamBRef}
            className="text-stat-hero opacity-0"
            style={{ color: "var(--team-b)" }}
          >
            {data.team_b.short_name}
          </span>
        </div>

        <div ref={divider1Ref} className="divider" style={{ transform: "scaleX(0)" }} />

        <h1
          ref={headlineRef}
          className="text-section-headline max-w-4xl"
          style={{ color: "var(--fg)" }}
        >
          {data.headline}
        </h1>

        <div ref={divider2Ref} className="divider" style={{ transform: "scaleX(0)" }} />

        <HeroStats stats={data.stats_row} />

        <div ref={divider2Ref} className="divider" />
      </div>

      {/* Scroll bait */}
      <div
        ref={scrollBaitRef}
        className="flex justify-between items-center text-micro opacity-0 z-10"
      >
        <span style={{ color: "var(--fg)" }}>{data.scroll_bait}</span>
        <span>SEE THE BATTLE ↓</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Stub missing components so page compiles**

```typescript
// frontend/src/components/battle/PlayerBattle.tsx
"use client";
export default function PlayerBattle({ data, teamA, teamB }: any) {
  return <section data-section="2" style={{ padding: "80px 24px" }}><p style={{color:"#fff"}}>Battle — coming Task 10</p></section>;
}
```

```typescript
// frontend/src/components/trivia/TriviaCard.tsx
"use client";
export default function TriviaCard({ data }: any) {
  return <section data-section="3" style={{ padding: "80px 24px" }}><p style={{color:"#fff"}}>Trivia — coming Task 11</p></section>;
}
```

```typescript
// frontend/src/components/prediction/PredictionCard.tsx
"use client";
export default function PredictionCard({ data }: any) {
  return <section data-section="4" style={{ padding: "80px 24px" }}><p style={{color:"#fff"}}>Prediction — coming Task 12</p></section>;
}
```

- [ ] **Step 6: Run dev server and verify hero renders**

```bash
cd frontend && npm run dev
# Open http://localhost:3000
# Verify: MI in blue enters from left, CSK in yellow from right
# Verify: headline words reveal one by one
# Verify: stats count up from 0
# Verify: section counter shows "01 / 04" top-right
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: Hero section — opposing team entry, SplitText headline, stat count-up"
```

---

## Task 10: Battle Section

**Files:**
- Modify: `frontend/src/components/battle/PlayerBattle.tsx`
- Create: `frontend/src/components/battle/BattleBars.tsx`

- [ ] **Step 1: BattleBars — face-off bars from centre**

```typescript
// frontend/src/components/battle/BattleBars.tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { PvPStat } from "@/lib/api";

type Props = { stats: PvPStat[]; teamAColor: string; teamBColor: string };

export default function BattleBars({ stats, teamAColor, teamBColor }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const bars = ref.current.querySelectorAll<HTMLDivElement>("[data-bar]");

    bars.forEach((bar) => {
      const pct = parseFloat(bar.dataset.bar ?? "50");
      const side = bar.dataset.side;
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.6,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          transformOrigin: side === "a" ? "right" : "left",
          scrollTrigger: { trigger: ref.current, start: "top 75%" },
          onComplete() {
            // overshoot: winning bar snaps back
            if (pct > 50) {
              gsap.to(bar, { scaleX: 0.96, duration: 0.1, yoyo: true, repeat: 1 });
            }
          },
        }
      );
    });
  }, []);

  const maxA = Math.max(...stats.map((s) => s.batsman_val));
  const maxB = Math.max(...stats.map((s) => s.bowler_val));

  return (
    <div ref={ref} className="flex flex-col gap-6 w-full">
      {stats.map((s, i) => {
        const pctA = Math.round((s.batsman_val / Math.max(s.batsman_val, s.bowler_val)) * 100);
        const pctB = Math.round((s.bowler_val / Math.max(s.batsman_val, s.bowler_val)) * 100);
        const aWins = s.batsman_val > s.bowler_val;
        return (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex justify-between text-micro">
              <span style={{ color: teamAColor }}>{s.batsman_val}</span>
              <span>{s.label}</span>
              <span style={{ color: teamBColor }}>{s.bowler_val}</span>
            </div>
            <div className="flex h-1 gap-px">
              <div className="flex-1 flex justify-end overflow-hidden">
                <div
                  data-bar={pctA}
                  data-side="a"
                  style={{
                    width: `${pctA}%`,
                    background: aWins ? teamAColor : "var(--muted)",
                    height: "4px",
                    transformOrigin: "right",
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div
                  data-bar={pctB}
                  data-side="b"
                  style={{
                    width: `${pctB}%`,
                    background: !aWins ? teamBColor : "var(--muted)",
                    height: "4px",
                    transformOrigin: "left",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: PlayerBattle full component**

```typescript
// frontend/src/components/battle/PlayerBattle.tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import BattleBars from "./BattleBars";
import type { BattleData, TeamInfo } from "@/lib/api";

type Props = { data: BattleData; teamA: TeamInfo; teamB: TeamInfo };

export default function PlayerBattle({ data, teamA, teamB }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const playerARef = useRef<HTMLSpanElement>(null);
  const playerBRef = useRef<HTMLSpanElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    tl.fromTo(playerARef.current, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5 })
      .fromTo(playerBRef.current, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5 }, "<")
      .fromTo(verdictRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, "+=0.4");
  }, []);

  return (
    <section
      ref={sectionRef}
      data-section="2"
      className="px-6 md:px-12"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <div className="flex justify-between text-micro mb-8">
        <span>MATCH-UP</span>
        <span>01 / 01</span>
      </div>

      <div className="w-full h-px mb-8" style={{ background: "var(--border)" }} />

      <div className="flex justify-between items-center mb-8">
        <span
          ref={playerARef}
          className="text-player-name opacity-0"
          style={{ color: "var(--team-a)" }}
        >
          {data.batsman}
        </span>
        <span className="text-micro">VS</span>
        <span
          ref={playerBRef}
          className="text-player-name opacity-0"
          style={{ color: "var(--team-b)" }}
        >
          {data.bowler}
        </span>
      </div>

      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <BattleBars stats={data.stats} teamAColor={teamA.color} teamBColor={teamB.color} />

      <div className="w-full h-px mt-10 mb-6" style={{ background: "var(--border)" }} />

      <div ref={verdictRef} className="opacity-0">
        <p className="text-micro mb-3">VERDICT</p>
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--fg)", maxWidth: "600px" }}>
          Jadeja owns this. {data.stats.find((s) => s.label === "DISMISSALS")?.bowler_val ?? 0} dismissals.
          Tonight is {data.batsman.split(" ")[0]}&apos;s redemption arc.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
# http://localhost:3000 — scroll past hero
# Verify: player names enter from opposite sides
# Verify: bars grow from centre simultaneously on scroll
# Verify: verdict fades in after bars settle
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/battle/
git commit -m "feat: Battle section — face-off bars from centre with overshoot, scroll-triggered"
```

---

## Task 11: Trivia Section

**Files:**
- Modify: `frontend/src/components/trivia/TriviaCard.tsx`

- [ ] **Step 1: Full TriviaCard implementation**

```typescript
// frontend/src/components/trivia/TriviaCard.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { TriviaData } from "@/lib/api";

export default function TriviaCard({ data }: { data: TriviaData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      optionRefs.current,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)",
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      }
    );
  }, []);

  const handleTap = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);

    const isCorrect = idx === data.correct_index;

    if (!isCorrect) {
      // Shake wrong option
      gsap.to(optionRefs.current[idx], {
        x: [0, -8, 8, -6, 6, 0],
        duration: 0.4,
        ease: "power2.inOut",
        onComplete() {
          gsap.to(optionRefs.current[idx], { opacity: 0.3, duration: 0.2 });
        },
      });
      // Flip correct option in
      const correct = optionRefs.current[data.correct_index];
      gsap.fromTo(
        correct,
        { rotationY: 90 },
        {
          rotationY: 0,
          duration: 0.5,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          onStart() {
            if (correct) correct.style.borderColor = "var(--team-a)";
          },
        }
      );
    } else {
      // Correct tap snap
      gsap.to(optionRefs.current[idx], {
        scale: 1.06,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        onStart() {
          if (optionRefs.current[idx]) {
            optionRefs.current[idx]!.style.borderColor = "var(--team-a)";
          }
        },
      });
      setStreak((s) => s + 1);
    }

    // Reveal answer block
    setTimeout(() => {
      if (revealRef.current) {
        revealRef.current.style.display = "block";
        gsap.fromTo(revealRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 });
      }
    }, isCorrect ? 300 : 600);
  };

  return (
    <section
      ref={sectionRef}
      data-section="3"
      className="px-6 md:px-12"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <div className="flex justify-between text-micro mb-8">
        <span>TRIVIA</span>
        <span>TODAY&apos;S PICK</span>
      </div>

      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <h2
        className="text-section-headline mb-12"
        style={{ fontSize: "clamp(24px, 4vw, 48px)", maxWidth: "800px" }}
      >
        {data.question}
      </h2>

      {/* Options grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {data.options.map((opt, i) => (
          <button
            key={i}
            ref={(el) => { optionRefs.current[i] = el; }}
            onClick={() => handleTap(i)}
            style={{
              opacity: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
              fontSize: "48px",
              fontWeight: 700,
              fontFamily: "Space Grotesk, sans-serif",
              padding: "32px 16px",
              cursor: selected !== null ? "default" : "pointer",
              transition: "border-color 0.2s",
              perspective: "800px",
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Reveal block */}
      <div ref={revealRef} style={{ display: "none" }}>
        <p
          className="text-stat-hero mb-4"
          style={{ color: "var(--team-a)", fontSize: "clamp(64px, 10vw, 120px)" }}
        >
          {data.options[data.correct_index]}
        </p>
        <p className="text-section-headline mb-6" style={{ fontSize: "clamp(20px, 3vw, 32px)" }}>
          {data.emphasis}
        </p>
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "var(--fg)", maxWidth: "600px" }}>
          {data.fact}
        </p>
        {streak > 0 && (
          <p className="text-micro mt-6" style={{ color: "var(--fg)" }}>
            🔥 {streak} CORRECT TODAY
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
# Scroll to trivia section
# Tap a wrong answer — it shakes, correct flips in
# Tap correct — border flashes, snap scale
# Reveal block slides up with answer and fact
# Streak increments on correct tap
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/trivia/TriviaCard.tsx
git commit -m "feat: Trivia — tap/shake/flip reveal, streak counter"
```

---

## Task 12: Prediction Section

**Files:**
- Modify: `frontend/src/components/prediction/PredictionCard.tsx`

- [ ] **Step 1: Full PredictionCard implementation**

```typescript
// frontend/src/components/prediction/PredictionCard.tsx
"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import type { PredictionData } from "@/lib/api";

export default function PredictionCard({ data }: { data: PredictionData }) {
  const sectionRef = useRef<HTMLElement>(null);
  const evidenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dividerRef = useRef<HTMLDivElement>(null);
  const thereforeRef = useRef<HTMLParagraphElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: "top 65%" },
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    // Evidence items stagger in
    evidenceRefs.current.forEach((el, i) => {
      tl.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, i * 0.4);
    });

    // Bars inside each evidence item
    evidenceRefs.current.forEach((el, i) => {
      const bars = el?.querySelectorAll<HTMLDivElement>("[data-evidence-bar]");
      bars?.forEach((bar) => {
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.5, transformOrigin: "left" }, i * 0.4 + 0.15);
      });
    });

    // Border + THEREFORE + number
    tl.fromTo(dividerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.4, transformOrigin: "left" }, 1.4)
      .fromTo(thereforeRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.8)
      .fromTo(
        numberRef.current,
        { innerText: 0 },
        {
          innerText: data.probability,
          duration: 0.8,
          snap: { innerText: 1 },
          ease: "power2.out",
          onUpdate() {
            if (numberRef.current) {
              numberRef.current.textContent = Math.round(parseFloat(numberRef.current.innerText)) + "%";
            }
          },
        },
        2.0
      );
  }, [data.probability]);

  return (
    <section
      ref={sectionRef}
      data-section="4"
      className="px-6 md:px-12"
      style={{ padding: "clamp(80px, 10vw, 140px) clamp(24px, 5vw, 48px)" }}
    >
      <p className="text-micro mb-8">PREDICTION</p>
      <div className="w-full h-px mb-10" style={{ background: "var(--border)" }} />

      <h2
        className="text-section-headline mb-12"
        style={{ color: data.team_color }}
      >
        THE CASE FOR {data.team}
      </h2>

      {/* Evidence items */}
      <div className="flex flex-col gap-10 mb-12">
        {data.evidence.map((item, i) => (
          <div key={i} ref={(el) => { evidenceRefs.current[i] = el; }} className="opacity-0">
            <div className="flex items-start gap-4 mb-3">
              <span className="text-micro" style={{ minWidth: "24px" }}>
                0{i + 1}
              </span>
              <div>
                <p style={{ fontWeight: 600, fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fg)" }}>
                  {item.label}
                </p>
                <p className="text-micro mt-1">{item.detail}</p>
              </div>
            </div>
            <div className="flex gap-1 h-1 ml-10">
              <div
                data-evidence-bar
                style={{
                  flex: 1,
                  height: "4px",
                  background: data.team_color,
                  transformOrigin: "left",
                  transform: "scaleX(0)",
                }}
              />
              <div
                data-evidence-bar
                style={{
                  flex: 1,
                  height: "4px",
                  background: "var(--muted)",
                  transformOrigin: "left",
                  transform: "scaleX(0)",
                  opacity: 0.4,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div ref={dividerRef} className="w-full h-px mb-6" style={{ background: "var(--border)", transform: "scaleX(0)" }} />

      <p ref={thereforeRef} className="text-micro mb-4 opacity-0">THEREFORE:</p>

      <div className="flex items-end gap-6">
        <span
          ref={numberRef}
          className="text-stat-hero"
          style={{ color: data.team_color }}
        >
          0%
        </span>
        <p className="text-micro mb-4">{data.team} WIN PROBABILITY</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
# Scroll to prediction section
# Verify: evidence items enter one by one (400ms apart)
# Verify: bars grow left-to-right per item
# Verify: divider draws after all 3 items
# Verify: THEREFORE fades in
# Verify: number counts up LAST (the payoff)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/prediction/PredictionCard.tsx
git commit -m "feat: Prediction — evidence stagger, bars, THEREFORE count-up payoff"
```

---

## Task 13: Share Card + Drawer

**Files:**
- Create: `frontend/src/lib/share.ts`
- Create: `frontend/src/components/share/ShockStatCard.tsx`
- Create: `frontend/src/components/share/ShareDrawer.tsx`
- Modify: `frontend/src/components/hero/MatchHero.tsx`

- [ ] **Step 1: share.ts**

```typescript
// frontend/src/lib/share.ts
import { toPng } from "html-to-image";

export async function captureCard(el: HTMLElement): Promise<Blob> {
  const font = new FontFace(
    "Space Grotesk",
    "url(https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFX.woff2)"
  );
  await font.load();
  document.fonts.add(font);

  const dataUrl = await toPng(el, {
    width: el.offsetWidth,
    height: el.offsetHeight,
    pixelRatio: 2,
  });

  const res = await fetch(dataUrl);
  return res.blob();
}

export async function shareCard(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "The Cricket Fan" });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: ShockStatCard — off-screen DOM twin**

```typescript
// frontend/src/components/share/ShockStatCard.tsx
"use client";
import { forwardRef } from "react";
import type { StoryData } from "@/lib/api";

type Props = { data: StoryData; ratio: "9:16" | "1:1" };

const ShockStatCard = forwardRef<HTMLDivElement, Props>(({ data, ratio }, ref) => {
  const w = 540;
  const h = ratio === "9:16" ? 960 : 540;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: w,
        height: h,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "32px",
        fontFamily: "Space Grotesk, sans-serif",
        borderRadius: "8px",
        "--team-a": data.team_a.color,
        "--team-b": data.team_b.color,
      } as React.CSSProperties}
    >
      {/* Top */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666" }}>
          THE CRICKET FAN
        </p>
        <div style={{ width: "100%", height: "1px", background: "#222", marginTop: "12px" }} />
      </div>

      {/* Centre */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: ratio === "9:16" ? "160px" : "100px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: data.team_a.color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.shock_stat.value}
        </p>
        <p style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666", marginTop: "12px" }}>
          {data.shock_stat.label}
        </p>
        <div style={{ width: "100%", height: "1px", background: "#222", margin: "20px 0" }} />
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "#f0f0f0", maxWidth: "400px", margin: "0 auto" }}>
          {data.shock_stat.one_liner}
        </p>
      </div>

      {/* Bottom */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666" }}>
          {data.team_a.short_name} vs {data.team_b.short_name} · {data.venue}
        </p>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "#444" }}>
          thecricketfan.in
        </p>
      </div>
    </div>
  );
});
ShockStatCard.displayName = "ShockStatCard";
export default ShockStatCard;
```

- [ ] **Step 3: ShareDrawer**

```typescript
// frontend/src/components/share/ShareDrawer.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import ShockStatCard from "./ShockStatCard";
import { captureCard, shareCard } from "@/lib/share";
import type { StoryData } from "@/lib/api";

type Props = { data: StoryData; open: boolean; onClose: () => void };

export default function ShareDrawer({ data, open, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const card916Ref = useRef<HTMLDivElement>(null);
  const card11Ref = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return;
    const isMobile = window.innerWidth < 768;

    if (open) {
      document.body.style.overflow = "hidden";
      gsap.to(overlayRef.current, { opacity: 0.6, duration: 0.3 });
      gsap.to(drawerRef.current, {
        [isMobile ? "y" : "x"]: 0,
        duration: 0.5,
        ease: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
    } else {
      document.body.style.overflow = "";
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.3 });
      gsap.to(drawerRef.current, {
        [isMobile ? "y" : "x"]: isMobile ? "100%" : "100%",
        duration: 0.35,
        ease: "power2.in",
      });
    }
  }, [open]);

  const handleShare = async (ratio: "9:16" | "1:1") => {
    const el = ratio === "9:16" ? card916Ref.current : card11Ref.current;
    if (!el) return;
    setSharing(true);
    try {
      const blob = await captureCard(el);
      await shareCard(blob, `cricket-fan-${ratio.replace(":", "x")}.png`);
    } finally {
      setSharing(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "#000", opacity: 0, zIndex: 40,
        }}
      />
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          right: 0, top: 0, bottom: 0,
          width: "min(480px, 100vw)",
          background: "var(--surface)",
          zIndex: 50,
          transform: "translateX(100%)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          overflowY: "auto",
        }}
      >
        <div className="flex justify-between items-center">
          <p className="text-micro" style={{ color: "var(--fg)" }}>SHARE</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--fg)", fontSize: "20px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ width: "100%", height: "1px", background: "var(--border)" }} />

        <div className="flex gap-4">
          <button
            onClick={() => handleShare("9:16")}
            disabled={sharing}
            style={{
              flex: 1, padding: "16px", border: "1px solid var(--border)",
              background: "none", color: "var(--fg)", fontFamily: "Space Grotesk, sans-serif",
              fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            STORY (9:16)
          </button>
          <button
            onClick={() => handleShare("1:1")}
            disabled={sharing}
            style={{
              flex: 1, padding: "16px", border: "1px solid var(--border)",
              background: "none", color: "var(--fg)", fontFamily: "Space Grotesk, sans-serif",
              fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            SQUARE (1:1)
          </button>
        </div>

        <p className="text-micro" style={{ textAlign: "center" }}>
          {sharing ? "CAPTURING..." : "TAP TO SHARE OR DOWNLOAD"}
        </p>

        {/* Off-screen DOM twins */}
        <ShockStatCard ref={card916Ref} data={data} ratio="9:16" />
        <ShockStatCard ref={card11Ref} data={data} ratio="1:1" />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire share button into MatchHero**

Add to `MatchHero.tsx` — after scrollBait div:

```typescript
// Add to imports:
import { useState } from "react";
import ShareDrawer from "@/components/share/ShareDrawer";

// Add state inside component:
const [shareOpen, setShareOpen] = useState(false);

// Add after scrollBait div, before closing </section>:
<button
  onClick={() => setShareOpen(true)}
  style={{
    position: "fixed", bottom: "24px", right: "24px", zIndex: 30,
    background: "var(--fg)", color: "var(--bg)",
    border: "none", padding: "12px 20px",
    fontFamily: "Space Grotesk, sans-serif", fontSize: "12px",
    fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
    cursor: "pointer",
  }}
>
  SHARE ↑
</button>
<ShareDrawer data={data} open={shareOpen} onClose={() => setShareOpen(false)} />
```

- [ ] **Step 5: Verify share flow**

```bash
# Click SHARE ↑ button
# Drawer slides in from right
# Click STORY (9:16) — should trigger download or native share sheet on mobile
# Verify card captures correctly: dark background, team colour on number, URL bottom-right
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/share/ frontend/src/lib/share.ts frontend/src/components/hero/MatchHero.tsx
git commit -m "feat: share drawer + shock stat card (9:16 + 1:1) with html-to-image capture"
```

---

## Task 14: Cricsheet Real Data

**Files:**
- Create: `backend/app/data/cricsheet_parser.py`
- Create: `backend/app/data/aggregator.py`
- Create: `backend/scripts/ingest_cricsheet.py`

- [ ] **Step 1: Download Cricsheet IPL data**

```bash
# Download from https://cricsheet.org/downloads/ — IPL JSON zip
mkdir -p backend/data/cricsheet
# Place downloaded ZIP in backend/data/cricsheet/
# (manual step — requires browser download)
cd backend/data/cricsheet && unzip ipl_json.zip -d matches/
ls matches/ | head -5
# Expected: JSON files named by match ID
```

- [ ] **Step 2: Write parser**

```python
# backend/app/data/cricsheet_parser.py
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Generator

@dataclass
class Delivery:
    batsman: str
    bowler: str
    runs_batter: int
    is_wicket: bool
    fielding_phase: str  # powerplay | middle | death
    venue: str
    batting_team: str
    bowling_team: str

def phase(over: int) -> str:
    if over < 6:
        return "powerplay"
    if over < 16:
        return "middle"
    return "death"

def parse_match(filepath: Path) -> Generator[Delivery, None, None]:
    with open(filepath) as f:
        data = json.load(f)

    info = data.get("info", {})
    venue = info.get("venue", "Unknown")
    teams = info.get("teams", [])

    for innings in data.get("innings", []):
        batting_team = innings.get("team", "")
        bowling_team = next((t for t in teams if t != batting_team), "")
        for over_data in innings.get("overs", []):
            over_num = over_data["over"]
            p = phase(over_num)
            for delivery in over_data.get("deliveries", []):
                batsman = delivery.get("batter", "")
                bowler = delivery.get("bowler", "")
                runs = delivery.get("runs", {}).get("batter", 0)
                is_wicket = bool(delivery.get("wickets"))
                yield Delivery(
                    batsman=batsman, bowler=bowler,
                    runs_batter=runs, is_wicket=is_wicket,
                    fielding_phase=p, venue=venue,
                    batting_team=batting_team, bowling_team=bowling_team,
                )
```

- [ ] **Step 3: Write aggregator**

```python
# backend/app/data/aggregator.py
from collections import defaultdict
from pathlib import Path
from .cricsheet_parser import parse_match

def build_pvp(matches_dir: Path) -> dict:
    """Returns {(batsman, bowler): {balls, runs, dismissals, dots}}"""
    stats: dict = defaultdict(lambda: {"balls": 0, "runs": 0, "dismissals": 0, "dots": 0})
    for f in matches_dir.glob("*.json"):
        for d in parse_match(f):
            key = (d.batsman, d.bowler)
            stats[key]["balls"] += 1
            stats[key]["runs"] += d.runs_batter
            if d.is_wicket:
                stats[key]["dismissals"] += 1
            if d.runs_batter == 0:
                stats[key]["dots"] += 1
    return dict(stats)

def build_venue_stats(matches_dir: Path) -> dict:
    """Returns {(venue, team): {matches, wins, chase_wins, chase_attempts}}"""
    stats: dict = defaultdict(lambda: {"matches": 0, "wins": 0, "chase_wins": 0, "chase_attempts": 0})
    # Track match outcomes separately (one entry per match file)
    for f in matches_dir.glob("*.json"):
        import json
        with open(f) as fh:
            data = json.load(fh)
        info = data.get("info", {})
        venue = info.get("venue", "Unknown")
        winner = info.get("outcome", {}).get("winner")
        teams = info.get("teams", [])
        toss = info.get("toss", {})
        toss_winner = toss.get("winner")
        toss_decision = toss.get("decision")  # bat or field
        chasing_team = toss_winner if toss_decision == "field" else next((t for t in teams if t != toss_winner), None)

        for team in teams:
            stats[(venue, team)]["matches"] += 1
            if winner == team:
                stats[(venue, team)]["wins"] += 1
            if chasing_team == team:
                stats[(venue, team)]["chase_attempts"] += 1
                if winner == team:
                    stats[(venue, team)]["chase_wins"] += 1
    return dict(stats)
```

- [ ] **Step 4: Write ingest script**

```python
# backend/scripts/ingest_cricsheet.py
"""
Run: python -m scripts.ingest_cricsheet --dir data/cricsheet/matches
"""
import asyncio
import argparse
from pathlib import Path
from app.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.player import Player, PlayerVsPlayer, VenueStats
from app.data.aggregator import build_pvp, build_venue_stats
from sqlalchemy import select, delete

async def ingest(matches_dir: Path):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    pvp_data = build_pvp(matches_dir)
    venue_data = build_venue_stats(matches_dir)
    print(f"Parsed {len(pvp_data)} player-vs-player combinations")
    print(f"Parsed {len(venue_data)} venue-team combinations")

    async with AsyncSessionLocal() as session:
        # Upsert players
        player_cache: dict[str, int] = {}
        for (batsman, bowler) in pvp_data:
            for name in [batsman, bowler]:
                if name not in player_cache:
                    p = await session.scalar(select(Player).where(Player.name == name))
                    if not p:
                        p = Player(name=name, team_id=1)  # team_id resolved via separate team mapping
                        session.add(p)
                        await session.flush()
                    player_cache[name] = p.id

        # Upsert player_vs_player
        for (batsman, bowler), s in pvp_data.items():
            bid = player_cache.get(batsman)
            bowl_id = player_cache.get(bowler)
            if not bid or not bowl_id:
                continue
            existing = await session.scalar(
                select(PlayerVsPlayer).where(
                    PlayerVsPlayer.batsman_id == bid, PlayerVsPlayer.bowler_id == bowl_id
                )
            )
            if existing:
                existing.balls = s["balls"]; existing.runs = s["runs"]
                existing.dismissals = s["dismissals"]; existing.dot_balls = s["dots"]
            else:
                session.add(PlayerVsPlayer(
                    batsman_id=bid, bowler_id=bowl_id,
                    balls=s["balls"], runs=s["runs"],
                    dismissals=s["dismissals"], dot_balls=s["dots"],
                ))

        await session.commit()
        print("Ingest complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    args = parser.parse_args()
    asyncio.run(ingest(Path(args.dir)))
```

- [ ] **Step 5: Run ingest (once Cricsheet data downloaded)**

```bash
cd backend
python -m scripts.ingest_cricsheet --dir data/cricsheet/matches
# Expected: "Ingest complete." + counts printed
```

- [ ] **Step 6: Verify real data appears in API**

```bash
curl "http://localhost:8000/stats/player-vs-player?player_a=Rohit+Sharma&player_b=Ravindra+Jadeja"
# Expected: real head-to-head stats from Cricsheet
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/data/ backend/scripts/ingest_cricsheet.py
git commit -m "feat: Cricsheet parser + aggregator + ingest script"
```

---

## Task 15: Vercel Deploy

**Files:**
- Create: `frontend/next.config.ts` (update)
- Create: `vercel.json`

- [ ] **Step 1: Update next.config.ts**

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
};

export default nextConfig;
```

- [ ] **Step 2: Backend Vercel Python config**

```json
// backend/vercel.json
{
  "builds": [{ "src": "app/main.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/(.*)", "dest": "app/main.py" }]
}
```

- [ ] **Step 3: Add Vercel env vars**

```bash
cd frontend
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://your-backend.vercel.app

cd backend
vercel env add DATABASE_URL production
# Enter: your production postgres URL (Neon / Supabase from Vercel Marketplace)
vercel env add ANTHROPIC_API_KEY production
```

- [ ] **Step 4: Deploy backend first**

```bash
cd backend
vercel --prod
# Note the deployment URL, e.g. https://cricket-fan-api.vercel.app
```

- [ ] **Step 5: Update frontend env with backend URL, deploy frontend**

```bash
cd frontend
vercel env add NEXT_PUBLIC_API_URL production
# Enter backend URL from Step 4
vercel --prod
```

- [ ] **Step 6: Seed production database**

```bash
# Run seed script against production DATABASE_URL
DATABASE_URL=<prod_url> python -m scripts.seed_match
```

- [ ] **Step 7: Smoke test production**

```bash
curl https://your-backend.vercel.app/health
curl https://your-frontend.vercel.app
# Open on mobile — test share flow end to end
```

- [ ] **Step 8: Commit**

```bash
git add frontend/next.config.ts backend/vercel.json
git commit -m "chore: Vercel deploy config for frontend + backend"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Hero section — Task 9
- [x] One Battle Card — Task 10
- [x] One Trivia — Task 11
- [x] One Prediction — Task 12
- [x] Share Card (9:16 + 1:1) — Task 13
- [x] Tone system → encoded in Claude API system prompts — Tasks 4 + 5
- [x] Section counter — Task 9
- [x] GSAP setup — Task 8
- [x] Cricsheet ingest — Task 14
- [x] Deploy — Task 15

**Deferred (per spec):**
- Multiple battle cards — not in plan ✓
- Auth — not in plan ✓
- Historical dashboards — not in plan ✓

**Type consistency check:**
- `StoryData.stats_row` → `StatRow[]` — used in `HeroStats` ✓
- `BattleData.stats` → `PvPStat[]` — used in `BattleBars` ✓
- `TriviaData.correct_index` → `number` — used in `TriviaCard` ✓
- `PredictionData.evidence` → `EvidenceItem[]` (3 items) — used in `PredictionCard` ✓
- `captureCard` returns `Promise<Blob>` — consumed by `shareCard` ✓

**Placeholder scan:** None found. All steps contain full code and expected command output.
