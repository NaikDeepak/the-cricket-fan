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
            team_a="Chennai Super Kings",
            team_b="Mumbai Indians",
            league="IPL",
            venue="Wankhede Stadium",
            prob_team_a=0.62,
            reasons_json='["Strong recent form", "Home advantage"]',
            features_json="{}",
            created_at=datetime(2026, 7, 24, tzinfo=timezone.utc),
            outcome=outcome,
        )
    )


def test_today_route_not_shadowed_by_pred_id(client):
    # /predictions/today is a literal path registered after /predictions/{pred_id};
    # if it moves back below that route, FastAPI matches {pred_id} first and this
    # 422s trying to int-parse "today" instead of returning the today list.
    r = client.get("/predictions/today")
    assert r.status_code == 200
    assert r.json() == []


def test_today_route_returns_todays_fixture_with_null_prediction(client, conn):
    conn.execute(
        fixtures.insert().values(
            id=1,
            provider_match_id="m1",
            team_a="Chennai Super Kings",
            team_b="Mumbai Indians",
            venue="Wankhede Stadium",
            league="IPL",
            start_time=datetime.now(timezone.utc),
            status="upcoming",
        )
    )
    conn.commit()
    rows = client.get("/predictions/today").json()
    assert len(rows) == 1
    assert rows[0]["team_a"] == "Chennai Super Kings"
    assert rows[0]["prediction"] is None


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
    assert r["predicted_winner"] == "Chennai Super Kings"


def test_filters_by_outcome(client, conn):
    _mk_fixture(conn, fid=1)
    _mk_fixture(conn, fid=2, team_a="Kolkata Knight Riders", team_b="Delhi Capitals")
    _mk_prediction(conn, fid=1, outcome="correct")
    _mk_prediction(conn, fid=2, outcome="pending")
    conn.commit()
    rows = client.get("/predictions", params={"outcome": "correct"}).json()
    assert len(rows) == 1
    assert rows[0]["fixture_id"] == 1


def test_create_and_settle_prediction(client, conn):
    # 1. Create prediction
    payload = {
        "team_a": "Lyca Kovai Kings",
        "team_b": "Chepauk Super Gillies",
        "league": "TNPL",
        "venue": "NPR College Ground",
        "prob_team_a": 0.58,
        "reasons": ["Dominant death bowling", "Spin control"],
    }
    res = client.post("/predictions", json=payload)
    assert res.status_code == 201
    created = res.json()
    assert created["predicted_winner"] == "Lyca Kovai Kings"
    assert created["outcome"] == "pending"
    pid = created["id"]

    # 2. Settle match result (winner is Kovai Kings -> correct)
    settle_res = client.post(
        f"/predictions/{pid}/result",
        json={
            "actual_winner": "Lyca Kovai Kings",
            "result_summary": "Won by 4 wickets",
        },
    )
    assert settle_res.status_code == 200
    settled = settle_res.json()
    assert settled["outcome"] == "correct"
    assert settled["actual_winner"] == "Lyca Kovai Kings"
    assert settled["evaluated_at"] is not None

    # 3. Check accuracy stats
    stats_res = client.get("/predictions/accuracy")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total"] >= 1
    assert stats["correct"] >= 1
    assert stats["accuracy_pct"] == 100
    assert stats["streak"] >= 1
    assert stats["streak_type"] == "win"


def test_settle_from_text(client, conn):
    # Create pending prediction
    res = client.post(
        "/predictions",
        json={
            "team_a": "Dindigul Dragons",
            "team_b": "Salem Spartans",
            "league": "TNPL",
            "venue": "Salem Cricket Foundation Stadium",
            "prob_team_a": 0.70,
            "reasons": ["Captain Ravichandran Ashwin in top all-round touch"],
        },
    )
    created = res.json()
    assert created["outcome"] == "pending"

    # Settle using match scorecard text
    text_res = client.post(
        "/predictions/settle-from-text",
        json={"raw_text": "DD 182/4 (19.1) beat SLS 180/7 (20.0) by 6 wickets"},
    )
    assert text_res.status_code == 200
    settled = text_res.json()
    assert settled["id"] == created["id"]
    assert settled["outcome"] == "correct"


def test_delete_prediction(client, conn):
    res = client.post(
        "/predictions",
        json={
            "team_a": "Puneri Bappa",
            "team_b": "Kolhapur Tuskers",
            "league": "MPL",
            "prob_team_a": 0.52,
        },
    )
    pid = res.json()["id"]
    del_res = client.delete(f"/predictions/{pid}")
    assert del_res.status_code == 204

    get_res = client.get(f"/predictions/{pid}")
    assert get_res.status_code == 404


def test_offset_pages_through_results(client, conn):
    for i in range(1, 4):
        _mk_fixture(conn, fid=i, team_a=f"Team {i}", team_b="Opponent")
        conn.execute(
            predictions.insert().values(
                fixture_id=i,
                team_a=f"Team {i}",
                team_b="Opponent",
                league="IPL",
                venue="Wankhede Stadium",
                prob_team_a=0.6,
                reasons_json="[]",
                features_json="{}",
                created_at=datetime(2026, 7, 20 + i, tzinfo=timezone.utc),
                outcome="pending",
            )
        )
    conn.commit()
    # created_at desc: Team 3 (7/23), Team 2 (7/22), Team 1 (7/21)
    page1 = client.get("/predictions", params={"limit": 2, "offset": 0}).json()
    assert [r["team_a"] for r in page1] == ["Team 3", "Team 2"]

    page2 = client.get("/predictions", params={"limit": 2, "offset": 2}).json()
    assert [r["team_a"] for r in page2] == ["Team 1"]

    page3 = client.get("/predictions", params={"limit": 2, "offset": 10}).json()
    assert page3 == []


def test_outcome_accepts_comma_separated_list(client, conn):
    _mk_fixture(conn, fid=1)
    _mk_fixture(conn, fid=2, team_a="Kolkata Knight Riders", team_b="Delhi Capitals")
    _mk_fixture(conn, fid=3, team_a="Royal Challengers Bengaluru", team_b="Punjab Kings")
    _mk_prediction(conn, fid=1, outcome="correct")
    _mk_prediction(conn, fid=2, outcome="incorrect")
    _mk_prediction(conn, fid=3, outcome="pending")
    conn.commit()

    rows = client.get(
        "/predictions", params={"outcome": "correct,incorrect,void"}
    ).json()
    assert {r["fixture_id"] for r in rows} == {1, 2}

    # Single value still behaves exactly as before this change.
    rows = client.get("/predictions", params={"outcome": "correct"}).json()
    assert [r["fixture_id"] for r in rows] == [1]

