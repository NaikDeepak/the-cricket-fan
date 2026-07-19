import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from bot.train import build_dataset, build_team_matches, train_and_evaluate

TEAMS = ["T0", "T1", "T2", "T3", "T4", "T5"]


def synthetic_team_matches(n_matches=600, seed=7) -> pd.DataFrame:
    """Skill-ordered synthetic league: lower-index teams win more often."""
    rng = np.random.default_rng(seed)
    rows = []
    start = date(2021, 3, 1)
    for i in range(n_matches):
        a, b = rng.choice(len(TEAMS), size=2, replace=False)
        d = start + timedelta(days=i * 2)
        p_a = 1 / (1 + np.exp(-(b - a) * 0.55))
        a_won = rng.random() < p_a
        for team_i, opp_i, won in [(a, b, a_won), (b, a, not a_won)]:
            rows.append(dict(
                team=TEAMS[team_i], opponent=TEAMS[opp_i], date=d,
                season=str(d.year), league="SYN", venue=f"V{team_i % 3}",
                won=bool(won), dls=False,
                runs_scored=150.0 + (5 - team_i) * 6 + rng.normal(0, 8),
                overs_faced=20.0, runs_conceded=150.0 + (5 - opp_i) * 6,
                overs_bowled=20.0, home=False))
    return pd.DataFrame(rows)


def test_build_team_matches_reads_dir():
    data_dir = Path(__file__).parent / "data"
    df = build_team_matches(data_dir, league_map={"match_normal": "IPL"})
    # only files present in league_map are ingested
    assert set(df["league"]) == {"IPL"}
    assert len(df) == 2


def test_build_dataset_shapes_and_no_leakage_column():
    df = synthetic_team_matches(200)
    X, y, meta = build_dataset(df)
    assert len(X) == len(y) == len(meta) == 200  # one sample per match
    assert "won" not in X.columns


def test_train_writes_artifact_and_metrics(tmp_path):
    df = synthetic_team_matches(600)
    X, y, meta = build_dataset(df)
    metrics = train_and_evaluate(X, y, meta, out_dir=tmp_path)
    assert (tmp_path / "model.pkl").exists()
    saved = json.loads((tmp_path / "metrics.json").read_text())
    for key in ["model", "elo", "always_home_accuracy", "gate_passed",
                "n_train", "n_test", "test_period"]:
        assert key in saved
    assert 0.0 < metrics["model"]["log_loss"] < 1.5
    # synthetic league is learnable: model should beat coin flip clearly
    assert metrics["model"]["accuracy"] > 0.55
