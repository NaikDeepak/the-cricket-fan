from bot.match_input import normalize_team_name, parse_match_text


def test_normalize_team_name():
    assert normalize_team_name("CSK") == "Chennai Super Kings"
    assert normalize_team_name("abf") == "Antigua & Barbuda Falcons"
    assert normalize_team_name("India") == "India"


def test_parse_pre_match_text():
    raw = """
    Chennai Super Kings vs Mumbai Indians, 1st Match
    Venue: Wankhede Stadium, Mumbai
    Tournament: Indian Premier League 2026
    Toss: Mumbai Indians won the toss and opted to field
    """
    inp = parse_match_text(raw)
    assert inp.team_a == "Chennai Super Kings"
    assert inp.team_b == "Mumbai Indians"
    assert inp.venue == "Wankhede Stadium, Mumbai"
    assert inp.league == "IPL"
    assert inp.toss_winner == "Mumbai Indians"
    assert inp.toss_decision == "field"
    assert inp.phase == "pre_match"


def test_parse_innings_break_text():
    raw = """
    Antigua & Barbuda Falcons vs St Kitts and Nevis Patriots, 1st Match
    Sir Vivian Richards Stadium, North Sound, Antigua
    Caribbean Premier League 2026

    Antigua & Barbuda Falcons 163/4 (20.0 ov)
    Innings Break: St Kitts need 164 runs to win
    """
    inp = parse_match_text(raw)
    assert inp.team_a == "Antigua & Barbuda Falcons"
    assert inp.team_b == "St Kitts and Nevis Patriots"
    assert inp.league == "CPL"
    assert inp.innings1_runs == 163
    assert inp.innings1_wickets == 4
    assert inp.innings1_overs == 20.0
    assert inp.phase == "innings_break"


def test_parse_chase_in_progress():
    raw = """
    CSK vs MI, Match 12
    Venue: MA Chidambaram Stadium, Chepauk, Chennai
    CSK 178/6 (20.0 ov)
    MI 95/3 (11.2 ov)
    Current Run Rate: 8.38, Required Run Rate: 9.69
    """
    inp = parse_match_text(raw)
    assert inp.team_a == "Chennai Super Kings"
    assert inp.team_b == "Mumbai Indians"
    assert inp.innings1_runs == 178
    assert inp.innings1_wickets == 6
    assert inp.innings2_runs == 95
    assert inp.innings2_wickets == 3
    assert inp.innings2_overs == 11.2
    assert inp.phase == "chase_in_progress"
