from datetime import date

import pandas as pd
import pytest

from bot.features import FEATURE_NAMES, build_features


def _row(team, opp, d, won, season="2025", venue="V", dls=False,
         rs=160.0, of=20.0, rc=150.0, ob=20.0, home=False):
    return dict(team=team, opponent=opp, date=d, season=season, league="IPL",
                venue=venue, won=won, dls=dls, runs_scored=rs, overs_faced=of,
                runs_conceded=rc, overs_bowled=ob, home=home)


@pytest.fixture()
def df():
    rows = []
    # Team A: 4 wins then 1 loss in 2025; strong batting
    for i, won in enumerate([True, True, True, True, False]):
        rows.append(_row("A", "X", date(2025, 4, 1 + i), won, rs=180.0))
    # Team B: 1 win, 4 losses in 2025; weak batting
    for i, won in enumerate([True, False, False, False, False]):
        rows.append(_row("B", "Y", date(2025, 4, 1 + i), won, rs=140.0))
    # Head-to-head: A beat B twice in 2025
    rows.append(_row("A", "B", date(2025, 4, 10), True, rs=180.0))
    rows.append(_row("B", "A", date(2025, 4, 10), False))
    rows.append(_row("A", "B", date(2025, 4, 12), True, rs=180.0))
    rows.append(_row("B", "A", date(2025, 4, 12), False))
    # Venue history at "V": A won 2 of 2 there
    rows.append(_row("A", "Z", date(2025, 4, 15), True, venue="V", rs=180.0))
    rows.append(_row("A", "Z", date(2025, 4, 16), True, venue="V", rs=180.0))
    # DLS match with absurd run rate must NOT poison rr feature
    rows.append(_row("A", "Z", date(2025, 4, 17), True, dls=True, rs=60.0, of=5.0))
    # Future match (after prediction date) must be invisible
    rows.append(_row("B", "Z", date(2025, 6, 1), True))
    return pd.DataFrame(rows)


def test_leakage_guard_only_past_rows(df):
    f_may = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # B's 2025-06-01 win excluded: form counts only the 1W/4L + 2 h2h losses
    f_july = build_features(df, "A", "B", "V", date(2025, 7, 1))
    assert f_may["form10_b"] < f_july["form10_b"]  # june win visible only in july


def test_row_on_match_date_excluded(df):
    f = build_features(df, "A", "B", "V", date(2025, 4, 10))
    f_after = build_features(df, "A", "B", "V", date(2025, 4, 11))
    assert f["h2h_a_rate"] == 0.5  # no meetings yet -> neutral prior
    assert f_after["h2h_a_rate"] > 0.5


def test_form_favors_team_a(df):
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["form5_a"] > f["form5_b"]
    assert set(f.keys()) == set(FEATURE_NAMES)


def test_dls_excluded_from_run_rate(df):
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # A's non-DLS innings are all 180 in 20 overs = 9.0 rr; DLS 60/5=12 excluded
    assert f["bat_rr_a"] == pytest.approx(9.0)


def test_season_decay_downweights_last_season():
    old = [_row("A", "X", date(2024, 5, 1), True, season="2024") for _ in range(10)]
    new = [_row("A", "X", date(2025, 4, 1), False, season="2025")]
    df = pd.DataFrame(old + new)
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # without season decay this would be ~0.80; with it the recent loss dominates
    assert f["form5_a"] < 0.65


def test_no_history_neutral_defaults():
    df = pd.DataFrame(columns=["team", "opponent", "date", "season", "league",
                               "venue", "won", "dls", "runs_scored", "overs_faced",
                               "runs_conceded", "overs_bowled", "home"])
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["form5_a"] == 0.5 and f["h2h_a_rate"] == 0.5
    assert f["bat_rr_a"] == pytest.approx(7.8)  # global T20 prior
