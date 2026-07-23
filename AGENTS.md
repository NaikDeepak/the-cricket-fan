# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working in this repository.

---

## PROJECT: The Cricket Fan

> Stack: Next.js 16 / React 19 / Tailwind v4 (frontend) + FastAPI / Python 3.12 / PostgreSQL (backend)
> Purpose: Fan-first IPL web app — daily match stories, player battles, trivia, explainable predictions
> Owner: Deepak Naik | Role: Architect
> Deployment: Vercel (frontend) + Vercel Fluid Compute (backend)
> Started: 2026-04-24

---

## ARCHITECTURE

```
the-cricket-fan/
├── backend/
│   ├── app/
│   │   ├── api/        # FastAPI route handlers (one file per domain)
│   │   ├── models/     # SQLAlchemy async ORM models
│   │   ├── services/   # Business logic: story generator, trivia, prediction
│   │   ├── data/       # Cricsheet JSON parsers + aggregation pipelines
│   │   └── main.py     # FastAPI app, lifespan, CORS, router mounting
│   ├── scripts/        # One-off data import / backfill scripts
│   └── tests/          # pytest-asyncio tests
└── frontend/
    └── src/app/        # Next.js 16 App Router — page.tsx + layout.tsx
```

**Data flow:** Cricsheet JSON → `backend/app/data/` parsers → PostgreSQL (pre-aggregated tables) → FastAPI services → JSON API → Next.js server components / client components

**Key tables to precompute:** `player_vs_player`, `venue_stats`, `phase_stats` (powerplay / middle / death). All heavy aggregation happens at ingest time via `backend/scripts/`, not at request time.

**Story generation:** `backend/app/services/story_service.py` calls the Gemini API to produce match narratives, trivia questions, and prediction reasoning. This is the only LLM call path — it wraps pre-aggregated stats in a structured prompt and returns typed JSON.

**Prediction engine:** Weighted factor scoring (recent form, venue advantage, player matchups) — no ML. Logic lives in `backend/app/services/prediction_service.py`.

---

## API ENDPOINTS

| Endpoint | Description |
|---|---|
| `GET /match-story/today` | Narrative, key battle, 2–3 insights for today's match |
| `GET /stats/player-vs-player` | Head-to-head stats between any two players |
| `GET /stats/venue` | Venue trends (avg score, chasing win %, pitch type) |
| `GET /trivia/today` | 1 question, 4 options, answer + fun explanation |
| `GET /prediction/today` | Win probability + reasoning array (no black-box ML) |

---

## COMMANDS

### One-shot dev environment (preferred)

The `feature/mvp` worktree at `.worktrees/mvp/` contains `dev.sh` and `docker-compose.yml`. From that directory:

```bash
# Start Postgres + seed data + backend (8000) + frontend (3000) in one shot
bash dev.sh
```

API docs are available at `http://localhost:8000/docs` while the server is running.

### Backend (manual)

```bash
cd backend

# Start local Postgres (required before running the backend)
docker compose -f ../.worktrees/mvp/docker-compose.yml up -d db

# Create virtual env and install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Seed dev data (run once after migrations)
python -m scripts.seed_schedule       # 70 fixtures, 10 teams
python -m scripts.ingest_cricsheet    # player stats, PvP, venue

# Run dev server
uvicorn app.main:app --reload --port 8000

# Run all tests  (asyncio_mode = "auto" — no @pytest.mark.asyncio needed)
pytest

# Run a single test file
pytest tests/test_story_service.py -v

# Run a single test
pytest tests/test_story_service.py::test_generate_headline -v

# Lint
ruff check app/ tests/
ruff format app/ tests/
```

### Frontend

```bash
cd frontend

npm install
npm run dev        # localhost:3000
npm run build
npm run lint
```

---

## CODING STANDARDS

### Backend (Python)
- Line length: 99 chars (ruff enforced)
- Async everywhere: use `async def` for all route handlers and service methods
- Pydantic v2 models for all request/response shapes
- SQLAlchemy 2.0 async session pattern — never use sync `Session`
- Do not call the Anthropic API on every request — cache story/trivia results in DB for the day

### Frontend (TypeScript / Next.js)
- **Next.js 16 has breaking changes from prior versions.** Before writing any Next.js code, check `frontend/node_modules/next/dist/docs/` for current API. Do not rely on training-data knowledge of Next.js conventions.
- App Router only — no `pages/` directory
- Tailwind CSS v4 — class syntax may differ from v3; check docs
- GSAP for all animations (stats appear progressively, hover micro-interactions)
- No tables in UI — use cards, gradients, motion components
- Dark theme with neon / stadium lighting feel; smooth scroll storytelling
- `clsx` + `tailwind-merge` for conditional class logic

### Planned frontend components (not yet built)
- `MatchHero` — today's match with narrative headline
- `PlayerBattleCard` — head-to-head player stats
- `AnimatedStatGraph` — motion-driven stat visualization
- `TriviaCard` — interactive guess → reveal
- `PredictionCard` — win probability + reasoning bullets
- Shareable export card (Instagram / WhatsApp branding) — placeholder branding for now

---

## ENVIRONMENT VARIABLES

See `.env.example` (root) and `.worktrees/mvp/.env.example` (more complete). Required:
- `GEMINI_API_KEY` — Gemini SDK (story/trivia generation)
- `DATABASE_URL` (asyncpg format: `postgresql+asyncpg://...`; local default: `postgresql+asyncpg://cricket:cricket@localhost:5433/cricket_fan`)
- `NEXT_PUBLIC_API_URL` (frontend → backend; local default: `http://localhost:8000`)
- `ENVIRONMENT` — `development` or `production`
- `SENTRY_DSN` — optional observability

---

## NON-GOALS

- No historical dashboards or data explorer
- No auth / login (Phase 1 is public-only)
- No ML models — prediction is weighted factor scoring only
- No real-time WebSocket (Phase 1)
- No raw data tables in the UI

---

## SKILLS IN USE THIS PROJECT

| When | Skill |
|---|---|
| Architecture / feature design | `superpowers:brainstorming` |
| Planning features | `superpowers:writing-plans` → `superpowers:executing-plans` |
| All feature / bug work | `superpowers:test-driven-development` |
| UI / React components | `frontend-design:frontend-design` |
| Anthropic SDK usage | `Codex-api` |
| Vercel deploy / config | `vercel:nextjs`, `vercel:deploy`, `vercel:env-vars` |
| Before merging | `superpowers:requesting-code-review` |
| Branch ready to ship | `superpowers:finishing-a-development-branch` |
| End of session | `Codex-md-management:revise-Codex-md` |

---

## SESSION LOG

| Date | Goal | Key Decisions | Next |
|---|---|---|---|
| 2026-04-24 | Project init | FastAPI + Next.js 16 monorepo; Vercel for both; Codex API for story generation; no ML for predictions | Implement Cricsheet parser + `/match-story/today` endpoint |
| 2026-07-19 | Viability pivot | Fantasy affiliate dead (PROGA + SC ruling). Product = automated X prediction bot: LightGBM (ML rule overridden), GitHub Actions cron, Neon Postgres, CricAPI, X free tier. Web UI parked. Spec + 13-task plan committed in docs/superpowers/ | Execute plan subagent-driven, Task 1 (scaffold+schema) onward |
| 2026-07-23 | Manual Content Composer | Built FastAPI composer backend (`composer/`) + Next.js 16 composer UI (`frontend/src/app/composer/`). Client-side PNG card rendering, 4 content sources, analytics funnel. PR merged into feature/mvp. | Production launch & Vercel deployment pass |

