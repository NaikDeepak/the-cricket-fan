"""Leakage-guarded pre-match feature builder, shared by training and inference.

All aggregates read rows with date STRICTLY BEFORE the target match date.
Weights: RECENCY_DECAY^k over match recency, times SEASON_DECAY^(seasons back)
to downweight prior-season form (squad churn).
"""

from datetime import date

import numpy as np
import pandas as pd

RECENCY_DECAY = 0.9
SEASON_DECAY = 0.5
GLOBAL_RR_PRIOR = 7.8  # long-run T20 run rate, used when no history
NEUTRAL = 0.5

FEATURE_NAMES = [
    "form5_a",
    "form5_b",
    "form10_a",
    "form10_b",
    "h2h_a_rate",
    "venue_a_rate",
    "venue_b_rate",
    "venue_avg_1st_innings",
    "venue_chase_win_rate",
    "bat_rr_a",
    "bat_rr_b",
    "bowl_econ_a",
    "bowl_econ_b",
    "home_a",
    "home_b",
]


def _season_rank(season: str) -> int:
    digits = "".join(c for c in str(season) if c.isdigit())[:4]
    return int(digits) if len(digits) == 4 else 0


def _weights(sub: pd.DataFrame, target_season: int) -> np.ndarray:
    n = len(sub)
    recency = RECENCY_DECAY ** np.arange(n - 1, -1, -1)  # newest row -> weight 1
    seasons_back = np.clip(target_season - sub["season"].map(_season_rank), 0, 20)
    return recency * (SEASON_DECAY ** seasons_back.to_numpy())


def _weighted_rate(sub: pd.DataFrame, target_season: int, last: int | None) -> float:
    if sub.empty:
        return NEUTRAL
    sub = sub.sort_values("date")
    if last is not None:
        sub = sub.tail(last)
    w = _weights(sub, target_season)
    if w.sum() == 0:
        return NEUTRAL
    return float(np.average(sub["won"].astype(float), weights=w))


def _run_rate(sub: pd.DataFrame, runs_col: str, overs_col: str) -> float:
    sub = sub[~sub["dls"]].dropna(subset=[runs_col, overs_col])
    sub = sub[sub[overs_col] > 0].sort_values("date").tail(10)
    if sub.empty:
        return GLOBAL_RR_PRIOR
    return float(sub[runs_col].sum() / sub[overs_col].sum())


def _venue_avg_first_innings(past: pd.DataFrame, venue: str) -> float:
    sub = past[(past["venue"] == venue) & past["batted_first"] & ~past["dls"]]
    sub = sub.dropna(subset=["runs_scored"])
    if sub.empty:
        return GLOBAL_RR_PRIOR * 20
    return float(sub["runs_scored"].mean())


def build_features(
    df: pd.DataFrame,
    team_a: str,
    team_b: str,
    venue: str,
    match_date: date,
    home_team: str | None = None,
) -> dict[str, float]:
    past = df[pd.to_datetime(df["date"]).dt.date < match_date] if len(df) else df
    season = match_date.year
    a = past[past["team"] == team_a] if len(past) else past
    b = past[past["team"] == team_b] if len(past) else past
    h2h = a[a["opponent"] == team_b] if len(a) else a
    return {
        "form5_a": _weighted_rate(a, season, 5),
        "form5_b": _weighted_rate(b, season, 5),
        "form10_a": _weighted_rate(a, season, 10),
        "form10_b": _weighted_rate(b, season, 10),
        "h2h_a_rate": _weighted_rate(h2h, season, None),
        "venue_a_rate": _weighted_rate(
            a[a["venue"] == venue] if len(a) else a, season, None
        ),
        "venue_b_rate": _weighted_rate(
            b[b["venue"] == venue] if len(b) else b, season, None
        ),
        "venue_avg_1st_innings": _venue_avg_first_innings(past, venue),
        "venue_chase_win_rate": _weighted_rate(
            past[(past["venue"] == venue) & ~past["batted_first"]]
            if len(past)
            else past,
            season,
            None,
        ),
        "bat_rr_a": _run_rate(a, "runs_scored", "overs_faced")
        if len(a)
        else GLOBAL_RR_PRIOR,
        "bat_rr_b": _run_rate(b, "runs_scored", "overs_faced")
        if len(b)
        else GLOBAL_RR_PRIOR,
        "bowl_econ_a": _run_rate(a, "runs_conceded", "overs_bowled")
        if len(a)
        else GLOBAL_RR_PRIOR,
        "bowl_econ_b": _run_rate(b, "runs_conceded", "overs_bowled")
        if len(b)
        else GLOBAL_RR_PRIOR,
        "home_a": 1.0 if home_team == team_a else 0.0,
        "home_b": 1.0 if home_team == team_b else 0.0,
    }
