from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from bot.backtest import get_backtest_options, pair_matches, run_backtest
from bot.predict import load_artifact
from bot.tests.test_train import synthetic_team_matches
from bot.train import build_dataset, train_and_evaluate

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)


def _artifact(tmp_path: Path) -> dict:
    df = synthetic_team_matches(600)
    X, y, meta = build_dataset(df)
    train_and_evaluate(X, y, meta, out_dir=tmp_path)
    return load_artifact(tmp_path / "model.pkl")


def test_pair_matches_dedup_and_home():
    df = pd.DataFrame(
        [
            {
                "team": "Mumbai Indians",
                "opponent": "Chennai Super Kings",
                "date": date(2024, 4, 14),
                "season": "2024",
                "league": "IPL",
                "venue": "Wankhede Stadium",
                "won": False,
                "home": True,
                "dls": False,
                "runs_scored": 186.0,
                "overs_faced": 20.0,
                "runs_conceded": 206.0,
                "overs_bowled": 20.0,
                "batted_first": False,
                "pp_runs_scored": 50.0,
                "pp_overs_faced": 6.0,
                "death_runs_conceded": 55.0,
                "death_overs_bowled": 5.0,
            },
            {
                "team": "Chennai Super Kings",
                "opponent": "Mumbai Indians",
                "date": date(2024, 4, 14),
                "season": "2024",
                "league": "IPL",
                "venue": "Wankhede Stadium",
                "won": True,
                "home": False,
                "dls": False,
                "runs_scored": 206.0,
                "overs_faced": 20.0,
                "runs_conceded": 186.0,
                "overs_bowled": 20.0,
                "batted_first": True,
                "pp_runs_scored": 48.0,
                "pp_overs_faced": 6.0,
                "death_runs_conceded": 45.0,
                "death_overs_bowled": 5.0,
            },
        ]
    )
    paired = pair_matches(df)
    assert len(paired) == 1
    row = paired.iloc[0]
    # Alphabetical team_a = Chennai Super Kings, team_b = Mumbai Indians
    assert row["team_a"] == "Chennai Super Kings"
    assert row["team_b"] == "Mumbai Indians"
    assert bool(row["won_a"]) is True  # CSK won
    assert row["home_team"] == "Mumbai Indians"
    assert row["league"] == "IPL"
    assert row["season"] == "2024"
    assert row["date"] == "2024-04-14"


def test_get_backtest_options():
    df = synthetic_team_matches(100)
    opts = get_backtest_options(df)
    assert "SYN" in opts["leagues"]
    assert "SYN" in opts["seasons_by_league"]
    assert opts["total_matches"] == 100
    assert opts["earliest_date"] is not None
    assert opts["latest_date"] is not None
    assert opts["last_match"] is not None
    assert opts["last_match"]["league"] == "SYN"
    assert opts["matches_by_league"]["SYN"] == 100


def test_get_backtest_options_empty():
    opts = get_backtest_options(pd.DataFrame())
    assert opts["leagues"] == []
    assert opts["seasons_by_league"] == {}
    assert opts["total_matches"] == 0
    assert opts["earliest_date"] is None
    assert opts["latest_date"] is None
    assert opts["last_match"] is None
    assert opts["matches_by_league"] == {}


def test_run_backtest_happy_path(tmp_path: Path):
    df = synthetic_team_matches(600)
    art = _artifact(tmp_path)

    # Pick the last season available in df
    seasons = sorted(df["season"].unique())
    target_season = seasons[-1]

    result = run_backtest(df, art, league="SYN", season=target_season)
    assert result["league"] == "SYN"
    assert result["season"] == str(target_season)
    assert result["total"] > 0
    assert 0 <= result["correct"] <= result["total"]
    assert 0 <= result["accuracy_pct"] <= 100
    assert 0 <= result["elo_accuracy_pct"] <= 100
    assert 0 <= result["home_accuracy_pct"] <= 100
    assert len(result["games"]) == result["total"]

    first_game = result["games"][0]
    assert "date" in first_game
    assert "team_a" in first_game
    assert "team_b" in first_game
    assert "venue" in first_game
    assert 0.0 <= first_game["prob_team_a"] <= 1.0
    assert first_game["predicted_winner"] in (
        first_game["team_a"],
        first_game["team_b"],
    )
    assert first_game["actual_winner"] in (first_game["team_a"], first_game["team_b"])
    assert isinstance(first_game["correct"], bool)


def test_run_backtest_nonexistent_league_or_season(tmp_path: Path):
    df = synthetic_team_matches(600)
    art = _artifact(tmp_path)

    result = run_backtest(df, art, league="NON_EXISTENT", season="1999")
    assert result["total"] == 0
    assert result["correct"] == 0
    assert result["accuracy_pct"] == 0
    assert result["games"] == []
