# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

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
├── bot/                  # ELO prediction engine, cricsheet ingest, X poster
│   ├── predict.py        # ELO-based win-probability scoring
│   ├── ingest.py          # cricsheet.py — match-data ingest
│   ├── db.py              # SQLite/Postgres schema, shared with composer/
│   ├── news_fetcher.py    # match-recap headline fetch (Google News RSS)
│   ├── trivia_standalone.py  # trivia question logic — wired into
│   │                          # composer's /generate/bot (kind=trivia)
│   │                          # and rendered by CardPreview's
│   │                          # TriviaCardImg, same as prediction; no
│   │                          # public surface displays it yet
│   │                          # (tracked below under "Next up")
│   └── scripts/seed_content_bank.py  # hand-authored content bank seed
├── composer/             # FastAPI content tool — reuses bot/db.py's schema
│   ├── app.py
│   ├── routers/          # stories, generate, predictions, posts,
│   │                      # analytics, content_bank, drafts
│   └── gemini.py          # Gemini SDK call site (story/copy generation)
├── frontend/
│   └── src/app/
│       ├── stories/       # public Vault — /stories, /stories/[contentKey]
│       └── composer/      # internal tool UI — /composer, /composer/{posts,predictions,analytics}
└── backend/app/          # LEGACY — not on the live path. FastAPI app with
                            # its own story/prediction/trivia services from
                            # the original pre-pivot architecture. Superseded
                            # by bot/ + composer/. Kept in the tree, not
                            # deleted, pending confirmation nothing in it
                            # gets reused once the trivia/prediction next-up
                            # cycles land. Do not build new features here.
```

**Data flow:** Cricsheet JSON → `bot/cricsheet.py` / `bot/ingest.py` →
shared DB (`bot/db.py` schema, SQLite locally via `COMPOSER_DATABASE_URL`,
Postgres in prod) → `composer/routers/` → JSON API → Next.js
`frontend/src/app/{stories,composer}`.

**Story generation:** `composer/gemini.py` calls the Gemini API for
draft copy (not Anthropic). Composer caches results as drafts in the DB
rather than regenerating on every request.

**Prediction engine:** `bot/predict.py` — ELO-based win-probability
scoring, no ML. `composer/routers/predictions.py` exposes it to the
Composer UI; a prediction can be generated and exported as a card PNG,
but nothing in `/stories` displays it yet (tracked below under "Next
up").

---

## API ENDPOINTS (composer, port 8000)

| Endpoint | Description |
|---|---|
| `GET /stories` | List published vault stories (search/category/team/player/venue/year filters) |
| `GET /stories/{content_key}` | Single story detail |
| `GET /stories/contextual` | Stories relevant to a given fixture/teams/venue |
| `GET /stories/wire` | Recent posted-draft archive for the wire strip |
| `POST /generate/bot` | Bot-kind draft generation (prediction/trivia/h2h/venue/record) |
| `POST /generate/llm` | Freeform Gemini-prompted draft |
| `POST /generate/recap` | Match-recap draft from Google News RSS |
| `GET /teams` | Team name list (used by composer's team-autocomplete inputs) |
| `GET /predictions` | ELO prediction generation + retrieval |
| `GET /posts` | Draft → posted-card lifecycle |
| `GET /analytics` | Posting analytics |
| `GET /content-bank` | Hand-authored content bank browse |
| `PATCH /content-bank/{item_id}/publish` | Content bank publish toggle |
| `GET/POST /drafts` | Draft CRUD |

`backend/app/`'s 5 endpoints (`/match-story/today`,
`/stats/player-vs-player`, `/stats/venue`, `/trivia/today`,
`/prediction/today`) are legacy — not mounted on the live composer app,
not called by the frontend. See ARCHITECTURE's legacy note.

---

## DESIGN

The authority for all visual/interaction work on both surfaces is
`DESIGN.md` (repo root) — per the house `design-standards` skill's own
override contract, a project's design system wins over the generic
house defaults where the two would otherwise conflict.

Summary (see `DESIGN.md` for the full rules): near-black flat surfaces,
one accent color (Wire Red) for primary actions only, Floodlight Cyan
for category/source labeling only, Oswald for the one Display-weight
headline per view + Space Grotesk for everything else (One Red Rule,
Loud-Then-Quiet Rule). As of 2026-08-14 this also covers: skeleton/
empty/error states (Honest-State Rule), a token-only motion contract
(One-Motion-Moment Rule), a 640px mobile breakpoint with horizontal-
scroll tag rows (Scroll-Not-Wrap Rule), and full keyboard reachability
(No-Silent-Element Rule).

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

### Composer (manual content tool, `/composer`)

Separate FastAPI app under `composer/` — reuses `bot/`'s SQLite/Postgres DB
(`bot/db.py` schema), not the legacy `backend/app/` one. Not started by
`dev.sh`. Same port (8000) as the legacy backend above — run one or the
other, not both.

```bash
# Backend (repo root, uses bot/'s venv — composer deps live in bot's venv too)
bot/.venv/bin/pip install -r composer/requirements.txt   # once
bot/.venv/bin/python -m uvicorn composer.app:app --reload --port 8000

# Frontend — same `npm run dev` as above, then open http://localhost:3000/composer
```

Local defaults (no setup needed): `COMPOSER_DATABASE_URL` falls back to
`sqlite:///composer.db` in the repo root. Optional, unlock more sources:
- `GEMINI_API_KEY` (repo root or shell env) — enables "GENERATE WITH AI".
- `CRICKET_API_KEY` + running `bot/run.py`'s fixture fetch — populates
  `fixtures` so "GENERATE" (bot) has an upcoming match to draft from.
- `python -m bot.scripts.seed_content_bank` — populates the content bank
  (Wikipedia fetch + **hand-authored, owner-reviewed** before commit; not
  something to auto-run or stub with fake data).

With none of the above configured, only the "+ BLANK" freeform source
works — that's expected, not a bug.

---

## CODING STANDARDS

### Backend (Python)
- Line length: 99 chars (ruff enforced)
- Async everywhere: use `async def` for all route handlers and service methods
- Pydantic v2 models for all request/response shapes
- SQLAlchemy 2.0 async session pattern — never use sync `Session`
- Do not call the Gemini API on every request — cache story/trivia results in DB for the day (composer's live LLM path is Gemini via `composer/gemini.py`, not Anthropic)

### Frontend (TypeScript / Next.js)
- **Next.js 16 has breaking changes from prior versions.** Before writing any Next.js code, check `frontend/node_modules/next/dist/docs/` for current API. Do not rely on training-data knowledge of Next.js conventions.
- App Router only — no `pages/` directory
- Tailwind CSS v4 — class syntax may differ from v3; check docs
- GSAP for all animations (stats appear progressively, hover micro-interactions)
- No tables in UI — use cards, gradients, motion components
- Dark theme with neon / stadium lighting feel; smooth scroll storytelling
- `clsx` + `tailwind-merge` for conditional class logic

### Frontend components (live)

**Vault (`/stories`):** `StoryCard`, `StoryCardImg` (share-card export),
`OnThisDayRail`, `WireStrip`, `StoryBeats` (pull-quote story-text
treatment).

**Composer (`/composer`):** `Editor`, `Feed`, `SourceBar`, `CardPreview`,
`TeamBadge`, card-type renderers (`PredictionCardImg`, `RecordCardImg`,
`TriviaCardImg` — `CardPreview` renders `TriviaCardImg` for
`card_type: "trivia"` drafts the same way it renders `PredictionCardImg`
for predictions; the gap is downstream of composer, see "Next up").

### Next up (scoped, not yet designed — each gets its own brainstorming
cycle per `docs/superpowers/specs/2026-08-14-world-class-ui-quality-bar-design.md`'s
decomposition)

1. **Trivia end-to-end.** Trivia generation and card rendering already
   work — composer's `/generate/bot` (kind=trivia) wires
   `bot/trivia_standalone.py`'s question logic to draft generation, and
   `CardPreview` renders a `TriviaCardImg` for it, same as prediction.
   What's missing: no public `/stories` surface displays a trivia card.
2. **Prediction on the public surface.** Composer can generate and
   export a `PredictionCardImg`, but `/stories` never displays a
   prediction — it only leaves the app as a downloaded PNG for manual
   posting.

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
| Anthropic SDK usage | `claude-api` |
| Vercel deploy / config | `vercel:nextjs`, `vercel:deploy`, `vercel:env-vars` |
| Before merging | `superpowers:requesting-code-review` |
| Branch ready to ship | `superpowers:finishing-a-development-branch` |
| End of session | `claude-md-management:revise-claude-md` |

---

## SESSION LOG

| Date | Goal | Key Decisions | Next |
|---|---|---|---|
| 2026-04-24 | Project init | FastAPI + Next.js 16 monorepo; Vercel for both; Claude API for story generation; no ML for predictions | Implement Cricsheet parser + `/match-story/today` endpoint |
| 2026-07-19 | Viability pivot | Fantasy affiliate dead (PROGA + SC ruling). Product = automated X prediction bot: LightGBM (ML rule overridden), GitHub Actions cron, Neon Postgres, CricAPI, X free tier. Web UI parked. Spec + 13-task plan committed in docs/superpowers/ | Execute plan subagent-driven, Task 1 (scaffold+schema) onward |
| 2026-08-14 | World-class UI quality bar | DESIGN.md extended with States/Motion Contract/Mobile/Keyboard sections (Approach B: extend then execute). Fixed raw `<select>`, vault dead-space, story-detail raw-text-dump. CLAUDE.md truth-up: bot/+composer/ presented as live stack, backend/app/ marked legacy (not deleted). Trivia end-to-end and prediction-on-vault logged as separate next-up cycles. | Brainstorm trivia end-to-end cycle, then prediction-on-vault cycle |
