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
