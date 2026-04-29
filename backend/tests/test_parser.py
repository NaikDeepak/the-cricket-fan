# backend/tests/test_parser.py
import json
import tempfile
from pathlib import Path
from app.data.cricsheet_parser import parse_match, phase
from app.data.aggregator import build_pvp


def test_phase_classification():
    assert phase(0) == "powerplay"
    assert phase(5) == "powerplay"
    assert phase(6) == "middle"
    assert phase(15) == "middle"
    assert phase(16) == "death"
    assert phase(19) == "death"


def test_parse_match_yields_deliveries():
    match_data = {
        "info": {
            "venue": "Wankhede Stadium",
            "teams": ["Mumbai Indians", "Chennai Super Kings"],
        },
        "innings": [
            {
                "team": "Mumbai Indians",
                "overs": [
                    {
                        "over": 0,
                        "deliveries": [
                            {
                                "batter": "Rohit Sharma",
                                "bowler": "Ravindra Jadeja",
                                "runs": {"batter": 4},
                            },
                            {
                                "batter": "Rohit Sharma",
                                "bowler": "Ravindra Jadeja",
                                "runs": {"batter": 0},
                                "wickets": [{"kind": "caught"}],
                            },
                        ],
                    }
                ],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(match_data, f)
        tmp_path = Path(f.name)

    deliveries = list(parse_match(tmp_path))
    tmp_path.unlink()

    assert len(deliveries) == 2
    assert deliveries[0].batsman == "Rohit Sharma"
    assert deliveries[0].bowler == "Ravindra Jadeja"
    assert deliveries[0].runs_batter == 4
    assert deliveries[0].is_wicket is False
    assert deliveries[0].fielding_phase == "powerplay"
    assert deliveries[1].is_wicket is True


def test_build_pvp_aggregates_correctly():
    match_data = {
        "info": {"venue": "Wankhede Stadium", "teams": ["MI", "CSK"]},
        "innings": [
            {
                "team": "MI",
                "overs": [
                    {
                        "over": 0,
                        "deliveries": [
                            {"batter": "Batsman A", "bowler": "Bowler X", "runs": {"batter": 6}},
                            {"batter": "Batsman A", "bowler": "Bowler X", "runs": {"batter": 0}},
                        ],
                    }
                ],
            }
        ],
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(match_data, f)
        tmp_path = Path(f.name)

    result = build_pvp(tmp_path.parent)
    tmp_path.unlink()

    key = ("Batsman A", "Bowler X")
    assert key in result
    assert result[key]["balls"] == 2
    assert result[key]["runs"] == 6
    assert result[key]["dots"] == 1
    assert result[key]["dismissals"] == 0
