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
    outcome: str | None = None,
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
    ...
```

No response-shape change on `list_predictions` — `PredictionOut` is
already public-safe (no internal fields like `features_json` leak through
it).

New endpoint for the league filter, same file:

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

No new router file — same `composer/routers/predictions.py`.

### Frontend

New top-level route: `frontend/src/app/predictions/page.tsx` — sibling to
`/stories`, not nested under `/composer`. Server-rendered list page,
client-side league filter + "load more" pagination (offset-based, reusing
the new backend param).

**Layout, top to bottom:**

1. One Display-weight headline per the Loud-Then-Quiet Rule (e.g. "Every
   Prediction We've Made" or similar — copy TBD at implementation, not a
   design-spec concern).
2. League filter — same dropdown visual pattern as Backtest's, but sourced
   from the new `GET /predictions/leagues` (see Backend change) — the set
   of leagues with actual predictions, not Backtest's history-derived
   list.
3. **Pending predictions first** (`outcome == "pending"`) — these are the
   live, currently-relevant ones (e.g. today's Hundred final). Shown as
   a small set of featured cards at the top, not buried in
   chronological order with the settled history.
4. **Settled history below**, `created_at` descending — one card per
   prediction, paginated (initial page + "load more" appending the next
   `offset` batch; matches WireStrip's existing incremental-load pattern
   rather than introducing full page-number pagination).

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
  -> GET /predictions?league=...&limit=20&offset=0   (composer, existing + offset)
  -> GET /predictions/leagues                         (composer, new — leagues with predictions)
```

No new tables, no new persisted state, no new backend module. The
`predictions` table already accumulates rows from every source that
already writes to it: `bot/run.py`'s automated cron tick, Composer's
`live-predict` tool, and `POST /predictions/{id}/result` /
`sync-results` settling them.

### Testing

- Backend: `composer/tests/test_predictions.py` (existing file) gets new
  cases —
  - `offset`: page 2 returns the next slice, not a repeat of page 1;
    `offset` beyond total returns `[]`, not an error.
  - `/predictions/leagues`: returns only leagues with a recorded
    prediction (not every league in `team_matches`); a league present in
    `fixtures` but with zero predictions is excluded; result is
    deduplicated and sorted.
- Frontend: new `frontend/src/app/predictions/__tests__/page.test.tsx`
  covering: pending predictions render above settled history; each of the
  four outcome states renders its distinct treatment; empty-league-filter
  shows the Honest-State empty copy, not a blank grid; "load more" fetches
  the next offset and appends (doesn't replace) the existing list.

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
