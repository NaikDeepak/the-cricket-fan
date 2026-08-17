from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.backtest import pair_matches
from bot.db import fixtures, predictions, team_matches
from bot.elo import build_from_matches
from bot.predict import load_artifact
from bot.tests.test_predict import _artifact as _bot_artifact
from bot.tests.test_train import synthetic_team_matches

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)


def _seed_synthetic_history(conn, n=200):
    df = synthetic_team_matches(n)
    conn.execute(team_matches.insert(), df.to_dict(orient="records"))
    return df


def _mk_fixture(conn, fid=1, team_a="T0", team_b="T1", league="SYN"):
    start = datetime.now(timezone.utc) + timedelta(days=1)
    conn.execute(
        fixtures.insert().values(
            id=fid,
            provider_match_id=f"m{fid}",
            team_a=team_a,
            team_b=team_b,
            venue="V0",
            league=league,
            start_time=start,
            status="upcoming",
        )
    )


def test_run_model_without_artifact_returns_503(client, conn):
    _mk_fixture(conn)
    conn.commit()
    res = client.post("/predictions/run-model")
    assert res.status_code == 503


def test_run_model_uses_model_for_non_override_league(client, conn, tmp_path):
    _seed_synthetic_history(conn)
    _mk_fixture(conn)
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    # Deterministic for this test regardless of what the real gate computed
    # on this small synthetic dataset -- gate correctness is covered by
    # bot/tests/test_gating.py and test_train.py separately.
    client.app.state.artifact["league_elo_override"] = []

    res = client.post("/predictions/run-model")
    assert res.status_code == 200
    body = res.json()
    assert body["predictions_created"] == 1
    assert body["errors"] == []

    row = conn.execute(sa.select(predictions)).first()
    assert row.source == "model"


def test_run_model_routes_override_league_to_elo_fallback(client, conn, tmp_path):
    df = _seed_synthetic_history(conn)
    _mk_fixture(conn, team_a="T0", team_b="T1", league="SYN")
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    client.app.state.artifact["league_elo_override"] = ["SYN"]

    res = client.post("/predictions/run-model")
    assert res.status_code == 200
    body = res.json()
    assert body["predictions_created"] == 1
    assert body["errors"] == []

    row = conn.execute(sa.select(predictions)).first()
    assert row.source == "elo_fallback"

    expected_elo = build_from_matches(pair_matches(df)).expect("T0", "T1")
    import numpy as np

    expected_prob = float(np.clip(expected_elo, 0.02, 0.98))
    assert row.prob_team_a == pytest.approx(expected_prob, abs=1e-9)
    assert "elo" in row.reasons_json.lower() or "gate" in row.reasons_json.lower()


def test_run_model_idempotent_skips_existing_prediction(client, conn, tmp_path):
    _seed_synthetic_history(conn)
    _mk_fixture(conn)
    conn.commit()

    client.app.state.artifact = load_artifact(_bot_artifact(tmp_path))
    client.app.state.artifact["league_elo_override"] = []

    first = client.post("/predictions/run-model")
    assert first.json()["predictions_created"] == 1

    second = client.post("/predictions/run-model")
    body = second.json()
    assert body["predictions_created"] == 0
    assert body["predictions_skipped"] == 1
