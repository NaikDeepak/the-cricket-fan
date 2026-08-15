from unittest.mock import patch

from bot.db import ensure_schema


def test_generate_recap_creates_draft(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)

    with patch(
        "composer.routers.generate.get_match_recap_tweet",
        return_value="CSK vs MI: Dhoni finishes it! #TheCricketFan",
    ) as mock_fetch:
        res = client.post("/generate/recap", json={"team_a": "CSK", "team_b": "MI"})

    assert res.status_code == 201
    draft = res.json()
    assert draft["category"] == "recap"
    assert draft["source"] == "bot"
    assert "Dhoni" in draft["text"]
    mock_fetch.assert_called_once_with("CSK", "MI")


def test_generate_recap_survives_rss_outage(client, engine):
    # news_fetcher catches network errors internally and returns a fallback
    # tweet; the endpoint must return 201 even with requests.get exploding.
    with engine.begin() as conn:
        ensure_schema(conn)

    with patch("requests.get", side_effect=OSError("network down")):
        res = client.post("/generate/recap", json={"team_a": "RCB", "team_b": "KKR"})

    assert res.status_code == 201
    assert "RCB" in res.json()["text"]
