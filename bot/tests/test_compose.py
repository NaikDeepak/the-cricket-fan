from datetime import date

import pandas as pd

from bot.compose import FEATURE_PHRASES, prediction_post, result_post, trivia_post
from bot.features import FEATURE_NAMES

BANNED = ["bet", "odds", "stake", "wager", "gamble"]


def _tm(team, opp, won, venue="Wankhede Stadium, Mumbai", d=date(2025, 4, 1)):
    return dict(
        team=team,
        opponent=opp,
        date=d,
        season="2025",
        league="IPL",
        venue=venue,
        won=won,
        dls=False,
        runs_scored=160.0,
        overs_faced=20.0,
        runs_conceded=150.0,
        overs_bowled=20.0,
        home=False,
    )


def test_every_feature_has_phrase():
    assert set(FEATURE_PHRASES) == set(FEATURE_NAMES)


def test_prediction_post_length_and_content():
    text = prediction_post(
        "Chennai Super Kings",
        "Mumbai Indians",
        0.64,
        ["form5_a", "bat_rr_a", "h2h_a_rate"],
        "IPL",
    )
    assert len(text) <= 280
    assert "64%" in text and "Chennai Super Kings" in text
    assert all(b not in text.lower() for b in BANNED)


def test_prediction_post_unknown_feature_falls_back():
    text = prediction_post("A", "B", 0.55, ["mystery_feature"], "IPL")
    assert len(text) <= 280  # falls back to generic phrase, no KeyError


def test_trivia_h2h_when_enough_meetings():
    rows = [
        _tm("A", "B", True),
        _tm("A", "B", True),
        _tm("A", "B", False),
        _tm("B", "A", False),
        _tm("B", "A", False),
        _tm("B", "A", True),
    ]
    text = trivia_post(pd.DataFrame(rows), "A", "B", "Somewhere")
    assert "2" in text and len(text) <= 280  # A leads 2-1


def test_trivia_falls_back_to_venue_then_generic():
    venue_rows = [_tm("C", "D", True) for _ in range(6)]
    text = trivia_post(pd.DataFrame(venue_rows), "A", "B", "Wankhede Stadium, Mumbai")
    assert len(text) <= 280
    empty = trivia_post(
        pd.DataFrame([], columns=list(_tm("x", "y", True))), "A", "B", "Nowhere"
    )
    assert len(empty) <= 280 and "A" in empty


def test_result_post_correct_and_wrong():
    right = result_post("A", "B", 0.64, "A", season_correct=23, season_total=31)
    wrong = result_post("A", "B", 0.64, "B", season_correct=23, season_total=31)
    assert "23/31" in right and len(right) <= 280
    assert "23/31" in wrong and len(wrong) <= 280
    assert right != wrong
