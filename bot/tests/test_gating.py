import numpy as np
import pandas as pd

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
