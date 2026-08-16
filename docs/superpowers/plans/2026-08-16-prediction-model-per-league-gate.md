# Per-League Gate + Elo-Fallback Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-league log-loss/Brier quality gate to the retrain
pipeline (the current global gate can pass while specific leagues quietly
lose to Elo — confirmed empirically: 6/6 genuinely held-out league-seasons
lost to Elo on accuracy while `gate_passed: true`), and route a failing
league's live predictions through the Elo baseline instead of the model
until it recovers.

**Architecture:** A new pure function (`bot/gating.py::per_league_gate`)
buckets historical (league, outcome, model-probability, Elo-probability)
rows into a trailing 12-month window per league and computes model-vs-Elo
log-loss/Brier per league with a minimum-sample floor. `bot/train.py`
wires this into `train_and_evaluate`, persisting the result into both
`metrics.json` (audit trail) and the committed artifact dict
(`league_elo_override: list[str]`). `bot/elo.py` gains a helper to replay
match history into a ready-to-query `Elo` instance. `composer/routers/predictions.py`'s
live serving endpoint (`run_model`) consults the artifact's override list
per fixture and serves Elo instead of the model for leagues on it,
recording which source served each prediction.

**Tech Stack:** Python 3.12, pandas, numpy, scikit-learn (`log_loss`,
`brier_score_loss`), LightGBM, SQLAlchemy 2.0 (SQLite locally / Postgres
prod), FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-08-16-prediction-model-quality-design.md`
(section "1. Per-league gate + Elo-fallback routing"). Background data:
`docs/prediction-accuracy-by-league-season.md`.

## Global Constraints

- Python line length: 99 chars (ruff enforced), per `CLAUDE.md`.
- Async everywhere for FastAPI route handlers — **exception**: `run_model`
  and its sibling routes in `composer/routers/predictions.py` are already
  written as plain `def` (sync) handlers in this file; match the existing
  file's convention, do not convert to `async def`.
- No new external dependencies — everything needed (pandas, numpy,
  scikit-learn, SQLAlchemy) is already in `bot/requirements.txt` /
  `composer/requirements.txt`.
- Follow existing test conventions exactly: `bot/tests/` uses plain
  pytest functions + the `synthetic_team_matches()` generator in
  `bot/tests/test_train.py`; `composer/tests/` uses the `client`/`conn`
  fixtures from `composer/tests/conftest.py` and sets
  `client.app.state.artifact` directly (see `composer/tests/test_backtest_endpoint.py`
  for the established pattern).
- This plan is **Phase 1 only** of the linked spec. Do not touch: the
  train/val/test split or calibration method (Phase 2), `league` as a
  model *input* feature or Elo-as-a-feature (Phase 3), `match_id`/upsert
  ingestion or artifact version directories (Phase 4), or squad turnover
  (Phase 5, deferred).

---

## File Structure

| File | Responsibility |
|---|---|
| `bot/gating.py` (new) | Pure, unit-testable per-league gate computation. No pandas/DB/model coupling beyond taking already-computed arrays. |
| `bot/tests/test_gating.py` (new) | Unit tests for `per_league_gate`. |
| `bot/train.py` (modify) | Wire `per_league_gate` into `train_and_evaluate`; carry `league` through `build_dataset`'s `meta`. |
| `bot/tests/test_train.py` (modify) | Add multi-league synthetic data helper; test the wiring. |
| `bot/predict.py` (modify) | `load_artifact` normalizes old artifacts that predate `league_elo_override`. |
| `bot/tests/test_predict.py` (modify) | Backward-compatibility test for the above. |
| `bot/elo.py` (modify) | Add `build_from_matches`: replay a paired-matches dataframe into a ready `Elo` instance. |
| `bot/tests/test_elo.py` (modify) | Tests for `build_from_matches`. |
| `bot/db.py` (modify) | Add nullable `source` column to `predictions` (`"model"` \| `"elo_fallback"`). |
| `composer/routers/predictions.py` (modify) | `run_model`: use `request.app.state.artifact` (matches the existing `run_backtest_endpoint` pattern) instead of re-loading from disk; route override-league fixtures to Elo; record `source`. |
| `composer/tests/test_run_model.py` (new) | End-to-end tests for the routing behavior. |

---

### Task 1: `bot/gating.py` — per-league quality gate (pure function)

**Files:**
- Create: `bot/gating.py`
- Test: `bot/tests/test_gating.py`

**Interfaces:**
- Produces: `MIN_LEAGUE_N: int = 30`, `TRAILING_WINDOW_MONTHS: int = 12`,
  `per_league_gate(league, date, y, p_model, p_elo, latest_date, min_n=MIN_LEAGUE_N, window_months=TRAILING_WINDOW_MONTHS) -> tuple[dict[str, dict], list[str]]`.
  All of `league`/`date`/`y`/`p_model`/`p_elo` are same-length
  array-likes (list, `np.ndarray`, or `pd.Series` — the function converts
  internally via `np.asarray`/`pd.to_datetime`, so it does not rely on
  pandas index alignment between arguments). `latest_date` is anything
  `pd.Timestamp(...)` accepts (a `datetime.date`, `datetime.datetime`, or
  string). Returns `(per_league, league_elo_override)` where
  `per_league[lg]` is `{"n": int, "gated": False}` when `n < min_n`, or
  `{"n": int, "gated": True, "passed": bool, "model_log_loss": float, "elo_log_loss": float, "model_brier": float, "elo_brier": float}`
  when `n >= min_n`. `league_elo_override` is the sorted list of leagues
  where `gated=True and passed=False`.

- [ ] **Step 1: Write the failing tests**

Create `bot/tests/test_gating.py`:

```python
import numpy as np
import pandas as pd
import pytest

from bot.gating import MIN_LEAGUE_N, TRAILING_WINDOW_MONTHS, per_league_gate


def test_defaults():
    assert MIN_LEAGUE_N == 30
    assert TRAILING_WINDOW_MONTHS == 12


def _dates_within_window(n, latest="2026-08-01"):
    """n dates spaced 1 day apart, ending on `latest` (all inside a 12mo window)."""
    end = pd.Timestamp(latest)
    return [end - pd.Timedelta(days=i) for i in range(n)][::-1]


def test_league_below_min_n_is_not_gated():
    n = 10
    dates = _dates_within_window(n)
    league = ["TINY"] * n
    y = [1, 0] * (n // 2)
    p_model = [0.6] * n
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league, dates, y, p_model, p_elo, latest_date="2026-08-01"
    )
    assert per_league["TINY"] == {"n": n, "gated": False}
    assert "TINY" not in override


def test_matches_outside_trailing_window_are_excluded():
    # 40 matches, all 3 years before the window anchor -> 0 fall inside
    # the trailing 12-month window, so the league reads n=0, not n=40.
    n = 40
    old_dates = [pd.Timestamp("2023-01-01") - pd.Timedelta(days=i) for i in range(n)]
    league = ["OLD"] * n
    y = [1, 0] * (n // 2)
    p_model = [0.6] * n
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league, old_dates, y, p_model, p_elo, latest_date="2026-08-01"
    )
    assert per_league["OLD"]["n"] == 0
    assert per_league["OLD"]["gated"] is False
    assert "OLD" not in override


def test_league_fails_gate_when_model_worse_than_elo():
    n = 40
    dates = _dates_within_window(n)
    league = ["BAD"] * n
    rng = np.random.default_rng(0)
    y = rng.integers(0, 2, size=n).tolist()
    # model confidently predicts the WRONG side every time; elo stays neutral
    p_model = [0.02 if yi == 1 else 0.98 for yi in y]
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league, dates, y, p_model, p_elo, latest_date="2026-08-01"
    )
    assert per_league["BAD"]["n"] == n
    assert per_league["BAD"]["gated"] is True
    assert per_league["BAD"]["passed"] is False
    assert per_league["BAD"]["model_log_loss"] > per_league["BAD"]["elo_log_loss"]
    assert "BAD" in override


def test_league_passes_gate_when_model_better_than_elo():
    n = 40
    dates = _dates_within_window(n)
    league = ["GOOD"] * n
    rng = np.random.default_rng(1)
    y = rng.integers(0, 2, size=n).tolist()
    # model confidently predicts the RIGHT side every time; elo stays neutral
    p_model = [0.98 if yi == 1 else 0.02 for yi in y]
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league, dates, y, p_model, p_elo, latest_date="2026-08-01"
    )
    assert per_league["GOOD"]["gated"] is True
    assert per_league["GOOD"]["passed"] is True
    assert per_league["GOOD"]["model_log_loss"] < per_league["GOOD"]["elo_log_loss"]
    assert "GOOD" not in override


def test_single_class_window_does_not_raise():
    # All-one-outcome trailing window is a legitimate (if unlucky) real
    # scenario -- must compute cleanly, not raise, via log_loss(labels=[0,1]).
    n = 30
    dates = _dates_within_window(n)
    league = ["MONO"] * n
    y = [1] * n
    p_model = [0.7] * n
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league, dates, y, p_model, p_elo, latest_date="2026-08-01"
    )
    assert per_league["MONO"]["gated"] is True
    assert np.isfinite(per_league["MONO"]["model_log_loss"])


def test_multiple_leagues_independent_and_sorted():
    n = 40
    dates = _dates_within_window(n)
    rng = np.random.default_rng(2)
    y = rng.integers(0, 2, size=n).tolist()
    league_good = ["ZETA_GOOD"] * n
    league_bad = ["ALPHA_BAD"] * n
    p_model_good = [0.98 if yi == 1 else 0.02 for yi in y]
    p_model_bad = [0.02 if yi == 1 else 0.98 for yi in y]
    p_elo = [0.5] * n
    per_league, override = per_league_gate(
        league_good + league_bad,
        dates + dates,
        y + y,
        p_model_good + p_model_bad,
        p_elo + p_elo,
        latest_date="2026-08-01",
    )
    assert set(per_league) == {"ZETA_GOOD", "ALPHA_BAD"}
    assert override == ["ALPHA_BAD"]  # sorted, and GOOD is not in it
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_gating.py -v`
Expected: `ModuleNotFoundError: No module named 'bot.gating'` (or collection
error) — the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `bot/gating.py`:

```python
"""Per-league prediction-quality gate.

bot/train.py's global gate (train_and_evaluate's gate_passed) checks the
model against Elo on ONE pooled test set across all 28 leagues. That can
pass while specific leagues quietly lose to Elo -- confirmed empirically
(docs/superpowers/specs/2026-08-16-prediction-model-quality-design.md):
the model lost to Elo on accuracy in 6/6 genuinely held-out league-seasons
while the global gate read gate_passed: true. A small league can't move
the pooled aggregate enough to fail it even when it's badly behind.

per_league_gate() computes a per-league log-loss/Brier check on a
trailing window, independent of and wider than the global test window --
most of the 28 leagues don't have enough matches in a short window to be
measured honestly (a scan found only 9/28 leagues clear 15 matches in any
3-month window).

Known Phase 1 limitation: the model-probability array this is fed may
include in-sample predictions (rows the model trained on) for the portion
of the trailing window that overlaps the training split, since Phase 1
does not change bot/train.py's train/val/test split (that's a separate,
later change). This makes the per-league numbers a slight overestimate of
true out-of-sample quality for now -- still strictly more honest than the
current global-only gate, which has the same limitation for its own test
window plus no per-league visibility at all.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss

MIN_LEAGUE_N = 30
TRAILING_WINDOW_MONTHS = 12


def per_league_gate(
    league,
    date,
    y,
    p_model,
    p_elo,
    latest_date,
    min_n: int = MIN_LEAGUE_N,
    window_months: int = TRAILING_WINDOW_MONTHS,
) -> tuple[dict[str, dict], list[str]]:
    """Buckets historical predictions by league within a trailing window and
    checks model vs Elo on log-loss + Brier (not accuracy -- n per league is
    too small, ~20-70, for accuracy to be anything but noisy).

    Returns (per_league, league_elo_override):
      per_league[lg] = {"n": int, "gated": False}                          if n < min_n
      per_league[lg] = {"n": int, "gated": True, "passed": bool, ...}      if n >= min_n
      league_elo_override = sorted list of leagues with gated=True and passed=False --
        these should be served from Elo instead of the model until they recover.
    """
    league_arr = np.asarray(league)
    dates = pd.to_datetime(pd.Series(list(date))).to_numpy()
    y_arr = np.asarray(y)
    p_model_arr = np.clip(np.asarray(p_model, dtype=float), 0.01, 0.99)
    p_elo_arr = np.clip(np.asarray(p_elo, dtype=float), 0.01, 0.99)

    trailing_start = np.datetime64(
        pd.Timestamp(latest_date) - pd.DateOffset(months=window_months)
    )
    in_window = dates > trailing_start

    per_league: dict[str, dict] = {}
    override: list[str] = []
    for lg in sorted(set(league_arr.tolist())):
        mask = in_window & (league_arr == lg)
        n = int(mask.sum())
        if n < min_n:
            per_league[lg] = {"n": n, "gated": False}
            continue

        y_lg = y_arr[mask]
        model_ll = float(log_loss(y_lg, p_model_arr[mask], labels=[0, 1]))
        elo_ll = float(log_loss(y_lg, p_elo_arr[mask], labels=[0, 1]))
        model_br = float(brier_score_loss(y_lg, p_model_arr[mask]))
        elo_br = float(brier_score_loss(y_lg, p_elo_arr[mask]))
        passed = model_ll < elo_ll and model_br < elo_br

        per_league[lg] = {
            "n": n,
            "gated": True,
            "passed": passed,
            "model_log_loss": model_ll,
            "elo_log_loss": elo_ll,
            "model_brier": model_br,
            "elo_brier": elo_br,
        }
        if not passed:
            override.append(lg)

    return per_league, sorted(override)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_gating.py -v`
Expected: all 7 tests PASS.

- [ ] **Step 5: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/gating.py bot/tests/test_gating.py && bot/.venv/bin/python -m ruff format --check bot/gating.py bot/tests/test_gating.py`
Expected: no errors. If format check fails, run `bot/.venv/bin/python -m ruff format bot/gating.py bot/tests/test_gating.py` and re-check.

- [ ] **Step 6: Commit**

```bash
git add bot/gating.py bot/tests/test_gating.py
git commit -m "feat(bot): add per-league prediction quality gate (pure function)"
```

---

### Task 2: Wire the gate into `bot/train.py` + carry `league` through `build_dataset`

**Files:**
- Modify: `bot/train.py:39-74` (`build_dataset`), `bot/train.py:81-145` (`train_and_evaluate`)
- Modify: `bot/predict.py:15-23` (`load_artifact`)
- Test: `bot/tests/test_train.py`, `bot/tests/test_predict.py`

**Interfaces:**
- Consumes: `bot.gating.per_league_gate` (Task 1).
- Produces: `build_dataset(df) -> (X, y, meta)` where `meta` now has an
  additional `"league"` column (string) alongside the existing
  `date`/`team_a`/`team_b`. `train_and_evaluate(...)`'s returned dict and
  written `metrics.json` gain `"per_league": dict[str, dict]` and
  `"league_elo_override": list[str]` keys (shapes from Task 1). The
  written `model.pkl` artifact dict gains a `"league_elo_override"` key
  (same list). `bot.predict.load_artifact(path)` now guarantees the
  returned dict always has a `"league_elo_override"` key (defaults to
  `[]` for artifacts trained before this change).

- [ ] **Step 1: Write the failing test for `build_dataset` carrying `league`**

Add to `bot/tests/test_train.py` (near `test_build_dataset_shapes_and_no_leakage_column`):

```python
def test_build_dataset_meta_includes_league():
    df = synthetic_team_matches(50)
    X, y, meta = build_dataset(df)
    assert "league" in meta.columns
    assert set(meta["league"]) == {"SYN"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_train.py::test_build_dataset_meta_includes_league -v`
Expected: FAIL with `KeyError: 'league'` or `AssertionError`.

- [ ] **Step 3: Implement — add `league` to `build_dataset`'s `meta`**

In `bot/train.py`, replace the `build_dataset` function body:

```python
def build_dataset(df: pd.DataFrame):
    """One sample per match. team_a = alphabetically-first team (deterministic).

    Returns (X, y, meta) where meta is a DataFrame with columns
    date/team_a/team_b/league, index-aligned with X and y.
    """
    matches = df.copy()
    matches["pair"] = matches.apply(
        lambda r: tuple(sorted([r["team"], r["opponent"]])), axis=1
    )
    # Each match has one row per team; only the home team's OWN row carries
    # home=True. Resolve home_team from BOTH rows before deduping, since
    # drop_duplicates below keeps an arbitrary (possibly away-team) row.
    home_lookup = {}
    for _, r in matches.iterrows():
        if r["home"]:
            home_lookup[(r["date"], r["pair"])] = r["team"]
    matches = matches.drop_duplicates(subset=["date", "pair"])
    feats, labels, dts, pairs, leagues = [], [], [], [], []
    for _, m in matches.iterrows():
        team_a, team_b = m["pair"]
        won_a = m["won"] if m["team"] == team_a else not m["won"]
        home_team = home_lookup.get((m["date"], m["pair"]))
        f = build_features(
            df, team_a, team_b, m["venue"], m["date"], home_team=home_team
        )
        feats.append(f)
        labels.append(1 if won_a else 0)
        dts.append(m["date"])
        pairs.append((team_a, team_b))
        leagues.append(m["league"])
    X = pd.DataFrame(feats, columns=FEATURE_NAMES)
    y = pd.Series(labels, name="y")
    meta = pd.DataFrame(
        {
            "date": dts,
            "team_a": [p[0] for p in pairs],
            "team_b": [p[1] for p in pairs],
            "league": leagues,
        }
    )
    return X, y, meta
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_train.py::test_build_dataset_meta_includes_league -v`
Expected: PASS. Also re-run the full file to confirm nothing else broke:
`bot/.venv/bin/python -m pytest bot/tests/test_train.py -v` — all PASS.

- [ ] **Step 5: Write the failing test for the gate wiring**

Add to `bot/tests/test_train.py`:

```python
def synthetic_multi_league_matches(n_per_league=300) -> pd.DataFrame:
    """Two leagues ('SYN_A', 'SYN_B') covering the same date range, so
    both have plenty of matches inside any recent trailing window."""
    a = synthetic_team_matches(n_per_league, seed=7)
    a["league"] = "SYN_A"
    b = synthetic_team_matches(n_per_league, seed=11)
    b["league"] = "SYN_B"
    return pd.concat([a, b], ignore_index=True)


def test_train_and_evaluate_includes_per_league_gate(tmp_path):
    df = synthetic_multi_league_matches(300)
    X, y, meta = build_dataset(df)
    metrics = train_and_evaluate(X, y, meta, out_dir=tmp_path)

    assert "per_league" in metrics
    assert "league_elo_override" in metrics
    assert set(metrics["per_league"]) == {"SYN_A", "SYN_B"}
    assert isinstance(metrics["league_elo_override"], list)

    saved = json.loads((tmp_path / "metrics.json").read_text())
    assert saved["per_league"] == metrics["per_league"]
    assert saved["league_elo_override"] == metrics["league_elo_override"]

    artifact = joblib.load(tmp_path / "model.pkl")
    assert artifact["league_elo_override"] == metrics["league_elo_override"]
```

Add `import joblib` to the top of `bot/tests/test_train.py` if not already present.

- [ ] **Step 6: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_train.py::test_train_and_evaluate_includes_per_league_gate -v`
Expected: FAIL with `KeyError: 'per_league'` (or similar — the key doesn't exist yet).

- [ ] **Step 7: Implement — wire `per_league_gate` into `train_and_evaluate`**

In `bot/train.py`, add the import at the top (alongside the existing
relative imports):

```python
from .gating import per_league_gate
```

Replace the `train_and_evaluate` function body from the `home_pred = ...`
line onward:

```python
    home_pred = (X.loc[te, "home_a"] >= X.loc[te, "home_b"]).astype(int)

    # Full-history model/Elo probabilities, for the per-league gate below.
    # NOTE: rows in `tr` are in-sample for `model` here (it trained on
    # them) -- a known Phase 1 limitation documented in bot/gating.py's
    # module docstring. `calibrator` was fit only on `va`, so its output
    # isn't literally memorized, but the underlying tree's raw score is.
    p_model_all = np.clip(
        calibrator.predict(model.predict_proba(X)[:, 1]), 0.01, 0.99
    )
    per_league, league_elo_override = per_league_gate(
        league=meta["league"],
        date=meta["date"],
        y=y,
        p_model=p_model_all,
        p_elo=elo_p,
        latest_date=meta["date"].max(),
    )

    metrics = {
        "model": {
            "accuracy": float(accuracy_score(y_test, p_test > 0.5)),
            "log_loss": float(log_loss(y_test, p_test)),
            "brier": float(brier_score_loss(y_test, p_test)),
        },
        "elo": {
            "accuracy": float(accuracy_score(y_test, elo_test > 0.5)),
            "log_loss": float(log_loss(y_test, elo_test)),
            "brier": float(brier_score_loss(y_test, elo_test)),
        },
        "always_home_accuracy": float(accuracy_score(y_test, home_pred)),
        "n_train": int(tr.sum()),
        "n_test": int(te.sum()),
        "test_period": str(max_year),
        "per_league": per_league,
        "league_elo_override": league_elo_override,
    }
    metrics["gate_passed"] = bool(
        metrics["model"]["log_loss"] < metrics["elo"]["log_loss"]
        and metrics["model"]["brier"] < metrics["elo"]["brier"]
    )
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    joblib.dump(
        {
            "model": model,
            "calibrator": calibrator,
            "feature_names": FEATURE_NAMES,
            "league_elo_override": league_elo_override,
        },
        out_dir / "model.pkl",
    )
    return metrics
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_train.py -v`
Expected: all PASS, including `test_train_and_evaluate_includes_per_league_gate`.

- [ ] **Step 9: Write the failing test for `load_artifact` backward compatibility**

Add to `bot/tests/test_predict.py`:

```python
def test_load_artifact_defaults_missing_league_elo_override(tmp_path):
    import joblib

    # Simulate a pre-Phase-1 artifact that predates league_elo_override.
    old_shape = {"model": object(), "calibrator": object(), "feature_names": ["form5_a"]}
    path = tmp_path / "old_model.pkl"
    joblib.dump(old_shape, path)

    art = load_artifact(path)
    assert art["league_elo_override"] == []
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_predict.py::test_load_artifact_defaults_missing_league_elo_override -v`
Expected: FAIL — `shap.TreeExplainer(art["model"])` raises on the dummy
`object()` model (SHAP can't introspect a plain object), which is what
the test needs fixed. Note the actual failure — it will error inside
`load_artifact`, not on the assertion, until Step 11 also guards the shap
call appropriately for this test. If `shap` is not installed in this env,
this line is instead skipped already (`if shap is not None:`), and the
test fails only on `KeyError: 'league_elo_override'` — either way,
confirm it fails before proceeding.

- [ ] **Step 11: Implement — normalize the artifact shape in `load_artifact`**

In `bot/predict.py`, replace `load_artifact`:

```python
def load_artifact(path: Path) -> dict:
    # Security: joblib.load executes pickled code. Safe here because the artifact
    # is produced by our own retrain workflow and committed to this repo — it is
    # never loaded from user input or fetched over the network. Do not point this
    # at untrusted files.
    art = joblib.load(path)
    art.setdefault("league_elo_override", [])
    if shap is not None:
        try:
            art["explainer"] = shap.TreeExplainer(art["model"])
        except Exception:
            art["explainer"] = None
    return art
```

(The `try/except` around `shap.TreeExplainer` is a minimal, targeted fix
so a test artifact with a placeholder `model` object doesn't blow up
`load_artifact` itself — mirroring the existing `except Exception:`
fallback already used a few lines down in `predict()` for the reasons
list. It does not change behavior for any real, LightGBM-backed artifact.)

- [ ] **Step 12: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_predict.py -v`
Expected: all PASS.

- [ ] **Step 13: Run the full bot test suite**

Run: `bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS (this catches any other consumer of `build_dataset`'s
`meta` shape or `load_artifact`'s return shape that this plan didn't
anticipate).

- [ ] **Step 14: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/train.py bot/predict.py bot/tests/test_train.py bot/tests/test_predict.py && bot/.venv/bin/python -m ruff format --check bot/train.py bot/predict.py bot/tests/test_train.py bot/tests/test_predict.py`

- [ ] **Step 15: Commit**

```bash
git add bot/train.py bot/predict.py bot/tests/test_train.py bot/tests/test_predict.py
git commit -m "feat(bot): wire per-league gate into train_and_evaluate; carry league through build_dataset"
```

---

### Task 3: `bot/elo.py` — replay match history into a ready `Elo` instance

**Files:**
- Modify: `bot/elo.py`
- Test: `bot/tests/test_elo.py`

**Interfaces:**
- Consumes: nothing new (only the existing `Elo` class in the same file).
  Designed to be called as `build_from_matches(pair_matches(df))`, where
  `pair_matches` is `bot.backtest.pair_matches` (not imported by this
  module — the caller supplies the already-paired dataframe, keeping
  `bot/elo.py` free of a dependency on `bot/backtest.py`).
- Produces: `build_from_matches(paired: pd.DataFrame) -> Elo`. `paired`
  must have columns `date`, `team_a`, `team_b`, `won_a` (exactly
  `pair_matches`'s output shape). Returns an `Elo` instance whose ratings
  reflect the full chronological history — call `.expect(team_a, team_b)`
  on it immediately for a new, not-yet-played fixture.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_elo.py`:

```python
import pandas as pd

from bot.elo import Elo, build_from_matches


def test_build_from_matches_replays_chronologically():
    # A wins twice, B wins once, in this exact date order.
    paired = pd.DataFrame(
        [
            {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": True},
            {"date": "2024-01-03", "team_a": "A", "team_b": "B", "won_a": False},
            {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": True},
        ]
    )
    elo = build_from_matches(paired)
    assert isinstance(elo, Elo)
    # A won 2 of 3 -> A should be rated above B.
    assert elo.expect("A", "B") > 0.5


def test_build_from_matches_matches_manual_chronological_replay():
    paired = pd.DataFrame(
        [
            {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": True},
            {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": False},
        ]
    )
    result = build_from_matches(paired)

    manual = Elo()
    manual.update("A", "B", a_won=False)  # 2024-01-01 first
    manual.update("A", "B", a_won=True)  # then 2024-01-02
    assert result.rating("A") == manual.rating("A")
    assert result.rating("B") == manual.rating("B")


def test_build_from_matches_ignores_input_row_order():
    rows = [
        {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": True},
        {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": False},
        {"date": "2024-01-03", "team_a": "A", "team_b": "B", "won_a": True},
    ]
    forward = build_from_matches(pd.DataFrame(rows))
    shuffled = build_from_matches(pd.DataFrame(rows[::-1]))
    assert forward.rating("A") == shuffled.rating("A")
    assert forward.rating("B") == shuffled.rating("B")


def test_build_from_matches_empty_input_returns_default_elo():
    elo = build_from_matches(pd.DataFrame(columns=["date", "team_a", "team_b", "won_a"]))
    assert elo.expect("X", "Y") == 0.5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_elo.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_from_matches' from 'bot.elo'`.

- [ ] **Step 3: Implement**

Replace the full contents of `bot/elo.py`:

```python
"""Standard Elo baseline. The trained model must beat this on held-out data to ship."""

from collections import defaultdict

import pandas as pd

K = 20


class Elo:
    def __init__(self) -> None:
        self._r: dict[str, float] = defaultdict(lambda: 1500.0)

    def rating(self, team: str) -> float:
        return self._r[team]

    def expect(self, team_a: str, team_b: str) -> float:
        return 1.0 / (1.0 + 10 ** ((self._r[team_b] - self._r[team_a]) / 400.0))

    def update(self, team_a: str, team_b: str, a_won: bool) -> None:
        ea = self.expect(team_a, team_b)
        score = 1.0 if a_won else 0.0
        self._r[team_a] += K * (score - ea)
        self._r[team_b] += K * ((1.0 - score) - (1.0 - ea))


def build_from_matches(paired: pd.DataFrame) -> Elo:
    """Replays a paired-matches dataframe (bot.backtest.pair_matches's output
    shape: date/team_a/team_b/won_a, among other columns) chronologically
    into a fresh Elo, and returns it with final post-history ratings --
    ready for .expect() on a new, not-yet-played fixture.

    Used at live-serving time (composer/routers/predictions.py's run_model)
    to produce an Elo-baseline probability for leagues on the model's
    league_elo_override list (see bot/gating.py), without re-running the
    LightGBM model at all.
    """
    elo = Elo()
    if paired.empty:
        return elo
    ordered = paired.sort_values(by=["date", "team_a", "team_b"], kind="stable")
    for _, row in ordered.iterrows():
        elo.update(row["team_a"], row["team_b"], a_won=bool(row["won_a"]))
    return elo
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_elo.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full bot test suite**

Run: `bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS (confirms nothing else in `bot/` broke from adding the
`pandas` import to `bot/elo.py`).

- [ ] **Step 6: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/elo.py bot/tests/test_elo.py && bot/.venv/bin/python -m ruff format --check bot/elo.py bot/tests/test_elo.py`

- [ ] **Step 7: Commit**

```bash
git add bot/elo.py bot/tests/test_elo.py
git commit -m "feat(bot): add Elo.build_from_matches for live-serving fallback"
```

---

### Task 4: `predictions.source` column + `run_model` Elo-fallback routing

**Files:**
- Modify: `bot/db.py` (the `predictions` table def, and `ensure_schema`)
- Modify: `composer/routers/predictions.py:595-690` (`run_model`)
- Test: `composer/tests/test_run_model.py` (new)

**Interfaces:**
- Consumes: `bot.elo.build_from_matches` (Task 3), `bot.backtest.pair_matches`
  (existing), `artifact["league_elo_override"]` (Task 2, always present
  after `load_artifact` — but `run_model` reads it via `artifact.get(...)`
  defensively regardless, since `request.app.state.artifact` could in
  principle be set directly in a test without going through
  `load_artifact`).
- Produces: `predictions.source` DB column (`sa.String(16)`, nullable —
  values `"model"` or `"elo_fallback"` written at insert time by
  `run_model`; historical rows before this change are `NULL`). No change
  to `RunModelOut`'s response shape.

- [ ] **Step 1: Write the failing schema test**

Add to `bot/tests/test_db_schema.py`:

```python
from bot.db import predictions


def test_predictions_source_column_exists_and_is_nullable():
    assert "source" in predictions.c
    assert predictions.c.source.nullable is True


def test_insert_prediction_without_source_defaults_null():
    from datetime import datetime, timezone

    eng = _engine()
    metadata.create_all(eng)
    with eng.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            predictions.insert().values(
                prob_team_a=0.6,
                reasons_json="[]",
                created_at=datetime.now(timezone.utc),
                outcome="pending",
            )
        )
        row = conn.execute(sa.select(predictions.c.source)).first()
        assert row.source is None
```

Add `predictions` to the existing `from bot.db import content_bank, ensure_schema, metadata` line
at the top of `bot/tests/test_db_schema.py`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py -v`
Expected: FAIL — `sqlalchemy.exc.NoSuchColumnError` / `KeyError: 'source'`
(the column doesn't exist yet).

- [ ] **Step 3: Implement — add the column**

In `bot/db.py`, in the `predictions = sa.Table(...)` definition, add a
new column after `outcome`'s comment line:

```python
    sa.Column("outcome", sa.String(16), nullable=False, default="pending"),
    # 'pending' | 'correct' | 'incorrect' | 'void'
    sa.Column("source", sa.String(16), nullable=True),
    # 'model' | 'elo_fallback' | NULL (rows predating this column, or
    # freeform predictions created outside run_model)
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
```

In `ensure_schema`'s `pred_cols` patch loop, add `"source"`:

```python
    pred_cols = {c["name"] for c in inspector.get_columns("predictions")}
    for col, col_type in [
        ("team_a", "VARCHAR(64)"),
        ("team_b", "VARCHAR(64)"),
        ("league", "VARCHAR(32)"),
        ("venue", "VARCHAR(128)"),
        ("actual_winner", "VARCHAR(64)"),
        ("result_summary", "VARCHAR(256)"),
        ("evaluated_at", "TIMESTAMP"),
        ("source", "VARCHAR(16)"),
    ]:
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full bot test suite**

Run: `bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS.

- [ ] **Step 6: Write the failing composer-level tests**

Create `composer/tests/test_run_model.py`:

```python
from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.backtest import pair_matches
from bot.db import fixtures, predictions, team_matches
from bot.elo import build_from_matches
from bot.predict import load_artifact
from bot.tests.test_predict import _artifact as _bot_artifact
from bot.tests.test_train import synthetic_team_matches

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)


def _seed_synthetic_history(conn, n=200):
    df = synthetic_team_matches(n)
    conn.execute(team_matches.insert(), df.to_dict(orient="records"))
    return df


def _mk_fixture(conn, fid=1, team_a="T0", team_b="T1", league="SYN"):
    start = datetime.now(timezone.utc) + timedelta(days=1)
    conn.execute(
        fixtures.insert().values(
            id=fid,
            provider_match_id=f"m{fid}",
            team_a=team_a,
            team_b=team_b,
            venue="V0",
            league=league,
            start_time=start,
            status="upcoming",
        )
    )


def test_run_model_without_artifact_returns_503(client, conn):
    _mk_fixture(conn)
    conn.commit()
    res = client.post("/predictions/run-model")
    assert res.status_code == 503


def test_run_model_uses_model_for_non_override_league(client, conn, tmp_path):
    _seed_synthetic_history(conn)
    _mk_fixture(conn)
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    # Deterministic for this test regardless of what the real gate computed
    # on this small synthetic dataset -- gate correctness is covered by
    # bot/tests/test_gating.py and test_train.py separately.
    client.app.state.artifact["league_elo_override"] = []

    res = client.post("/predictions/run-model")
    assert res.status_code == 200
    body = res.json()
    assert body["predictions_created"] == 1
    assert body["errors"] == []

    row = conn.execute(sa.select(predictions)).first()
    assert row.source == "model"


def test_run_model_routes_override_league_to_elo_fallback(client, conn, tmp_path):
    df = _seed_synthetic_history(conn)
    _mk_fixture(conn, team_a="T0", team_b="T1", league="SYN")
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    client.app.state.artifact["league_elo_override"] = ["SYN"]

    res = client.post("/predictions/run-model")
    assert res.status_code == 200
    body = res.json()
    assert body["predictions_created"] == 1
    assert body["errors"] == []

    row = conn.execute(sa.select(predictions)).first()
    assert row.source == "elo_fallback"

    expected_elo = build_from_matches(pair_matches(df)).expect("T0", "T1")
    import numpy as np

    expected_prob = float(np.clip(expected_elo, 0.02, 0.98))
    assert row.prob_team_a == pytest.approx(expected_prob, abs=1e-9)
    assert "elo" in row.reasons_json.lower() or "gate" in row.reasons_json.lower()


def test_run_model_idempotent_skips_existing_prediction(client, conn, tmp_path):
    _seed_synthetic_history(conn)
    _mk_fixture(conn)
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    client.app.state.artifact["league_elo_override"] = []

    first = client.post("/predictions/run-model")
    assert first.json()["predictions_created"] == 1

    second = client.post("/predictions/run-model")
    body = second.json()
    assert body["predictions_created"] == 0
    assert body["predictions_skipped"] == 1
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_run_model.py -v`
Expected: FAIL — `test_run_model_without_artifact_returns_503` should
already pass (existing 503 behavior via `getattr(..., None)` check is
NOT yet wired since `run_model` doesn't consult `app.state.artifact`
yet); the other three should FAIL, most clearly on `row.source` raising
`AttributeError` (column doesn't exist as a queryable attribute yet in
the currently-inserted row, or is unconditionally `None`/absent) and on
`predictions_created` mismatches because `run_model` still tries to load
`bot/artifacts/model.pkl` from disk (likely `503` in this sandboxed test
env where that file may not exist, or picks up the real committed
artifact instead of the test one — either way, not what these tests
assert). Confirm failures before proceeding.

- [ ] **Step 8: Implement — refactor `run_model`**

In `composer/routers/predictions.py`, replace the full `run_model`
function (currently lines 595-690):

```python
@router.post("/predictions/run-model", response_model=RunModelOut)
def run_model(request: Request, conn=Depends(get_conn)) -> RunModelOut:
    """Trigger the LightGBM prediction pipeline for today's fixtures.

    Builds features from team_matches history, runs the model, and stores
    predictions. Idempotent — skips fixtures that already have a
    prediction. Leagues on the loaded artifact's `league_elo_override`
    list (populated by bot.train's per-league gate — see bot/gating.py)
    are served from the Elo baseline instead of the model, since that
    league has been measured to lose to Elo recently.
    """
    import json as _json
    from datetime import datetime, timezone as _tz

    import numpy as np

    errors: list[str] = []

    artifact = getattr(request.app.state, "artifact", None)
    if artifact is None:
        raise HTTPException(
            status_code=503, detail="Prediction model artifact not loaded"
        )

    from bot.backtest import pair_matches
    from bot.elo import build_from_matches
    from bot.features import build_features
    from bot.predict import predict
    from bot.run import _load_team_matches, _home_team_at_venue

    override_leagues = set(artifact.get("league_elo_override", []))

    # Find upcoming fixtures without a prediction yet
    now = datetime.now(_tz.utc)
    upcoming = conn.execute(
        sa.select(fixtures)
        .where(
            fixtures.c.status == "upcoming",
            fixtures.c.start_time > now,
        )
        .order_by(fixtures.c.start_time)
    ).all()

    df = _load_team_matches(conn)
    elo = build_from_matches(pair_matches(df)) if len(df) else None
    created = 0
    skipped = 0

    for f in upcoming:
        existing = conn.execute(
            sa.select(predictions.c.id).where(predictions.c.fixture_id == f.id)
        ).first()
        if existing:
            skipped += 1
            continue

        try:
            if f.league in override_leagues and elo is not None:
                prob = float(np.clip(elo.expect(f.team_a, f.team_b), 0.02, 0.98))
                reasons = [
                    f"{f.league} is currently below the model-quality gate "
                    "— served from the Elo baseline"
                ]
                source = "elo_fallback"
                feats: dict = {}
            else:
                home_team = _home_team_at_venue(df, f.venue, f.team_a, f.team_b)
                feats = build_features(
                    df, f.team_a, f.team_b, f.venue, now.date(), home_team=home_team
                )
                prob, reasons = predict(artifact, feats)
                source = "model"
        except Exception as exc:
            errors.append(f"Feature/predict error for {f.team_a} vs {f.team_b}: {exc}")
            skipped += 1
            continue

        conn.execute(
            predictions.insert().values(
                fixture_id=f.id,
                team_a=f.team_a,
                team_b=f.team_b,
                league=f.league,
                venue=f.venue,
                prob_team_a=prob,
                reasons_json=_json.dumps(reasons),
                features_json=_json.dumps(feats),
                source=source,
                created_at=now,
                outcome="pending",
            )
        )
        created += 1

    conn.commit()
    return RunModelOut(
        status="ok",
        predictions_created=created,
        predictions_skipped=skipped,
        fixtures_found=len(upcoming),
        errors=errors,
    )
```

This removes the old disk-loading block (`from pathlib import Path` +
`artifact_path` construction + `load_artifact` call) entirely, matching
the existing `run_backtest_endpoint`'s `request.app.state.artifact`
pattern a few dozen lines above it in the same file.

- [ ] **Step 9: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_run_model.py -v`
Expected: all 4 PASS.

- [ ] **Step 10: Run the full composer test suite**

Run: `bot/.venv/bin/python -m pytest composer/tests/ -v`
Expected: all PASS — this specifically confirms
`composer/tests/test_generate_bot.py` and any other test touching
`/predictions/run-model` or the `predictions` table still passes with the
new `source` column and the refactored artifact-loading path.

- [ ] **Step 11: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/db.py composer/routers/predictions.py composer/tests/test_run_model.py bot/tests/test_db_schema.py && bot/.venv/bin/python -m ruff format --check bot/db.py composer/routers/predictions.py composer/tests/test_run_model.py bot/tests/test_db_schema.py`

- [ ] **Step 12: Manual smoke check (optional but recommended)**

If you have a local Postgres/SQLite dev DB with real fixtures and a real
artifact available (`bash dev.sh` per `CLAUDE.md`), start the composer
API and hit the endpoint once to confirm it behaves against real data,
not just synthetic test fixtures:

```bash
bot/.venv/bin/python -m uvicorn composer.app:app --reload --port 8000
# in another shell:
curl -X POST http://localhost:8000/predictions/run-model
```

Expected: `200` with a `RunModelOut` body; check `bot/artifacts/metrics.json`'s
`league_elo_override` (currently `[]` on the committed artifact until the
next scheduled retrain picks up this plan's changes) to confirm which
leagues, if any, are expected to route to `source: "elo_fallback"`.

- [ ] **Step 13: Commit**

```bash
git add bot/db.py composer/routers/predictions.py composer/tests/test_run_model.py bot/tests/test_db_schema.py
git commit -m "feat(composer): route run_model predictions through Elo fallback for gate-failing leagues"
```

---

## Self-Review

**Spec coverage** (against spec section "1. Per-league gate + Elo-fallback routing"):
- ✅ Per-league log-loss/Brier check, trailing window wider than global test window (12mo vs the global 2-4mo split) — Task 1/2.
- ✅ Min-n floor (~30) so thin leagues are reported, not gated — Task 1.
- ✅ On failure, route that league's live predictions to Elo instead of blocking the retrain — Task 4 (retrain itself is never blocked; Task 2 only ever adds to `metrics.json`/artifact, never raises).
- ✅ Recorded in `metrics.json` for audit — Task 2.
- ✅ `composer/routers/predictions.py` consults the override list at serving time — Task 4.

**Placeholder scan:** no `TBD`/`TODO`/"add appropriate" phrasing; every
step has real code. `run_model`'s Step 7 note about which specific
exception fires (`503` vs stale-artifact confusion) describes the
*expected pre-fix failure mode*, not a placeholder — the fix itself
(Step 8) is fully specified code.

**Type consistency:** `per_league_gate` returns `list[str]` for
`league_elo_override` in Task 1; Task 2 stores that exact list into both
`metrics.json` and the artifact dict under the same key name; Task 4's
`run_model` reads `artifact.get("league_elo_override", [])` and does
`set(...)` membership checks against `f.league` (a string) — consistent
throughout. `Elo.build_from_matches` (Task 3) returns `Elo`, matching
`Elo.expect(str, str) -> float`'s existing signature used identically in
Task 4.

**Out of scope, confirmed not touched:** `bot/train.py`'s
`tr`/`va`/`te` split logic and `IsotonicRegression` (Phase 2); `league`
as a LightGBM input feature / Elo-as-feature in `bot/features.py`
(Phase 3); `match_id`, ingestion upsert, artifact version directories
(Phase 4); squad turnover / `match_players` (Phase 5, deferred).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-prediction-model-per-league-gate.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
