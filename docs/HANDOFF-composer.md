# Handoff — Composer sub-project execution

Written 2026-07-23 for the next agent (Gemini) to execute. Everything below is committed. Read this, then the two plans, then start.

## What this is

Manual, human-in-the-loop content composer for the cricket X-bot project. Browse/generate/edit cricket content, render a themed image card client-side, **copy-paste manually** to any platform (X/FB/IG/WhatsApp/Telegram). NO automation, NO posting APIs, NO scraping — that was explicitly ruled out for ToS/ban reasons. It COMPLEMENTS the existing automated X bot (bot's posting is untouched).

## State of the repo

- Branch `feature/mvp` (the working main). Clean, all committed.
- Content-bank feature already MERGED via PR #3 (Wikipedia records + anecdotes/stories for standalone trivia). Full bot suite: **106 passing**.
- Spec + both plans written and committed. Nothing in `composer/` or `frontend/src/app/composer/` exists yet — the plans create it.

## Documents (read in this order)

1. Spec: `docs/superpowers/specs/2026-07-23-manual-content-composer-design.md`
2. **Plan 1 (execute FIRST)** — Composer API (backend, 7 tasks): `docs/superpowers/plans/2026-07-23-composer-api-plan.md`
3. **Plan 2 (execute SECOND)** — Composer UI (frontend, 7 tasks): `docs/superpowers/plans/2026-07-23-composer-ui-plan.md`

The UI hits the API's endpoints, so the API plan MUST be built first. The two plans share no files (API = Python under `composer/`; UI = TypeScript under `frontend/`).

## How to execute

Each plan is TDD, complete code in every step (write failing test → verify fail → implement → verify pass → lint → commit). Work task-by-task, in order. Recommended: one focused effort per task, review the diff before moving on.

1. Branch `feature/composer` is ALREADY created and pushed (off `feature/mvp`). Just check it out: `git checkout feature/composer && git pull`. Work here.
2. Execute Plan 1, Tasks 1→7. Commit after each task (messages are in the plan).
3. Execute Plan 2, Tasks 1→7.
4. Open a PR into `feature/mvp`.

## Environment — critical gotchas

- **Python is `bot/.venv/bin/python`** (repo venv). Bare `python`/`python3` LACK the deps. pip = `bot/.venv/bin/pip`. Composer deps install into this same venv (Plan 1 Task 2).
- Run all Python tests from repo root: `cd <repo> && bot/.venv/bin/python -m pytest composer/tests/... -q`.
- The full bot suite is slow (~90–120s, LightGBM). While iterating, run only the file you're changing; run the full suite once before a commit that touches shared code.
- Lint: `bot/.venv/bin/python -m ruff check <paths> && bot/.venv/bin/python -m ruff format <paths>`. Must be clean. Line length 99.
- **`bot/` uses SYNC SQLAlchemy Core**, not async ORM. The composer follows the same. Do NOT introduce async ORM.
- **The composer reuses `bot/` code** (db tables, `compose.py`, `trivia_standalone.py`, `predict.py`, `features.py`, `run.py` helpers). Do NOT reimplement generation. `bot` must NEVER import `composer` (one-way dep, keeps the GitHub Actions cron lean — composer web deps live only in `composer/requirements.txt`).
- New tables `drafts` + `content_events` go in `bot/db.py`'s existing `metadata` (single schema source, created by existing `ensure_schema`).
- Timestamps: pass `datetime.now(timezone.utc)` explicitly at each insert (matches bot convention + deterministic tests). Do NOT use `server_default`.

### Frontend specifics

- `frontend/AGENTS.md` mandate: **this is NOT the Next.js in your training data (Next 16.2.4).** Before writing any routing/layout/server-component code, READ `frontend/node_modules/next/dist/docs/` and mirror the existing working pages (`src/app/explore/page.tsx`, `src/app/match/[date]/page.tsx`). Don't guess Next 16 APIs.
- Frontend had NO test framework — Plan 2 Task 1 adds Vitest + @testing-library/react + happy-dom.
- `html-to-image` is already installed. `src/lib/share.ts` already has `captureCard` (pixelRatio 2, FontFace load) + `shareCard` — Plan 2 extends it with clipboard copy. Reuse the `ShareDrawer` off-screen-twin export pattern (`src/components/share/ShareDrawer.tsx`).
- Theme = CSS vars in `globals.css` (`--bg #030303`, `--surface`, `--fg`, `--muted`, `--border`, `--team-a #004ba0`, `--team-b #ffcb05`), Space Grotesk font, utility classes (`.card-container`, `.text-micro`, `.text-stat-hero`). Cards not tables.
- Same-origin image rule: any logo/texture/background IMAGE in a card must be local `public/` file or inline SVG (a cross-origin `<img>` taints the canvas → `toPng` throws). Web fonts via FontFace are fine.
- Frontend gate: `npm run test`, `npm run lint`, `npm run build` (from `frontend/`).
- Composer UI reads API base from `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Do NOT touch the existing `lib/api.ts` (it targets the parked `backend/app/`); add composer calls in new `lib/composerApi.ts`.

## Locked decisions (do not relitigate)

1. Complement the bot — bot's X posting untouched.
2. Copy-only, platform-agnostic — no share intents, no per-platform API.
3. Four content sources: content_bank, bot generators, on-demand Gemini LLM, freeform.
4. v1 analytics = tool funnel (auto) + prediction accuracy (auto). No engagement scraping, no manual entry.
5. Local-first v1; designed for later auth+deploy (no auth in v1).
6. Themed cards per type (prediction/trivia/record) + aspect ratios (1:1, 16:9, 4:5).
7. Client-side `html-to-image` (approach A). NOT server satori, NOT headless browser.
8. Build on `bot/` (reuse); `backend/app/` stays parked and untouched.

## Refinements already folded into the API plan

FK `ondelete="CASCADE"` on content_events.draft_id; `card_meta` JSON boundary (dict at API, TEXT in DB); `/generate/bot` optional `fixture_id` (default next upcoming); Gemini structured `{text, card_meta}` output + 503 when no key; `/analytics` `COUNT(DISTINCT draft_id)` funnel. Explicit-now timestamps kept over server_default (deliberate, see plan).

## Definition of done

- Plan 1: all `composer/tests/` + `bot/tests/test_db.py` green, ruff clean.
- Plan 2: `npm run test` + `npm run lint` + `npm run build` all pass.
- PR into `feature/mvp`.

## Reference: Gemini API key

The LLM path (`/generate/llm`) reuses `GEMINI_API_KEY` (already configured for the parked web app's story service — see `backend/.env`). Composer adds its OWN thin Gemini client (`composer/gemini.py`), not a dependency on `backend/app/services`. With no key, `/generate/llm` returns 503 and the UI shows the source disabled — the other three sources still work.
