# Public Prediction Track Record — Design Spec

Date: 2026-08-16
Status: Approved by owner, pending implementation plan

## Problem

CLAUDE.md's "Next up" #2: Composer can generate and export a
`PredictionCardImg`, but nothing on the public site (`/stories`) ever shows
a prediction to a fan — it only leaves the app as a downloaded PNG for
manual posting.

Owner's actual ask, refined through brainstorming: not a single "today's
prediction" hero card, but a public page showing the bot's real prediction
track record — what it predicted, when, and how that played out against
the real result. A transparency/accountability page, not a highlight reel.

This is distinct from the Prediction Backtest page
(`docs/superpowers/specs/2026-08-15-prediction-backtest-design.md`):
Backtest *replays* the model against historical `team_matches` rows as a
what-if simulation. This page shows the *actual* predictions the bot
already made and recorded, with real timestamps, from the `predictions`
table. Two different data sources, two different questions — "how would
the model have done" vs "what did it actually say and when." Do not
conflate the two accuracy numbers when this ships.

## Non-goals

- Not a redesign of Composer's `/composer/predictions` or `/composer/
  live-predict` (the authoring tools) — those are unchanged.
- No new "generate a prediction" flow. This page is read-only.
- No publish/review gate. Every prediction the bot recorded shows, right
  or wrong — owner confirmed this explicitly: curating out the wrong calls
  would undercut the point of a track record, and DESIGN.md's Honest-State
  Rule already governs this app's stance on not hiding unfavorable states.
- No raw data table (NON-GOALS in CLAUDE.md bans tables in the UI) — cards,
  per the rest of the app.

## Approach

Reuse the existing `GET /predictions` endpoint
(`composer/routers/predictions.py`) as the data source, called directly
from a new public frontend route. Considered and rejected: a parallel
public-only endpoint duplicating the same query — composer has no auth
boundary today (Phase 1 non-goal: no auth/login), so there's no access-
control reason to fork it, and a second endpoint returning the same shape
is pure duplication.

`GET /predictions` already returns everything needed
(`composer/schemas.py:PredictionOut`): `team_a`, `team_b`, `venue`,
`league`, `prob_team_a`, `predicted_winner`, `actual_winner`,
`result_summary`, `outcome` ('pending'|'correct'|'incorrect'|'void'),
`created_at` (when the prediction was made), `evaluated_at` (when the
result landed), `reasons`. Filtering by `league` and `outcome` and a
`search` term already exist.

Two gaps:

1. No `offset` param, so no real pagination for a public feed that will
   keep growing.
2. No endpoint returning the distinct set of leagues that actually *have*
   predictions. `/predictions/backtest/options` looks like a fit but is
   wrong here — it derives its `leagues` list from `team_matches`
   (cricsheet-ingested history for the Backtest replay), not from
   `predictions`. A league can have recorded predictions with no
   backtest-eligible history yet (a brand-new league), or the reverse
   (history but the bot never predicted a match in it) — reusing it would
   make the filter list wrong in either direction. Needs its own small
   query against the right table.

Both are small, bounded changes to existing endpoints — not a new
subsystem.

## Design

### Backend change

`composer/routers/predictions.py`, `list_predictions`:

```python
def list_predictions(
    outcome: str | None = None,   # now also accepts comma-separated values
    league: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,        # new
    conn=Depends(get_conn),
) -> list[PredictionOut]:
    q = (
        _build_prediction_select()
        .order_by(predictions.c.created_at.desc())
        .limit(limit)
        .offset(offset)     # new
    )
    if outcome and outcome.strip() and outcome != "all":
        values = [v.strip() for v in outcome.split(",") if v.strip()]
        q = q.where(predictions.c.outcome.in_(values))   # was == outcome.strip()
    ...
```

`outcome` changing from exact-match to `IN (...)` is backward compatible —
every existing caller (Composer's own predictions page) passes a single
value, and `.in_(["correct"])` behaves identically to `== "correct"`. This
is what lets the public page fetch `outcome=pending` for the featured
block and `outcome=correct,incorrect,void` for settled history as two
distinct, cleanly-paginated queries — mixing pending into the same offset
sequence as settled history would make "load more" page sizes
unpredictable (a pending row consumes a slot in the offset count without
appearing in the settled section).

No response-shape change on `list_predictions` — `PredictionOut` is
already public-safe (no internal fields like `features_json` leak through
it).

New endpoint for the league filter, same file — **placement matters**:
Starlette matches routes top-to-bottom, and `GET /predictions/{pred_id}`
(line 311) uses a bare `{pred_id}` path segment with no `:int` converter
in the route string (the `pred_id: int` Python type hint only affects
FastAPI's post-match parameter coercion, not which route matches). A bare
`{pred_id}` matches any single path segment, including the literal string
`"leagues"` — so this endpoint MUST be declared before line 311, grouped
with the other static routes (`/predictions/accuracy`,
`/predictions/backtest/options`, `/predictions/today`) that already
follow this rule. Declaring it after line 311 would make it unreachable
(every request would 422 at `get_prediction("leagues")` instead).

```python
@router.get("/predictions/leagues", response_model=list[str])
def list_prediction_leagues(conn=Depends(get_conn)) -> list[str]:
    """Distinct leagues that have at least one recorded prediction —
    NOT the same set as /predictions/backtest/options' `leagues` (that one
    is derived from team_matches history, for the Backtest replay; this
    one reflects what the bot has actually predicted)."""
    rows = conn.execute(
        sa.select(sa.func.coalesce(predictions.c.league, fixtures.c.league))
        .select_from(
            predictions.outerjoin(fixtures, predictions.c.fixture_id == fixtures.c.id)
        )
        .distinct()
    ).all()
    return sorted({r[0] for r in rows if r[0]})
```

No new router file — same `composer/routers/predictions.py`, placed
alongside the other static GET routes before line 311.

### Frontend

New top-level route: `frontend/src/app/predictions/page.tsx` — sibling to
`/stories`, not nested under `/composer`. Server-rendered list page,
client-side league filter + "load more" pagination (offset-based, reusing
the new backend param).

**Layout, top to bottom:**

1. One Display-weight headline per the Loud-Then-Quiet Rule (e.g. "Every
   Prediction We've Made" or similar — copy TBD at implementation, not a
   design-spec concern).
2. **Accuracy summary strip** — e.g. "62% Hit Rate • 23 Evaluated • 3-Win
   Streak." Sourced from the existing `GET /predictions/accuracy`
   (`composer/routers/predictions.py:96`, already returns `accuracy_pct`,
   `evaluated`, `streak`, `streak_type`) via the existing
   `composerApi.predictionAccuracy()` — zero new backend work. This is
   the single number that answers a fan's "is this bot actually any
   good" question at a glance, directly serving the transparency purpose
   of the page.
3. League filter — same dropdown visual pattern as Backtest's, but sourced
   from the new `GET /predictions/leagues` (see Backend change) — the set
   of leagues with actual predictions, not Backtest's history-derived
   list.
4. **Pending predictions first** — fetched as its own request,
   `GET /predictions?outcome=pending&league=...` (no pagination needed;
   this is always a handful of items — the live, currently-relevant ones,
   e.g. today's Hundred final). Shown as a small set of featured cards at
   the top, not merged into the settled-history request.
5. **Settled history below**, `created_at` descending — fetched
   separately from pending via `GET /predictions?outcome=correct,
   incorrect,void&league=...&limit=20&offset=0`. One card per prediction,
   paginated (initial page + "load more" appending the next `offset`
   batch — matches WireStrip's existing incremental-load pattern rather
   than introducing full page-number pagination). Keeping this fetch
   scoped to non-pending outcomes means every page has a predictable
   size and "load more" never re-fetches a pending row that later
   resolves mid-scroll.

**Card content** (new component,
`frontend/src/components/predictions/PredictionTrackCard.tsx`):

- Teams + league badge (reuse `TeamBadge`/`teamColors.ts` — already
  handles the 2026 rebrand teams correctly as of this session's fixes).
- Model pick + probability (e.g. "Manchester Super Giants 51.6%").
- Predicted-on date (`created_at`).
- Outcome, Honest-State-styled per DESIGN.md — four distinct states, not
  a binary right/wrong:
  - `pending` — no result yet, distinct neutral treatment, not styled as
    a loading skeleton (a pending prediction is a real, final state until
    the match resolves, not a transient one).
  - `correct` — actual result shown, positive accent.
  - `incorrect` — actual result shown, neutral/muted accent (not Wire
    Red — Wire Red is reserved for primary actions per the One Red Rule,
    not for signaling a wrong call).
  - `void` — no-result/abandoned match, its own explicit label (not
    hidden, not lumped into "incorrect").
- `result_summary` when present (e.g. "won by 5 wickets").

**Empty state:** if a league filter returns zero predictions, Honest-State
empty treatment — explicit "no predictions recorded for {league} yet," not
a blank card grid.

**Mobile:** league filter + any tag-like rows follow the Scroll-Not-Wrap
Rule (horizontal scroll under 640px, not wrapped chips).

**Keyboard:** league filter and "load more" are both real interactive
elements, Tab-reachable per the No-Silent-Element Rule (this mainly rules
out a div-with-onClick for "load more").

### Data flow

```
Public page (/predictions)
  -> GET /predictions/accuracy                                  (composer, existing — summary strip)
  -> GET /predictions/leagues                                   (composer, new — league filter options)
  -> GET /predictions?outcome=pending&league=...                (composer, existing — featured block)
  -> GET /predictions?outcome=correct,incorrect,void&league=...
        &limit=20&offset=0                                      (composer, existing + outcome-list + offset — settled history)
```

No new tables, no new persisted state, no new backend module. The
`predictions` table already accumulates rows from every source that
already writes to it: `bot/run.py`'s automated cron tick, Composer's
`live-predict` tool, and `POST /predictions/{id}/result` /
`sync-results` settling them.

### Frontend plumbing

`frontend/src/lib/composerApi.ts`:
- `predictions()` gains `offset?: number` in its query param object
  (existing function, already takes `outcome`/`league`/`search`/`limit`).
- New `predictionLeagues: () => req<string[]>("/predictions/leagues")`.
- `predictionAccuracy()` — already exists, no change, reused as-is.

`frontend/src/app/predictions/layout.tsx` — new, mirrors
`frontend/src/app/stories/layout.tsx`'s existing pattern exactly (a
`Metadata` export: title, description, openGraph — no client logic).

`frontend/src/app/predictions/page.tsx` itself: Server Component for the
initial data fetch (accuracy strip + first page of pending/settled +
league list), Client Component boundary for the interactive league filter
and "load more" — same split `/stories/page.tsx` already uses for its own
filters.

**Navigation:** the reviewer flagged this as missing, correctly, but
pointed at `AppleGlobalNav.tsx` — verified that component is mounted only
in `composer/layout.tsx` (composer/routers/predictions.py's internal
nav), never rendered on the public site. Adding a fan-facing link there
would put it inside the admin tool, not in front of fans. The public site
has no shared nav component yet — `frontend/src/app/stories/page.tsx`
builds its own inline `<header>`/`<nav>` (`Link` to `/stories`,
`/composer`, "Write Story →"). The real fix: add a
`<Link href="/predictions">` to that inline nav, and give
`/predictions/page.tsx` its own matching inline header (same convention,
not a new shared component — introducing one is out of scope for this
spec).

### Testing

- Backend: `composer/tests/test_predictions.py` (existing file) gets new
  cases —
  - `offset`: page 2 returns the next slice, not a repeat of page 1;
    `offset` beyond total returns `[]`, not an error.
  - `outcome` as a comma-separated list (`outcome=correct,incorrect,void`)
    returns the union, excluding `pending`; a single value still behaves
    exactly as before (regression check on the existing behavior).
  - `/predictions/leagues`: returns only leagues with a recorded
    prediction (not every league in `team_matches`); a league present in
    `fixtures` but with zero predictions is excluded; result is
    deduplicated and sorted; requesting the literal path `/predictions/
    leagues` returns the league list, not a 422 (regression guard against
    the route-ordering bug this spec found).
- Frontend: new `frontend/src/app/predictions/__tests__/page.test.tsx`
  covering: pending predictions (from the dedicated `outcome=pending`
  fetch) render above settled history; each of the four outcome states
  renders its distinct treatment; empty-league-filter shows the
  Honest-State empty copy, not a blank grid; "load more" fetches the next
  offset of settled history and appends (doesn't replace) the existing
  list, without ever including a pending row; accuracy strip renders the
  values from `GET /predictions/accuracy` verbatim.

## Open questions closed during brainstorming

- **Placement:** dedicated page, not a rail bolted onto `/stories` and not
  merged into `/stories`' `content_bank`-backed feed — predictions are
  live/time-sensitive data from a different table, not hand-authored
  narrative content.
- **Publish gate:** none — every prediction shows, unfiltered.
- **Scope:** confirmed this is a "predicted vs actual, with the date we
  predicted it" track record, structurally close to Backtest's per-game
  list but sourced from real recorded predictions (`predictions` table),
  not a backtest replay.
