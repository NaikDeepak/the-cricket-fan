# Handoff — Prediction model per-league gate (Phase 1)

Written 2026-08-16, mid-execution, paused by request. Everything below,
including this file, is committed (`HEAD` = `c5b71e0`). Read this, then
the spec, then the plan, then resume the SDD loop.

## Status at a glance

| Task | What it builds | Status |
|---|---|---|
| 1. `bot/gating.py` — per-league gate (pure function) | `per_league_gate()` + 7 unit tests | ✅ **DONE** — implemented, reviewed, approved. Commits `b71d7f2..2d512b7`. 2 minors parked (non-blocking). |
| 2. Wire gate into `bot/train.py` + `bot/predict.py` | `league` in `build_dataset`'s meta; `per_league`/`league_elo_override` in metrics + artifact; `load_artifact` backward-compat | ✅ **DONE** — implemented, reviewed, approved. Commits `2d512b7..62b3423`. 1 Important finding parked with ruling + 2 minors parked (all non-blocking, see below). |
| 3. `bot/elo.py::build_from_matches` | Replay match history into a ready `Elo` instance for live serving | ⬜ **TODO** — not started. Next action on resume. |
| 4. `predictions.source` column + `run_model` Elo-fallback routing | `bot/db.py` schema + `composer/routers/predictions.py` | ⬜ **TODO** — not started. Depends on Tasks 2 (done) and 3 (todo). |
| Final whole-branch review | — | ⬜ **TODO** — after Task 4. |
| PR into `feature/mvp` | — | ⬜ **TODO** — after final review, via `finishing-a-development-branch`. |

**Nothing is mid-loop.** Both done tasks closed cleanly (reviewed +
ledgered `complete`) before the pause — resuming is just "start Task 3,"
not "reconcile an in-flight subagent."

## What this is

Phase 1 of a 5-phase prediction-model-quality effort (see origin story in
the spec). Investigated user's report of IPL prediction accuracy dropping
from 80s (pre-2023) to 50s/60s (2025/2026). Root cause turned out NOT to
be an ingestion bug and NOT (on the evidence gathered) squad-turnover
disruption — both investigated and the turnover hypothesis was retracted
after a controlled test came back null. What held up: **the model's real
out-of-sample edge over Elo is close to zero, and the current training
gate can't see that** — confirmed empirically (model lost to Elo on
accuracy in 6/6 genuinely held-out league-seasons while the gate read
`gate_passed: true`). Phase 1 fixes the gate's blindness: a per-league
log-loss/Brier check, and routing a failing league's live predictions
through Elo instead of the model until it recovers.

## Documents (read in this order)

1. Diagnostic data: `docs/prediction-accuracy-by-league-season.md` (has
   two correction notes — read the corrections, they matter, the first
   version of the analysis was wrong).
2. Spec: `docs/superpowers/specs/2026-08-16-prediction-model-quality-design.md`
   — full 5-phase design. This handoff only covers Phase 1 (section "1.
   Per-league gate + Elo-fallback routing").
3. Plan: `docs/superpowers/plans/2026-08-16-prediction-model-per-league-gate.md`
   — Phase 1's implementation plan, 4 tasks, being executed via
   `superpowers:subagent-driven-development`.

## State of the repo / worktree

- **Worktree:** `.claude/worktrees/prediction-model-per-league-gate`
  (created via the `EnterWorktree` tool, not manual `git worktree add`).
- **Branch:** `worktree-prediction-model-per-league-gate`, based on
  `origin/feature/mvp` at `af4ea2c` (the commit that merged
  `feature/apple-ui-design-pass` — origin's default branch is
  `feature/mvp`, confirmed via `remotes/origin/HEAD -> origin/feature/mvp`).
- **2 commits cherry-picked** onto this branch from local
  `feature/apple-ui-design-pass` (which had them but hadn't pushed/merged
  them into `mvp` yet): the ingest bug fixes + spec doc (`4842122` →
  `d8aacb5` here) and the plan doc (`3a43718` → `b71d7f2` here). If you
  resume from a **different** worktree/checkout, verify these 2 commits'
  content exists somewhere reachable — they are NOT yet on `feature/mvp`
  upstream, only on this branch and on the local (uncommitted-elsewhere)
  `feature/apple-ui-design-pass`.
- **2 of 4 plan tasks complete, reviewed, clean (both ledgered
  `complete`).** Current `HEAD`: `62b3423`.

  ```
  b71d7f2  (plan doc — base for Task 1)
  2d512b7  Task 1: feat(bot): add per-league prediction quality gate (pure function)
  62b3423  Task 2: feat(bot): wire per-league gate into train_and_evaluate; carry league through build_dataset
  ```

- **Task 3 not started. Task 4 not started.** Nothing is mid-loop — both
  completed tasks' reviews landed and were ledgered before the pause, so
  there is no in-flight subagent to reconcile on resume.

## Ledger — the authoritative progress record

`.superpowers/sdd/2026-08-16-prediction-model-per-league-gate/progress.md`
(inside this worktree, git-ignored — not in the commits above, lives only
on disk here). **Read this file before doing anything else on resume** —
it has the pre-flight conflict scan, both task completions, and one
ruling already made:

- **Ruling (Task 2, pre-review):** the plan's Task 2 Step 5 test fixture
  (`synthetic_multi_league_matches(n_per_league=300)`) was a plan defect
  — two 300-match synthetic leagues sharing one hardcoded date grid only
  span ~2 calendar years, leaving `train_and_evaluate`'s `tr = years <=
  max_year-2` empty (`ValueError`, not the plan's predicted
  `KeyError`/`AssertionError`). The implementer verified this empirically
  before touching anything and fixed it by bumping to `n_per_league=600`
  (matching the span of the already-passing 600-match single-league
  test), changing only the test fixture value, not any brief
  implementation code. **Ruled approved** — cost if wrong is negligible
  (a slower test, no behavioral gap).
- **Ruling (Task 2, post-review):** the reviewer flagged one Important,
  plan-mandated finding — `load_artifact`'s bare
  `except Exception: art["explainer"] = None` (`bot/predict.py:23-26`)
  has no log line, so a genuinely corrupted production artifact would
  silently degrade SHAP-derived prediction "reasons" to the hardcoded
  fallback with no signal. **Parked, not fix-looped** — this mirrors the
  brief's own given code exactly (not an implementer deviation), real
  LightGBM artifacts never hit this branch, and it's consistent with an
  existing bare `except Exception:` a few lines below in `predict()`'s
  own reasons-fallback — not a new failure mode this task introduced.
  Cost if wrong: low likelihood/low blast radius (probability output is
  unaffected), one-line follow-up (`log.warning`) whenever this file is
  next touched.
- 2 minor findings deferred from Task 1 (non-blocking, in the ledger).
- 2 minor findings deferred from Task 2: a synthetic-fixture-only dedup
  collision in the test fixture (real leagues don't share team names, so
  not a production concern) and `import joblib` placed inside a test
  function instead of at module top (cosmetic, inconsistent with
  `test_train.py`'s style for the same import).

If the ledger's first line names this plan file, trust it over this
handoff for anything the two disagree on — the ledger is closer to the
ground truth and was updated more recently.

## Environment — critical gotchas

- **Python is `bot/.venv/bin/python`** (repo venv), invoked with
  `PYTHONPATH=.` from the repo root for anything importing `bot.*` or
  `composer.*` as a package (e.g. `PYTHONPATH=. bot/.venv/bin/python -m
  pytest bot/tests/ -v`).
- **This worktree does not have its own `bot/.venv`** — git worktrees
  don't share git-ignored directories. A symlink was created:
  `bot/.venv -> /Users/deepaknaik/Downloads/world-building/the-cricket-fan/bot/.venv`
  (the main checkout's real venv). It shows as untracked in `git status`
  (gitignore's `.venv/` pattern doesn't match a symlink named `.venv`,
  only a real directory) — **do not `git add` it**. If this worktree is
  gone when you resume, recreate the symlink (fast) rather than
  reinstalling `bot/requirements.txt`/`composer/requirements.txt` from
  scratch (slow, and identical packages already exist in the main
  checkout).
- Full `bot/` + `composer/` suite is slow: **222 tests, ~155s** baseline
  (confirmed clean before Task 1 started). Full `bot/` suite alone after
  Task 2: **166 tests, ~147s**, all passing. While iterating, run only
  the file being changed; run the full suite once before a commit.
- Lint: `bot/.venv/bin/python -m ruff check <paths> && bot/.venv/bin/python -m ruff format --check <paths>`. Line length 99. Must be clean before each task's commit (all tasks so far are clean).

## Resuming

This is being executed via `superpowers:subagent-driven-development`. On
resume:

1. `cd` into this worktree (or re-enter it via `EnterWorktree` with
   `path: .claude/worktrees/prediction-model-per-league-gate` if starting
   a fresh session).
2. Recreate the `bot/.venv` symlink if missing (see above).
3. Read the ledger (`.superpowers/sdd/.../progress.md`) — it is the
   source of truth for what's done. Task 1 and Task 2 both show a
   `Task N: complete (commits ..., review clean / 1 parked)` line — do
   not re-dispatch either; both are fully closed, nothing mid-loop.
4. Proceed straight to Task 3 (`bot/elo.py::build_from_matches`) per the
   plan — `task-brief PLAN_FILE 3`, dispatch implementer, once DONE
   generate the review package and dispatch a task reviewer, ledger the
   result (same pattern as Tasks 1-2, see the ledger for exact model
   choices used so far: haiku for Task 1's pure-function implementer,
   sonnet for Task 2's implementer and both reviewers so far — Task 3 is
   also a small pure-function task with complete code in the brief, so
   the cheap-tier implementer is appropriate per the plan's own Model
   Selection guidance).
5. Task 4 depends on both Task 2 (artifact's `league_elo_override` key)
   and Task 3 (`build_from_matches`) — dispatch it last.
6. After Task 4's review is clean, run the **final whole-branch review**
   (`scripts/review-package PLAN_FILE <merge-base-with-feature/mvp> HEAD`,
   most capable model available) per the skill, then
   `superpowers:finishing-a-development-branch` to open the PR into
   `feature/mvp` — **not** `feature/apple-ui-design-pass`, which this
   branch does not descend from in the upstream remote (it descends from
   `feature/mvp` directly, with the two cherry-picks layered on top; the
   PR target should still be `feature/mvp` since that's this repo's base
   branch).

## What's explicitly NOT done yet (don't assume otherwise)

- No `Elo.build_from_matches` (Task 3).
- No `predictions.source` column, no `run_model` Elo-fallback routing
  (Task 4) — the model still serves every league today, even ones a
  future retrain's `league_elo_override` list would flag.
- No retrain has actually run against this code yet — `bot/artifacts/model.pkl`
  and `metrics.json` in this worktree are unchanged from what's on
  `feature/mvp`; they will not show `per_league`/`league_elo_override`
  until the next scheduled retrain (`.github/workflows/bot-retrain.yml`)
  runs against merged Phase 1 code.
- Phases 2-5 of the spec (split/calibration fix, league-as-feature +
  Elo-as-feature, `match_id`/ingestion/versioning, squad turnover) are
  **not started** and are out of scope for this plan entirely — see the
  spec for their own future planning cycles.
