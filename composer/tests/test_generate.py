from datetime import datetime, timezone
from unittest.mock import patch

from bot.db import ensure_schema, fixtures, team_matches


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


def test_teams_lists_distinct_sorted_names(client, engine):
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            team_matches.insert(),
            [
                {
                    "team": t,
                    "opponent": o,
                    "date": now.date(),
                    "season": "2026",
                    "league": "IPL",
                    "venue": "V",
                    "won": True,
                    "dls": False,
                }
                for t, o in [("MI", "CSK"), ("CSK", "MI")]
            ],
        )
        conn.execute(
            fixtures.insert().values(
                provider_match_id="test-match-1",
                team_a="RCB",
                team_b="MI",
                venue="V",
                league="IPL",
                start_time=now,
                status="upcoming",
            )
        )

    res = client.get("/teams")
    assert res.status_code == 200
    assert res.json() == ["CSK", "MI", "RCB"]
