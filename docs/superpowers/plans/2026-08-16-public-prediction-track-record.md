# Public Prediction Track Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `/predictions` page showing every prediction the
bot has actually recorded — team pick, probability, when it was made,
what really happened — as an unfiltered transparency/track-record page,
distinct from the Backtest replay page.

**Architecture:** Reuse the existing `predictions` table and
`composer/routers/predictions.py` endpoints as the sole data source (no
new tables, no new persisted state). Three small backend additions
(`offset` pagination, comma-separated `outcome` filter, a new
`/predictions/leagues` endpoint) feed a new client-rendered public
frontend route that fetches pending predictions and paginated settled
history as two separate requests.

**Tech Stack:** FastAPI + SQLAlchemy Core (backend, `composer/`), Next.js
16 App Router + React + Framer Motion (frontend), pytest (backend tests),
Vitest + Testing Library (frontend tests).

**Spec:** `docs/superpowers/specs/2026-08-16-public-prediction-track-record-design.md`

## Global Constraints

- No new backend router file — all changes go in the existing
  `composer/routers/predictions.py`.
- `GET /predictions/leagues` MUST be declared before
  `GET /predictions/{pred_id}` (currently at line 311) in
  `composer/routers/predictions.py` — a bare `{pred_id}` path segment (no
  `:int` converter in the route string) matches any string including
  `"leagues"`; Starlette matches routes top-to-bottom, so declaring it
  after line 311 makes it unreachable (every request 422s at
  `get_prediction("leagues")` instead).
- The `outcome` query param change (single value → comma-separated list)
  must stay backward compatible — existing callers (Composer's own
  `/composer/predictions` page) pass a single value and must keep working
  unchanged.
- No page in this plan uses DESIGN.md's Press-Box tokens (Wire Red, Void
  Black, Oswald) — verified those aren't implemented in `globals.css`.
  Use the real tokens: `--bg`, `--surface`, `--fg`, `--fg-muted`,
  `--success`/`--success-tint`, `--warning`/`--warning-tint`, `--error`/
  `--error-tint`, `--space-*`, `--font-sans` (Plus Jakarta Sans),
  `--font-serif` (Fraunces), and the existing `.ds-bento-card` /
  `.ds-nav-link` / `.ds-skeleton` CSS classes already defined in
  `frontend/src/app/globals.css`.
- A wrong prediction (`outcome === "incorrect"`) is styled with
  `--warning`, never `--error` — `--error` is this app's signal for an
  actual failure (broken fetch, 500), not a model call that turned out
  wrong.
- No raw HTML tables anywhere in this plan (project-wide non-goal) — cards
  only.
- Frontend components are Client Components (`"use client"`) fetching via
  `useEffect`/`useState` calling `composerApi` — matches
  `/stories/page.tsx`'s actual existing pattern; there is no
  Server/Client split anywhere in this frontend today.

---

## Task 1: Backend — `offset` pagination on `GET /predictions`

**Files:**
- Modify: `composer/routers/predictions.py:184-218` (`list_predictions`)
- Test: `composer/tests/test_predictions.py`

**Interfaces:**
- Produces: `GET /predictions` now accepts `offset: int = 0` alongside the
  existing `outcome`/`league`/`search`/`limit` params.

- [ ] **Step 1: Write the failing test**

Add to `composer/tests/test_predictions.py` (uses the existing
`_mk_fixture`/`_mk_prediction` helpers already at the top of that file):

```python
def test_offset_pages_through_results(client, conn):
    for i in range(1, 4):
        _mk_fixture(conn, fid=i, team_a=f"Team {i}", team_b="Opponent")
        conn.execute(
            predictions.insert().values(
                fixture_id=i,
                team_a=f"Team {i}",
                team_b="Opponent",
                league="IPL",
                venue="Wankhede Stadium",
                prob_team_a=0.6,
                reasons_json="[]",
                features_json="{}",
                created_at=datetime(2026, 7, 20 + i, tzinfo=timezone.utc),
                outcome="pending",
            )
        )
    conn.commit()
    # created_at desc: Team 3 (7/23), Team 2 (7/22), Team 1 (7/21)
    page1 = client.get("/predictions", params={"limit": 2, "offset": 0}).json()
    assert [r["team_a"] for r in page1] == ["Team 3", "Team 2"]

    page2 = client.get("/predictions", params={"limit": 2, "offset": 2}).json()
    assert [r["team_a"] for r in page2] == ["Team 1"]

    page3 = client.get("/predictions", params={"limit": 2, "offset": 10}).json()
    assert page3 == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_offset_pages_through_results -v`
Expected: FAIL — `offset` is an unexpected keyword / query param has no
effect yet (the endpoint currently accepts and silently ignores unknown
query params, so the more likely failure is `page1`/`page2` both
returning all 3 rows since nothing slices by offset).

- [ ] **Step 3: Add `offset` to `list_predictions`**

In `composer/routers/predictions.py`, change:

```python
@router.get("/predictions", response_model=list[PredictionOut])
def list_predictions(
    outcome: str | None = None,
    league: str | None = None,
    search: str | None = None,
    limit: int = 100,
    conn=Depends(get_conn),
) -> list[PredictionOut]:
    q = (
        _build_prediction_select()
        .order_by(predictions.c.created_at.desc())
        .limit(limit)
    )
```

to:

```python
@router.get("/predictions", response_model=list[PredictionOut])
def list_predictions(
    outcome: str | None = None,
    league: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
    conn=Depends(get_conn),
) -> list[PredictionOut]:
    q = (
        _build_prediction_select()
        .order_by(predictions.c.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
```

(Everything below that — the `if outcome:`/`if league:`/`if search:`
blocks — is unchanged in this step.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_offset_pages_through_results -v`
Expected: PASS

- [ ] **Step 5: Run the full predictions test file to check no regression**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py -v`
Expected: all pass (existing tests don't pass `offset`, so they exercise
the `offset=0` default — same behavior as before this change).

- [ ] **Step 6: Commit**

```bash
git add composer/routers/predictions.py composer/tests/test_predictions.py
git commit -m "feat(composer): add offset pagination to GET /predictions"
```

---

## Task 2: Backend — comma-separated `outcome` filter

**Files:**
- Modify: `composer/routers/predictions.py` (`list_predictions`, the
  `if outcome:` block, right after Task 1's change)
- Test: `composer/tests/test_predictions.py`

**Interfaces:**
- Consumes: nothing new from Task 1 beyond the same function.
- Produces: `GET /predictions?outcome=correct,incorrect,void` now returns
  the union of those three outcomes, excluding `pending`. A single value
  (`outcome=correct`) behaves exactly as before — this is what Task 4's
  frontend "settled history" fetch will rely on, and what Task 4's
  "pending" fetch (`outcome=pending`, still a single value) continues to
  use unchanged.

- [ ] **Step 1: Write the failing test**

```python
def test_outcome_accepts_comma_separated_list(client, conn):
    _mk_fixture(conn, fid=1)
    _mk_fixture(conn, fid=2, team_a="Kolkata Knight Riders", team_b="Delhi Capitals")
    _mk_fixture(conn, fid=3, team_a="Royal Challengers Bengaluru", team_b="Punjab Kings")
    _mk_prediction(conn, fid=1, outcome="correct")
    _mk_prediction(conn, fid=2, outcome="incorrect")
    _mk_prediction(conn, fid=3, outcome="pending")
    conn.commit()

    rows = client.get(
        "/predictions", params={"outcome": "correct,incorrect,void"}
    ).json()
    assert {r["fixture_id"] for r in rows} == {1, 2}

    # Single value still behaves exactly as before this change.
    rows = client.get("/predictions", params={"outcome": "correct"}).json()
    assert [r["fixture_id"] for r in rows] == [1]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_outcome_accepts_comma_separated_list -v`
Expected: FAIL — `"correct,incorrect,void"` doesn't equal any single
`predictions.c.outcome` value, so the comma-list query returns `[]`
instead of the two matching rows.

- [ ] **Step 3: Change the outcome filter to `IN (...)`**

In `composer/routers/predictions.py`, `list_predictions`, change:

```python
    if outcome and outcome.strip() and outcome != "all":
        q = q.where(predictions.c.outcome == outcome.strip())
```

to:

```python
    if outcome and outcome.strip() and outcome != "all":
        values = [v.strip() for v in outcome.split(",") if v.strip()]
        q = q.where(predictions.c.outcome.in_(values))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_outcome_accepts_comma_separated_list -v`
Expected: PASS

- [ ] **Step 5: Run the full predictions test file to check no regression**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py -v`
Expected: all pass, including the existing `test_filters_by_outcome`
(single-value case).

- [ ] **Step 6: Commit**

```bash
git add composer/routers/predictions.py composer/tests/test_predictions.py
git commit -m "feat(composer): accept comma-separated outcome list on GET /predictions"
```

---

## Task 3: Backend — `GET /predictions/leagues`

**Files:**
- Modify: `composer/routers/predictions.py` — new route function placed
  immediately after `get_prediction_accuracy` (which ends around line 96)
  and before `list_predictions` (line 184's static block), i.e. grouped
  with the other static GET routes, well before `/predictions/{pred_id}`
  at line 311.
- Test: `composer/tests/test_predictions.py`

**Interfaces:**
- Produces: `GET /predictions/leagues -> list[str]` — sorted, deduplicated
  leagues with at least one recorded prediction, using the same
  coalesce-to-"IPL" fallback `_build_prediction_select()` already applies
  to every other prediction-listing endpoint.

- [ ] **Step 1: Write the failing tests**

```python
def test_leagues_route_not_shadowed_by_pred_id(client):
    # Same failure mode as test_today_route_not_shadowed_by_pred_id above:
    # if /predictions/leagues is declared after /predictions/{pred_id},
    # FastAPI matches {pred_id} first and 422s trying to int-parse
    # "leagues" instead of returning the league list.
    r = client.get("/predictions/leagues")
    assert r.status_code == 200
    assert r.json() == []


def test_leagues_returns_only_leagues_with_recorded_predictions(client, conn):
    _mk_fixture(conn, fid=1)  # league="IPL" per _mk_fixture default
    conn.execute(
        fixtures.insert().values(
            id=2,
            provider_match_id="m2",
            team_a="Trent Rockets",
            team_b="Manchester Super Giants",
            venue="Lord's, London",
            league="The Hundred",
            start_time=datetime(2026, 8, 16, tzinfo=timezone.utc),
            status="upcoming",
        )
    )
    _mk_prediction(conn, fid=1, outcome="correct")  # -> IPL
    conn.execute(
        predictions.insert().values(
            fixture_id=2,
            team_a="Trent Rockets",
            team_b="Manchester Super Giants",
            league="The Hundred",
            venue="Lord's, London",
            prob_team_a=0.48,
            reasons_json="[]",
            features_json="{}",
            created_at=datetime(2026, 8, 16, tzinfo=timezone.utc),
            outcome="pending",
        )
    )
    # A league with a fixture but no prediction at all must NOT appear.
    conn.execute(
        fixtures.insert().values(
            id=3,
            provider_match_id="m3",
            team_a="Adelaide Strikers Women",
            team_b="Brisbane Heat Women",
            venue="Adelaide Oval",
            league="WBBL",
            start_time=datetime(2026, 8, 20, tzinfo=timezone.utc),
            status="upcoming",
        )
    )
    conn.commit()

    r = client.get("/predictions/leagues")
    assert r.status_code == 200
    assert r.json() == ["IPL", "The Hundred"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_leagues_route_not_shadowed_by_pred_id composer/tests/test_predictions.py::test_leagues_returns_only_leagues_with_recorded_predictions -v`
Expected: FAIL — no `/predictions/leagues` route exists yet, both 404.

- [ ] **Step 3: Add the route**

In `composer/routers/predictions.py`, insert this immediately after the
`get_prediction_accuracy` function (which ends just before the blank line
before `def _matches_team`... actually before `list_predictions` at line
184 — insert directly above the `@router.get("/predictions", ...)` line):

```python
@router.get("/predictions/leagues", response_model=list[str])
def list_prediction_leagues(conn=Depends(get_conn)) -> list[str]:
    """Distinct leagues that have at least one recorded prediction --
    NOT the same set as /predictions/backtest/options' `leagues` (that one
    is derived from team_matches history, for the Backtest replay; this
    one reflects what the bot has actually predicted). Built on
    _build_prediction_select() so the league value matches exactly what
    list_predictions/get_prediction_accuracy already show for the same
    rows, including the existing coalesce-to-"IPL" fallback."""
    sub = _build_prediction_select().subquery()
    rows = conn.execute(sa.select(sub.c.league).distinct()).all()
    return sorted({r[0] for r in rows if r[0]})
```

Must land before line ~184's `@router.get("/predictions", ...)` block AND
well before line 311's `@router.get("/predictions/{pred_id}", ...)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py::test_leagues_route_not_shadowed_by_pred_id composer/tests/test_predictions.py::test_leagues_returns_only_leagues_with_recorded_predictions -v`
Expected: PASS

- [ ] **Step 5: Run the full predictions test file to check no regression**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_predictions.py -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add composer/routers/predictions.py composer/tests/test_predictions.py
git commit -m "feat(composer): add GET /predictions/leagues"
```

---

## Task 4: Backend — full suite check

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full bot + composer suite**

Run: `bot/.venv/bin/python -m pytest bot/tests composer/tests`
Expected: same pass count as before this plan's changes plus the 4 new
tests from Tasks 1-3 (Task 1: 1 test, Task 2: 1 test, Task 3: 2 tests —
i.e. previous total + 4), with the one known pre-existing unrelated
failure (`test_on_this_day.py::
test_resolve_on_this_day_story_persists_and_retrieves`) still present and
still the only failure. If any other test fails, stop and investigate
before continuing to the frontend tasks — don't build UI on a backend
regression.

- [ ] **Step 2: No commit** (nothing changed in this task; it's a gate)

---

## Task 5: Frontend — move `TeamBadge` to a shared location

**Why:** `TeamBadge.tsx` currently lives under `components/composer/`,
imported by two composer-only pages. The new public `/predictions` page
needs it too, and importing from `components/composer/` into the public
route would be the first time public code depends on the internal tool's
folder — this codebase's App Router structure treats `stories/` (public)
and `composer/` (internal) as a real boundary. `TeamBadge.tsx` itself has
zero composer-specific logic (just renders a logo image or initials), so
moving it is a pure relocation, not a rewrite.

**Files:**
- Move: `frontend/src/components/composer/TeamBadge.tsx` →
  `frontend/src/components/common/TeamBadge.tsx`
- Modify: `frontend/src/app/composer/posts/page.tsx` (import path)
- Modify: `frontend/src/app/composer/live-predict/page.tsx` (import path)

**Interfaces:**
- Produces: `frontend/src/components/common/TeamBadge.tsx` — same
  default export, same props (`{ team: string; size?: number }`), used by
  Task 8's `PredictionTrackCard`.

- [ ] **Step 1: Move the file**

```bash
mkdir -p frontend/src/components/common
git mv frontend/src/components/composer/TeamBadge.tsx frontend/src/components/common/TeamBadge.tsx
```

- [ ] **Step 2: Update the two existing imports**

In `frontend/src/app/composer/posts/page.tsx`, find the import line
matching `from "@/components/composer/TeamBadge"` and change it to
`from "@/components/common/TeamBadge"`.

In `frontend/src/app/composer/live-predict/page.tsx`, same change: find
`from "@/components/composer/TeamBadge"` and change it to
`from "@/components/common/TeamBadge"`.

- [ ] **Step 3: Verify nothing else references the old path**

Run: `grep -rn "components/composer/TeamBadge" frontend/src`
Expected: no output (both callers updated).

- [ ] **Step 4: Run the frontend build to catch any missed import**

Run: `cd frontend && npm run build`
Expected: exits 0, no module-not-found errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(frontend): move TeamBadge to components/common, shared by composer and public pages"
```

---

## Task 6: Frontend — `composerApi.ts` additions

**Files:**
- Modify: `frontend/src/lib/composerApi.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `composerApi.predictions()` accepts `offset?: number`;
  `composerApi.predictionLeagues(): Promise<string[]>` — both used by
  Task 8's page component. `composerApi.predictionAccuracy()` already
  exists and needs no change (used by Task 8 as-is).

- [ ] **Step 1: Add `offset` to the `predictions` query type**

In `frontend/src/lib/composerApi.ts`, find:

```typescript
  predictions: (q: { outcome?: string; league?: string; search?: string; limit?: number } = {}) => {
```

Change to:

```typescript
  predictions: (q: { outcome?: string; league?: string; search?: string; limit?: number; offset?: number } = {}) => {
```

(The function body below it already builds the query string generically
from `Object.entries(q)`, so no other change is needed there.)

- [ ] **Step 2: Add `predictionLeagues`**

Immediately after the existing `predictionAccuracy: () =>
req<PredictionAccuracyStats>("/predictions/accuracy"),` line, add:

```typescript
  predictionLeagues: () => req<string[]>("/predictions/leagues"),
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: exits 0, no new type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/composerApi.ts
git commit -m "feat(frontend): add offset param and predictionLeagues to composerApi"
```

---

## Task 7: Frontend — `PredictionTrackCard` component

**Files:**
- Create: `frontend/src/components/predictions/PredictionTrackCard.tsx`
- Test: `frontend/src/components/predictions/__tests__/PredictionTrackCard.test.tsx`

**Interfaces:**
- Consumes: `Prediction` type from `@/lib/composerApi` (already has
  `team_a`, `team_b`, `venue`, `league`, `prob_team_a`, `predicted_winner`,
  `actual_winner`, `result_summary`, `outcome`, `created_at`); `TeamBadge`
  from `@/components/common/TeamBadge` (Task 5); `formatDateStamp` from
  `@/lib/storiesApi` (already exists, formats an ISO string as
  `"16 AUG 2026"`).
- Produces: `PredictionTrackCard({ prediction: Prediction })` — default
  export, used by Task 8's page.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/predictions/__tests__/PredictionTrackCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PredictionTrackCard from "../PredictionTrackCard";
import type { Prediction } from "@/lib/composerApi";

const base: Prediction = {
  id: 1,
  fixture_id: 1,
  team_a: "Trent Rockets",
  team_b: "Manchester Super Giants",
  venue: "Lord's, London",
  league: "The Hundred",
  prob_team_a: 0.4843,
  reasons: [],
  predicted_winner: "Manchester Super Giants",
  actual_winner: null,
  result_summary: null,
  outcome: "pending",
  created_at: "2026-08-16T12:00:00Z",
  evaluated_at: null,
};

describe("PredictionTrackCard", () => {
  it("shows the model pick and probability", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText(/Manchester Super Giants/)).toBeInTheDocument();
    expect(screen.getByText(/51%|52%/)).toBeInTheDocument();
  });

  it("labels a pending prediction distinctly, not as a skeleton", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    expect(document.querySelector(".ds-skeleton")).toBeNull();
  });

  it("shows the actual result on a correct prediction", () => {
    render(
      <PredictionTrackCard
        prediction={{
          ...base,
          outcome: "correct",
          actual_winner: "Manchester Super Giants",
          result_summary: "won by 5 wickets",
        }}
      />
    );
    expect(screen.getByText(/Correct/i)).toBeInTheDocument();
    expect(screen.getByText(/won by 5 wickets/)).toBeInTheDocument();
  });

  it("labels an incorrect prediction without implying an error", () => {
    render(
      <PredictionTrackCard
        prediction={{ ...base, outcome: "incorrect", actual_winner: "Trent Rockets" }}
      />
    );
    const badge = screen.getByText(/Incorrect/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: "#d97706" }); // --warning, not --error
  });

  it("labels a void prediction distinctly from pending", () => {
    render(<PredictionTrackCard prediction={{ ...base, outcome: "void" }} />);
    expect(screen.getByText(/No Result/i)).toBeInTheDocument();
  });

  it("renders the predicted-on date", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText("16 AUG 2026")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- PredictionTrackCard`
Expected: FAIL — module `../PredictionTrackCard` doesn't exist.

- [ ] **Step 3: Write the component**

```typescript
// frontend/src/components/predictions/PredictionTrackCard.tsx
"use client";

import { motion } from "framer-motion";
import type { Prediction } from "@/lib/composerApi";
import { formatDateStamp } from "@/lib/storiesApi";
import TeamBadge from "@/components/common/TeamBadge";
import { prefersReducedMotion } from "@/lib/motion";

const OUTCOME_DISPLAY: Record<
  Prediction["outcome"],
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Pending", color: "var(--fg-muted)", bg: "var(--surface)" },
  correct: { label: "Correct", color: "var(--success)", bg: "var(--success-tint)" },
  incorrect: { label: "Incorrect", color: "var(--warning)", bg: "var(--warning-tint)" },
  void: { label: "No Result", color: "var(--fg-muted)", bg: "var(--surface)" },
};

export default function PredictionTrackCard({ prediction }: { prediction: Prediction }) {
  const isReduced = prefersReducedMotion();
  const pct = Math.round(
    (prediction.predicted_winner === prediction.team_a
      ? prediction.prob_team_a
      : 1 - prediction.prob_team_a) * 100
  );
  const outcomeInfo = OUTCOME_DISPLAY[prediction.outcome];

  return (
    <motion.div
      className="ds-bento-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        padding: "22px 24px",
      }}
      whileHover={isReduced ? undefined : { y: -3 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          {prediction.league}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: outcomeInfo.color,
            background: outcomeInfo.bg,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {outcomeInfo.label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <TeamBadge team={prediction.predicted_winner} size={32} />
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--text-base)", color: "var(--fg)" }}>
            {prediction.predicted_winner} · {pct}%
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
            {prediction.team_a} vs {prediction.team_b} · {prediction.venue}
          </p>
        </div>
      </div>

      {prediction.actual_winner && (
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg)" }}>
          Result: {prediction.actual_winner}
          {prediction.result_summary ? ` — ${prediction.result_summary}` : ""}
        </p>
      )}

      <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
        {formatDateStamp(prediction.created_at)}
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- PredictionTrackCard`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/predictions
git commit -m "feat(frontend): add PredictionTrackCard component"
```

---

## Task 8: Frontend — `/predictions` page + layout

**Files:**
- Create: `frontend/src/app/predictions/layout.tsx`
- Create: `frontend/src/app/predictions/page.tsx`
- Test: `frontend/src/app/predictions/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `composerApi.predictions`, `composerApi.predictionLeagues`,
  `composerApi.predictionAccuracy` (Task 6); `PredictionTrackCard`
  (Task 7); `Prediction`/`PredictionAccuracyStats` types from
  `@/lib/composerApi`.
- Produces: the public route at `/predictions`.

- [ ] **Step 1: Write the layout (no test needed — static metadata, mirrors `stories/layout.tsx` exactly)**

```typescript
// frontend/src/app/predictions/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Prediction Track Record — The Cricket Fan",
  description:
    "Every prediction our model has made, when we made it, and what actually happened. No cherry-picking.",
  openGraph: {
    title: "Prediction Track Record — The Cricket Fan",
    description:
      "Every prediction our model has made, when we made it, and what actually happened.",
    type: "website",
  },
};

export default function PredictionsLayout({ children }: { children: ReactNode }) {
  return children;
}
```

- [ ] **Step 2: Write the failing page tests**

```typescript
// frontend/src/app/predictions/__tests__/page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PredictionsPage from "../page";
import { composerApi } from "@/lib/composerApi";
import type { Prediction, PredictionAccuracyStats } from "@/lib/composerApi";

const accuracy: PredictionAccuracyStats = {
  total: 10,
  evaluated: 8,
  pending: 2,
  correct: 5,
  incorrect: 3,
  void: 0,
  accuracy_pct: 63,
  streak: 2,
  streak_type: "win",
  recent_outcomes: ["correct", "correct"],
  by_league: [],
};

const pred = (over: Partial<Prediction>): Prediction => ({
  id: 1,
  fixture_id: 1,
  team_a: "Trent Rockets",
  team_b: "Manchester Super Giants",
  venue: "Lord's, London",
  league: "The Hundred",
  prob_team_a: 0.4843,
  reasons: [],
  predicted_winner: "Manchester Super Giants",
  actual_winner: null,
  result_summary: null,
  outcome: "pending",
  created_at: "2026-08-16T12:00:00Z",
  evaluated_at: null,
  ...over,
});

beforeEach(() => {
  vi.spyOn(composerApi, "predictionAccuracy").mockResolvedValue(accuracy);
  vi.spyOn(composerApi, "predictionLeagues").mockResolvedValue(["IPL", "The Hundred"]);
});

describe("PredictionsPage", () => {
  it("renders pending predictions above settled history", async () => {
    const predictionsSpy = vi
      .spyOn(composerApi, "predictions")
      .mockImplementation(async (q) => {
        if (q?.outcome === "pending") return [pred({ id: 1, team_a: "Trent Rockets" })];
        return [pred({ id: 2, outcome: "correct", team_a: "Mumbai Indians", team_b: "Chennai Super Kings", predicted_winner: "Mumbai Indians", actual_winner: "Mumbai Indians" })];
      });
    render(<PredictionsPage />);

    const pendingCard = await screen.findByText(/Trent Rockets vs Manchester Super Giants/);
    const settledCard = await screen.findByText(/Mumbai Indians vs Chennai Super Kings/);
    expect(pendingCard.compareDocumentPosition(settledCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(predictionsSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "pending" }));
    expect(predictionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "correct,incorrect,void" })
    );
  });

  it("renders the accuracy summary strip", async () => {
    vi.spyOn(composerApi, "predictions").mockResolvedValue([]);
    render(<PredictionsPage />);
    expect(await screen.findByText(/63%/)).toBeInTheDocument();
    expect(screen.getByText(/8 Evaluated/)).toBeInTheDocument();
  });

  it("shows an explicit empty state when a league has no predictions", async () => {
    vi.spyOn(composerApi, "predictions").mockResolvedValue([]);
    render(<PredictionsPage />);
    expect(await screen.findByText(/No predictions recorded/i)).toBeInTheDocument();
  });

  it("load more appends the next offset page without duplicating", async () => {
    const settled = Array.from({ length: 20 }, (_, i) =>
      pred({ id: 100 + i, outcome: "correct", team_a: `Team ${i}` })
    );
    vi.spyOn(composerApi, "predictions").mockImplementation(async (q) => {
      if (q?.outcome === "pending") return [];
      if ((q?.offset ?? 0) === 0) return settled;
      return [pred({ id: 999, outcome: "correct", team_a: "Team Next Page" })];
    });
    render(<PredictionsPage />);

    await screen.findByText(/Team 0/);
    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => expect(screen.getByText(/Team Next Page/)).toBeInTheDocument());
    expect(screen.getAllByText(/Team 0/).length).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npm test -- app/predictions/__tests__/page.test.tsx`
Expected: FAIL — module `../page` doesn't exist.

- [ ] **Step 4: Write the page**

```typescript
// frontend/src/app/predictions/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { composerApi } from "@/lib/composerApi";
import type { Prediction, PredictionAccuracyStats } from "@/lib/composerApi";
import PredictionTrackCard from "@/components/predictions/PredictionTrackCard";

const PAGE_SIZE = 20;

export default function PredictionsPage() {
  const [accuracy, setAccuracy] = useState<PredictionAccuracyStats | null>(null);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [pending, setPending] = useState<Prediction[]>([]);
  const [settled, setSettled] = useState<Prediction[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    composerApi.predictionAccuracy().then(setAccuracy).catch(() => setAccuracy(null));
    composerApi.predictionLeagues().then(setLeagues).catch(() => setLeagues([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    const leagueParam = selectedLeague || undefined;

    Promise.all([
      composerApi.predictions({ outcome: "pending", league: leagueParam }),
      composerApi.predictions({
        outcome: "correct,incorrect,void",
        league: leagueParam,
        limit: PAGE_SIZE,
        offset: 0,
      }),
    ])
      .then(([pendingRows, settledRows]) => {
        if (cancelled) return;
        setPending(pendingRows);
        setSettled(settledRows);
        setHasMore(settledRows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled) return;
        setPending([]);
        setSettled([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLeague]);

  async function loadMore() {
    setLoadingMore(true);
    const nextOffset = offset + PAGE_SIZE;
    try {
      const rows = await composerApi.predictions({
        outcome: "correct,incorrect,void",
        league: selectedLeague || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setSettled((prev) => [...prev, ...rows]);
      setOffset(nextOffset);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const isEmpty = !loading && pending.length === 0 && settled.length === 0;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 var(--space-lg)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md) 0 var(--space-lg)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Link href="/stories" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 800,
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              The Cricket Fan
            </span>
          </Link>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <Link href="/stories" className="ds-nav-link" style={{ fontSize: 14 }}>
            The Vault
          </Link>
          <Link href="/predictions" className="ds-nav-link" style={{ color: "var(--fg)", fontWeight: 700, fontSize: 14 }}>
            Predictions
          </Link>
          <Link href="/composer" className="ds-nav-link" style={{ fontSize: 14 }}>
            Composer
          </Link>
        </nav>
      </header>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-3xl)",
          fontWeight: 800,
          color: "var(--fg)",
          margin: "0 0 var(--space-lg) 0",
        }}
      >
        Every Prediction We&apos;ve Made
      </h1>

      {accuracy && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-base)",
            color: "var(--fg-muted)",
            marginBottom: "var(--space-lg)",
          }}
        >
          {accuracy.accuracy_pct}% Hit Rate · {accuracy.evaluated} Evaluated
          {accuracy.streak > 0
            ? ` · ${accuracy.streak}-${accuracy.streak_type === "win" ? "Win" : "Loss"} Streak`
            : ""}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          overflowX: "auto",
          marginBottom: "var(--space-lg)",
        }}
      >
        <button
          onClick={() => setSelectedLeague("")}
          className="ds-nav-link"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "6px 14px",
            background: selectedLeague === "" ? "var(--fg)" : "var(--surface)",
            color: selectedLeague === "" ? "var(--surface)" : "var(--fg-muted)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          All Leagues
        </button>
        {leagues.map((lg) => (
          <button
            key={lg}
            onClick={() => setSelectedLeague(lg)}
            className="ds-nav-link"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "6px 14px",
              background: selectedLeague === lg ? "var(--fg)" : "var(--surface)",
              color: selectedLeague === lg ? "var(--surface)" : "var(--fg-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {lg}
          </button>
        ))}
      </div>

      {isEmpty && (
        <p style={{ color: "var(--fg-muted)", fontSize: "var(--text-base)" }}>
          No predictions recorded{selectedLeague ? ` for ${selectedLeague}` : ""} yet.
        </p>
      )}

      {pending.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "var(--space-md)",
            }}
          >
            Upcoming
          </h2>
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            {pending.map((p) => (
              <PredictionTrackCard key={p.id} prediction={p} />
            ))}
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "var(--space-md)",
            }}
          >
            History
          </h2>
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            {settled.map((p) => (
              <PredictionTrackCard key={p.id} prediction={p} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="ds-nav-link"
              style={{
                marginTop: "var(--space-lg)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "10px 24px",
                background: "var(--surface)",
                color: "var(--fg)",
                cursor: loadingMore ? "default" : "pointer",
                fontWeight: 600,
              }}
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm test -- app/predictions/__tests__/page.test.tsx`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Add the reciprocal nav link on `/stories`**

In `frontend/src/app/stories/page.tsx`, inside the existing `<nav>` block
(the one containing the `Link href="/stories"` "The Vault" item and the
`Link href="/composer"` "Composer" item), add a new item between them:

```typescript
          <Link
            href="/predictions"
            className="ds-nav-link"
            style={{
              fontSize: 14,
            }}
          >
            Predictions
          </Link>
```

- [ ] **Step 7: Run the full frontend build**

Run: `cd frontend && npm run build`
Expected: exits 0, `/predictions` appears in the route list output
alongside the existing routes.

- [ ] **Step 8: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: all pass, no regressions in existing test files.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/predictions frontend/src/app/stories/page.tsx
git commit -m "feat(frontend): add public /predictions track record page"
```

---

## Task 9: Final verification

**Files:** none (verification-only task)

- [ ] **Step 1: Full backend suite**

Run: `bot/.venv/bin/python -m pytest bot/tests composer/tests`
Expected: previous total + 4 new tests (Tasks 1-3, per Task 4's count),
same single pre-existing unrelated failure as noted in Task 4, nothing
else failing.

- [ ] **Step 2: Full frontend suite**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: tests pass; build exits 0; lint shows only pre-existing errors
confined to generated `.vercel/output/` artifacts (not source files) —
verify by checking lint output only lists `frontend/src/...` paths that
were already warning-only before this plan (per this session's earlier
verified baseline: 3 pre-existing unused-var warnings in
`backtest/page.tsx`, `composerApi.ts`, `storiesApi.ts`, nothing new).

- [ ] **Step 3: Manual smoke check against the real dev DB**

```bash
bot/.venv/bin/python -m uvicorn composer.app:app --reload --port 8000 &
cd frontend && npm run dev &
```

Open `http://localhost:3000/predictions` — confirm the Trent Rockets vs
Manchester Super Giants Hundred final (manually seeded fixture id 14
during this session, see conversation history) shows in the Upcoming
section with its prediction, the accuracy strip renders real numbers, the
league filter includes "The Hundred", and "Load More" (if enough settled
predictions exist) appends without duplicating.

- [ ] **Step 4: No commit** (verification only — if Steps 1-3 all pass,
  this plan is complete and ready for `superpowers:requesting-code-review`
  before merge/deploy, per this project's CLAUDE.md skill table)
