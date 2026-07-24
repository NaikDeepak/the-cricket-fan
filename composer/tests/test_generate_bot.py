from datetime import date, datetime, timedelta, timezone

import pytest

from bot.aliases import seed_aliases
from bot.db import fixtures, team_matches
from bot.predict import load_artifact
from bot.tests.test_predict import _artifact

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)


def _seed_matches_and_fixture(conn):
    seed_aliases(conn)
    for i in range(6):
        conn.execute(
            team_matches.insert().values(
                team="Chennai Super Kings",
                opponent="Mumbai Indians",
                date=date(2026, 6, 1 + i),
                season="2026",
                league="IPL",
                venue="Wankhede Stadium, Mumbai",
                won=i % 2 == 0,
                dls=False,
                runs_scored=160.0,
                overs_faced=20.0,
                runs_conceded=155.0,
                overs_bowled=20.0,
                home=False,
            )
        )
        conn.execute(
            team_matches.insert().values(
                team="Mumbai Indians",
                opponent="Chennai Super Kings",
                date=date(2026, 6, 1 + i),
                season="2026",
                league="IPL",
                venue="Wankhede Stadium, Mumbai",
                won=i % 2 == 1,
                dls=False,
                runs_scored=155.0,
                overs_faced=20.0,
                runs_conceded=160.0,
                overs_bowled=20.0,
                home=True,
            )
        )
    fid = conn.execute(
        fixtures.insert().values(
            provider_match_id="m1",
            team_a="Chennai Super Kings",
            team_b="Mumbai Indians",
            venue="Wankhede Stadium, Mumbai",
            league="IPL",
            start_time=NOW + timedelta(hours=5),
            status="upcoming",
        )
    ).inserted_primary_key[0]
    conn.commit()
    return fid


def test_generate_prediction_uses_next_fixture(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 201
    out = r.json()
    assert out["source"] == "bot"
    assert out["card_type"] == "prediction"
    assert set(out["card_meta"]) >= {"team_a", "team_b", "prob_a"}
    assert "%" in out["text"]


def test_generate_prediction_with_explicit_fixture_id(client, conn, tmp_path):
    fid = _seed_matches_and_fixture(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction", "fixture_id": fid})
    assert r.status_code == 201


def test_generate_trivia_returns_text(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    r = client.post("/generate/bot", json={"kind": "trivia"})
    assert r.status_code == 201
    assert r.json()["card_type"] == "trivia"


def test_generate_record_from_candidate_pool(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    r = client.post("/generate/bot", json={"kind": "record"})
    assert r.status_code == 201
    assert r.json()["source"] == "bot"


def test_generate_record_sets_content_key(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    r = client.post("/generate/bot", json={"kind": "record"})
    assert r.status_code == 201
    key = r.json()["content_key"]
    assert key is not None
    assert key.startswith("record:")


def test_generate_record_avoids_recent_repeats_until_pool_exhausted(
    client, conn, tmp_path
):
    _seed_matches_and_fixture(conn)
    seen_keys = set()
    for _ in range(3):
        r = client.post("/generate/bot", json={"kind": "record"})
        assert r.status_code == 201
        seen_keys.add(r.json()["content_key"])
    # 3 distinct record candidates exist in this fixture (win_margin,
    # highest_total, best_chase) -- exhausting them without a repeat proves
    # exclusion works, not luck.
    assert len(seen_keys) == 3

    # pool now fully used -- next pick must fall back to the full pool
    # instead of erroring or returning no candidate.
    r = client.post("/generate/bot", json={"kind": "record"})
    assert r.status_code == 201
    assert r.json()["content_key"] in seen_keys


def test_generate_prediction_no_fixture_returns_409(client, conn, tmp_path):
    from bot.aliases import seed_aliases

    seed_aliases(conn)
    conn.commit()
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 409  # no upcoming fixture to predict


def test_generate_prediction_without_artifact_returns_503(client, conn):
    _seed_matches_and_fixture(conn)
    client.app.state.artifact = None
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 503
