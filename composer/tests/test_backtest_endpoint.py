from datetime import date

import pytest

from bot.db import team_matches
from bot.predict import load_artifact
from bot.tests.test_predict import _artifact

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)


def _seed_matches(conn):
    for i in range(4):
        conn.execute(
            team_matches.insert().values(
                team="Chennai Super Kings",
                opponent="Mumbai Indians",
                date=date(2024, 4, 1 + i),
                season="2024",
                league="IPL",
                venue="Wankhede Stadium, Mumbai",
                won=i % 2 == 0,
                dls=False,
                runs_scored=160.0,
                overs_faced=20.0,
                runs_conceded=155.0,
                overs_bowled=20.0,
                home=False,
                batted_first=True,
                pp_runs_scored=45.0,
                pp_overs_faced=6.0,
                death_runs_conceded=40.0,
                death_overs_bowled=5.0,
            )
        )
        conn.execute(
            team_matches.insert().values(
                team="Mumbai Indians",
                opponent="Chennai Super Kings",
                date=date(2024, 4, 1 + i),
                season="2024",
                league="IPL",
                venue="Wankhede Stadium, Mumbai",
                won=i % 2 != 0,
                dls=False,
                runs_scored=155.0,
                overs_faced=20.0,
                runs_conceded=160.0,
                overs_bowled=20.0,
                home=True,
                batted_first=False,
                pp_runs_scored=40.0,
                pp_overs_faced=6.0,
                death_runs_conceded=45.0,
                death_overs_bowled=5.0,
            )
        )
    conn.commit()


def test_backtest_options_endpoint_empty(client):
    r = client.get("/predictions/backtest/options")
    assert r.status_code == 200
    data = r.json()
    assert data["leagues"] == []
    assert data["seasons_by_league"] == {}
    assert data["total_matches"] == 0
    assert data["earliest_date"] is None
    assert data["latest_date"] is None
    assert data["last_match"] is None
    assert data["matches_by_league"] == {}


def test_backtest_options_endpoint_populated(client, conn):
    _seed_matches(conn)
    r = client.get("/predictions/backtest/options")
    assert r.status_code == 200
    data = r.json()
    assert data["leagues"] == ["IPL"]
    assert data["seasons_by_league"] == {"IPL": ["2024"]}
    assert data["total_matches"] == 4
    assert data["earliest_date"] == "2024-04-01"
    assert data["latest_date"] == "2024-04-04"
    assert data["last_match"] is not None
    assert data["last_match"]["league"] == "IPL"
    assert data["last_match"]["venue"] == "Wankhede Stadium, Mumbai"
    assert data["matches_by_league"] == {"IPL": 4}


def test_backtest_without_artifact_returns_503(client, conn):
    _seed_matches(conn)
    client.app.state.artifact = None
    r = client.get("/predictions/backtest?league=IPL&season=2024")
    assert r.status_code == 503
    assert "artifact not loaded" in r.json()["detail"]


def test_backtest_happy_path(client, conn, tmp_path):
    _seed_matches(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))

    r = client.get("/predictions/backtest?league=IPL&season=2024")
    assert r.status_code == 200
    data = r.json()
    assert data["league"] == "IPL"
    assert data["season"] == "2024"
    assert data["total"] == 4
    assert 0 <= data["correct"] <= 4
    assert 0 <= data["accuracy_pct"] <= 100
    assert 0 <= data["elo_accuracy_pct"] <= 100
    assert 0 <= data["home_accuracy_pct"] <= 100
    assert len(data["games"]) == 4

    game0 = data["games"][0]
    assert game0["date"] == "2024-04-01"
    assert game0["team_a"] == "Chennai Super Kings"
    assert game0["team_b"] == "Mumbai Indians"
    assert "prob_team_a" in game0
    assert "predicted_winner" in game0
    assert "actual_winner" in game0
    assert isinstance(game0["correct"], bool)


def test_backtest_unknown_league_returns_empty_200(client, conn, tmp_path):
    _seed_matches(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))

    r = client.get("/predictions/backtest?league=UNKNOWN&season=2024")
    assert r.status_code == 200
    data = r.json()
    assert data["league"] == "UNKNOWN"
    assert data["total"] == 0
    assert data["correct"] == 0
    assert data["accuracy_pct"] == 0
    assert data["games"] == []
