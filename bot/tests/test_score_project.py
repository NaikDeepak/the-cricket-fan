from bot.score_project import project_first_innings, project_match_score
from bot.match_input import MatchInput


def test_project_first_innings_empty():
    low, high = project_first_innings(None, None, None, venue_avg=170.0)
    assert low == 160
    assert high == 180


def test_project_first_innings_acceleration():
    # 80/1 in 8 overs with 9 wickets in hand
    low, high = project_first_innings(80, 1, 8.0, venue_avg=165.0)
    assert low >= 180
    assert high >= 200


def test_project_match_score_chase():
    inp = MatchInput(
        team_a="CSK",
        team_b="MI",
        innings1_runs=180,
        innings2_runs=100,
        innings2_wickets=2,
        innings2_overs=11.0,
        phase="chase_in_progress",
    )
    res = project_match_score(inp)
    assert res["target"] == 181
    assert res["runs_needed"] == 81
    assert res["balls_left"] == 54
    assert res["required_rate"] == 9.0
