from datetime import datetime, timezone

from bot.db import fixtures, predictions


def _mk_fixture(conn, fid=1, team_a="Chennai Super Kings", team_b="Mumbai Indians"):
    conn.execute(
        fixtures.insert().values(
            id=fid,
            provider_match_id=f"m{fid}",
            team_a=team_a,
            team_b=team_b,
            venue="Wankhede Stadium",
            league="IPL",
            start_time=datetime(2026, 7, 25, tzinfo=timezone.utc),
            status="upcoming",
        )
    )


def _mk_prediction(conn, fid=1, outcome="pending"):
    conn.execute(
        predictions.insert().values(
            fixture_id=fid,
            prob_team_a=0.62,
            reasons_json='["Strong recent form", "Home advantage"]',
            features_json="{}",
            created_at=datetime(2026, 7, 24, tzinfo=timezone.utc),
            outcome=outcome,
        )
    )


def test_lists_prediction_with_fixture_info(client, conn):
    _mk_fixture(conn)
    _mk_prediction(conn)
    conn.commit()
    rows = client.get("/predictions").json()
    assert len(rows) == 1
    r = rows[0]
    assert r["team_a"] == "Chennai Super Kings"
    assert r["team_b"] == "Mumbai Indians"
    assert r["prob_team_a"] == 0.62
    assert r["reasons"] == ["Strong recent form", "Home advantage"]
    assert r["outcome"] == "pending"


def test_filters_by_outcome(client, conn):
    _mk_fixture(conn, fid=1)
    _mk_fixture(conn, fid=2, team_a="Kolkata Knight Riders", team_b="Delhi Capitals")
    _mk_prediction(conn, fid=1, outcome="correct")
    _mk_prediction(conn, fid=2, outcome="pending")
    conn.commit()
    rows = client.get("/predictions", params={"outcome": "correct"}).json()
    assert len(rows) == 1
    assert rows[0]["fixture_id"] == 1


def test_empty_when_no_predictions(client, conn):
    assert client.get("/predictions").json() == []
