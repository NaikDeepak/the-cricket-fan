# Upcoming-Fixtures Provider — Design (for Gemini)

## Problem

The bot never predicts scheduled internationals/other matches (e.g. the
2026-07-23 India vs Zimbabwe T20I) because `CricApiProvider.fetch()` reads only
CricAPI's **`/currentMatches`** endpoint, which lists *live and recently-ended*
matches — **not upcoming-scheduled ones**. A prediction must be posted at
**T‑3h before start**, but the fixture doesn't appear in `/currentMatches` until
it goes live (T‑0), by which point the window is gone. Result: the fixture is
never inserted, no prediction is made, and (because the bot sees "no fixture
within 24h") it posts quiet-day standalone trivia instead.

This is not team-resolution (already fixed — see below). It is a **data-source
gap**: the bot is structurally blind to future fixtures.

### Already done (do not redo)
`bot/aliases.py` `resolve()` now falls back to a **`team_matches` passthrough**
(commit `be327df`, merged to `feature/mvp`): any team/venue with history
resolves to its stored canonical name, so internationals/non-IPL sides are no
longer hard-skipped. India (433 rows) and Zimbabwe (246) resolve correctly.
This spec builds on that.

## Evidence (verified live against CricAPI, 2026-07-23)

- **`/cricScore`** returns the upcoming match (and the whole schedule, ~106
  rows). The India–Zimbabwe entry:
  ```json
  {"id":"ff0a1980-...","dateTimeGMT":"2026-07-23T11:00:00","matchType":"t20",
   "status":"Match starts at Jul 23, 11:00 GMT","ms":"fixture",
   "t1":"India [IND]","t2":"Zimbabwe [ZIM]","series":"India tour of Zimbabwe 2026"}
  ```
  Key fields: **`ms`** = `"fixture"` (upcoming) vs `"live"`/`"result"`;
  `matchType`; `dateTimeGMT`; team names carry a **`[CODE]` suffix**; **no
  venue**.
- **`/match_info?id=<id>`** supplies the rest: **`venue`**, **clean `teams`**
  (`['Zimbabwe','India']`, no codes), `matchStarted`, `matchEnded`.
- **API budget: 100 hits/day** (`hitsLimit`). `/cricScore` = 1 hit,
  `/match_info` = 1 hit each. The cron runs ~12×/day, so `/match_info` calls
  must be strictly bounded (only genuinely new, near-term fixtures).

## Endpoint choice (evaluated 2026-07-23 — do not re-explore)

- **`/currentMatches`** — live + recently-ended only; misses scheduled. (current bug)
- **`/matches`** ("all matches list") — the **full 15,931-row archive**,
  paginated 25/row, **not** date-proximity ordered (offset 0 returned a Dec-2026
  match). Has clean teams/`matchType`/`dateTimeGMT`/`matchStarted`/`matchEnded`
  but **`venue` is empty** and there's no cheap "today" filter — finding a
  specific upcoming match means paging hundreds of calls. **Rejected.**
- **`/cricScore`** — **chosen.** One hit returns the current + near-term list
  (~100) with an **`ms`** state field (`fixture`/`live`/`result`); includes the
  Ind-Zim fixture (Jul 23/25/26). No venue → one `/match_info` per new fixture.
- **`/match_info?id=`** — supplies `venue` + clean `teams` + started/ended.

## Goal

Ingest upcoming T20 fixtures early enough that the existing prediction path
(T‑3h window in `bot/run.py`) fires. Keep `/currentMatches` for results.

## Design

### Part A — provider reads upcoming fixtures (`bot/fixtures_provider.py`)

Extend `CricApiProvider.fetch(conn)` to also collect upcoming fixtures:

1. Keep the existing `/currentMatches` pass unchanged — it still yields live
   fixtures and **results** (`matchEnded` + `matchWinner`). Refactor its body
   into `_fetch_current(conn)` returning `(fixtures, results)`.
2. Add `_fetch_upcoming(conn) -> list[Fixture]`:
   - `GET /cricScore` (1 hit).
   - For each row, keep only: `ms == "fixture"` **and**
     `matchType.lower() == "t20"`.
   - Parse `start = datetime.fromisoformat(dateTimeGMT).replace(tzinfo=utc)`;
     keep only `now <= start <= now + UPCOMING_HORIZON_H` (**48h**). This bounds
     both relevance and `/match_info` calls.
   - Skip ids already present in the `fixtures` table
     (`conn.execute(select(fixtures.c.provider_match_id))`) — no `/match_info`
     hit for matches already stored. (This is the primary budget guard.)
   - For each surviving id: `GET /match_info?id=<id>` (1 hit). Read `venue`,
     `teams`, `matchStarted`, `matchEnded`. If `matchStarted` or `matchEnded`
     is true, skip (it's no longer upcoming).
   - `teams = sorted(resolve(conn,"team",t) for t in info["teams"])`,
     `venue = resolve(conn,"venue",info["venue"])`. On `UnresolvedEntityError`:
     log + skip (never raise — same rule as the current pass). Require
     `len(teams) == 2`.
   - Build `Fixture(provider_match_id=id, team_a=teams[0], team_b=teams[1],
     venue=venue, league=<`series` from the /cricScore row or /match_info
     `name`>, start_time=start)`.
3. `fetch()` returns `current_fixtures + upcoming_fixtures` (deduped by
   `provider_match_id`) and `results`. `_upsert_fixtures` in `run.py` is already
   idempotent per `provider_match_id`, so a match appearing in both endpoints
   upserts once.

Import the table as `from .db import fixtures as fixtures_table` to avoid
shadowing the local `fixtures` list. Add `import sqlalchemy as sa`,
`from datetime import timedelta`, and `UPCOMING_HORIZON_H = 48`.

**Note on team names:** `/match_info` gives clean team names (no `[CODE]`), so
prefer those. If a future path needs the `/cricScore` `t1`/`t2`, strip the
suffix with `re.sub(r"\s*\[[A-Z0-9]+\]\s*$", "", name)`.

### Part B — venue name reconciliation (`bot/aliases.py`)

CricAPI venues carry a trailing `", <City>"` that Cricsheet omits — e.g.
CricAPI `"Harare Sports Club, Harare"` vs Cricsheet `"Harare Sports Club"`
(confirmed: `team_matches` has `"Harare Sports Club"`, 146 rows at that venue).
Exact-match passthrough fails → the match is skipped on venue even after teams
resolve. Without this, today's match still would not have posted.

Add a **venue-only fallback** to `resolve()` (after the `team_matches` exact
passthrough, before raising), applied only when `kind == "venue"`:
- Progressively strip trailing `", <segment>"` from the normalized name and
  retry the `team_matches.venue` passthrough.
- **Only accept a stripped form if it matches exactly one distinct venue** in
  `team_matches` (guard against ambiguity). If 0 or >1 match, keep failing.

Example: `"harare sports club, harare"` → strip `, harare` →
`"harare sports club"` → unique match → resolve to the stored
`"Harare Sports Club"`.

Do **not** do prefix/substring matching (too ambiguous). Explicit venue alias
rows in `SEED` remain the escape hatch for cases the strip rule can't cover.

## Testing (TDD)

`bot/tests/test_provider.py` — route the `MockTransport` handler by
`request.url.path` to serve canned `/cricScore`, `/match_info`, and
`/currentMatches` payloads (add JSON fixtures under `bot/tests/data/`):
- Upcoming `ms=="fixture"` + `t20` within 48h, not in DB → one `/match_info`
  call → resolved fixture returned with the info venue/teams/start.
- `ms != "fixture"` or `matchType != "t20"` → ignored (no `/match_info` call).
- Id already in the `fixtures` table → **no `/match_info` call** (assert the
  transport saw no `/match_info` request for it) and not re-added.
- Start beyond the 48h horizon → ignored.
- `/match_info` reports `matchStarted`/`matchEnded` true → skipped.
- Unresolved team or venue → logged + skipped, `fetch()` does not raise.
- Dedup: same `provider_match_id` in `/currentMatches` and `/cricScore` →
  single fixture out.
- Existing `/currentMatches` result-splitting tests still pass unchanged.

`bot/tests/test_aliases.py` — venue strip fallback:
- `team_matches` has `"Harare Sports Club"` only → `resolve(conn,"venue",
  "Harare Sports Club, Harare") == "Harare Sports Club"`.
- Ambiguous: two distinct venues share a stripped form → still
  `UnresolvedEntityError`.
- Team resolution is unchanged (no trailing-strip for teams).

## Constraints / gotchas

- Python: `bot/.venv/bin/python`. Tests from repo root. Full bot suite is slow.
- Sync SQLAlchemy Core; ruff line length 99; hard-skip-on-unresolved rule
  preserved (log + continue, never raise out of `fetch()`).
- **API budget is the real risk** — verify in tests that `/match_info` is
  called only for new, in-horizon fixtures. A regression here could exhaust the
  100/day limit and blind the whole bot.
- Keep `/currentMatches` as the results source; only *add* the upcoming source.
- Branch: `feature/mvp` (live bot). This does **not** touch the `composer/`
  work.

## Out of scope

- Switching results ingestion off `/currentMatches`.
- Per-series schedule endpoints; venue geocoding.
- Standalone-trivia content-quality (defunct-team H2H like "Delhi Daredevils
  vs Gujarat Lions") — a **separate** bug (candidates drawn from all-time
  `team_matches` history, unrelated to this provider change). Track separately.
