from bot.live_adjust import adjust_probability
from bot.match_input import MatchInput


def test_adjust_probability_pre_match_with_toss():
    inp = MatchInput(
        team_a="CSK",
        team_b="MI",
        venue="Wankhede Stadium, Mumbai",
        phase="pre_match",
        toss_winner="CSK",
        toss_decision="field",
    )
    p_adj, reasons = adjust_probability(0.50, inp)
    assert p_adj > 0.50
    assert len(reasons) > 0
    assert "toss" in reasons[0].lower()


def test_adjust_probability_innings_break():
    # Innings 1: Team A posted high total (200) vs venue avg 165
    inp = MatchInput(
        team_a="CSK",
        team_b="MI",
        innings1_team="CSK",
        innings1_runs=200,
        innings1_wickets=4,
        innings1_overs=20.0,
        phase="innings_break",
    )
    p_adj, reasons = adjust_probability(0.50, inp, venue_avg_1st=165.0)
    assert p_adj > 0.60
    assert "+35" in reasons[0]


def test_adjust_probability_chase_hard():
    # Innings 2: Team B is chasing, needs high RRR (e.g. 14 RPO with only 3 wickets left)
    inp = MatchInput(
        team_a="CSK",
        team_b="MI",
        innings1_team="CSK",
        innings1_runs=190,
        innings1_wickets=5,
        innings1_overs=20.0,
        innings2_team="MI",
        innings2_runs=90,
        innings2_wickets=7,
        innings2_overs=14.0,
        phase="chase_in_progress",
    )
    p_adj, reasons = adjust_probability(0.50, inp, venue_avg_1st=165.0)
    # CSK (Team A) should have overwhelmingly high probability of defending
    assert p_adj > 0.80
