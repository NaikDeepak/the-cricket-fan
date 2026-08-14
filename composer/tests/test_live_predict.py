def test_parse_endpoint_raw_text(client):
    raw = """
    CSK vs MI, 1st Match
    Venue: Wankhede Stadium, Mumbai
    CSK 175/4 (20.0 ov)
    Innings Break: MI need 176 to win
    """
    res = client.post("/live-predict/parse", json={"raw_text": raw})
    assert res.status_code == 200
    data = res.json()
    assert data["team_a"] == "Chennai Super Kings"
    assert data["team_b"] == "Mumbai Indians"
    assert data["venue"] == "Wankhede Stadium, Mumbai"
    assert data["innings1_runs"] == 175
    assert data["innings1_wickets"] == 4
    assert data["phase"] == "innings_break"


def test_parse_endpoint_validation_error(client):
    res = client.post("/live-predict/parse", json={})
    assert res.status_code == 422


def test_run_live_prediction_pre_match(client):
    body = {
        "team_a": "Chennai Super Kings",
        "team_b": "Mumbai Indians",
        "league": "IPL",
        "venue": "Wankhede Stadium, Mumbai",
        "phase": "pre_match",
        "toss_winner": "Chennai Super Kings",
        "toss_decision": "bat",
    }
    res = client.post("/live-predict/run", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["team_a"] == "Chennai Super Kings"
    assert data["team_b"] == "Mumbai Indians"
    assert 0.0 <= data["prob_team_a"] <= 1.0
    assert "tweet_text" in data
    assert "#TheCricketFan" in data["tweet_text"]
    assert "card_meta" in data
    assert data["card_meta"]["phase"] == "pre_match"


def test_run_live_prediction_innings_break(client):
    body = {
        "team_a": "Antigua & Barbuda Falcons",
        "team_b": "St Kitts and Nevis Patriots",
        "league": "CPL",
        "venue": "Sir Vivian Richards Stadium, North Sound, Antigua",
        "phase": "innings_break",
        "innings1_team": "Antigua & Barbuda Falcons",
        "innings1_runs": 163,
        "innings1_wickets": 4,
        "innings1_overs": 20.0,
    }
    res = client.post("/live-predict/run", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["phase"] == "innings_break"
    assert "INNINGS BREAK" in data["tweet_text"]
    assert "#TheCricketFan" in data["tweet_text"]
    assert data["score_projection"]["target"] == 164
