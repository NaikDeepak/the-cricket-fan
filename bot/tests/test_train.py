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
            runs_scored = 150.0 + (5 - team_i) * 6 + rng.normal(0, 8)
            runs_conceded = 150.0 + (5 - opp_i) * 6
            rows.append(
                dict(
                    team=TEAMS[team_i],
                    opponent=TEAMS[opp_i],
                    date=d,
                    season=str(d.year),
                    league="SYN",
                    venue=f"V{team_i % 3}",
                    won=bool(won),
                    dls=False,
                    runs_scored=runs_scored,
                    overs_faced=20.0,
                    runs_conceded=runs_conceded,
                    overs_bowled=20.0,
                    home=False,
                    batted_first=rng.choice([True, False]),
                    pp_runs_scored=runs_scored * 0.3,
                    pp_overs_faced=6.0,
                    death_runs_conceded=runs_conceded * 0.3,
                    death_overs_bowled=5.0,
                )
            )
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


def test_build_dataset_home_team_survives_dedup():
    """Regression: drop_duplicates(subset=["date","pair"]) keeps an arbitrary
    per-team row. The home flag must be resolved from BOTH rows of the pair,
    not just whichever row happens to survive dedup."""
    d = date(2024, 4, 1)
    df = pd.DataFrame(
        [
            # away team's row listed FIRST -> it is the one drop_duplicates keeps
            dict(
                team="Beta",
                opponent="Alpha",
                date=d,
                season="2024",
                league="SYN",
                venue="V0",
                won=False,
                dls=False,
                runs_scored=150.0,
                overs_faced=20.0,
                runs_conceded=160.0,
                overs_bowled=20.0,
                home=False,
                batted_first=True,
                pp_runs_scored=45.0,
                pp_overs_faced=6.0,
                death_runs_conceded=48.0,
                death_overs_bowled=5.0,
            ),
            # home team's row listed SECOND -> would be dropped as a duplicate
            dict(
                team="Alpha",
                opponent="Beta",
                date=d,
                season="2024",
                league="SYN",
                venue="V0",
                won=True,
                dls=False,
                runs_scored=160.0,
                overs_faced=20.0,
                runs_conceded=150.0,
                overs_bowled=20.0,
                home=True,
                batted_first=False,
                pp_runs_scored=48.0,
                pp_overs_faced=6.0,
                death_runs_conceded=45.0,
                death_overs_bowled=5.0,
            ),
        ]
    )
    X, y, meta = build_dataset(df)
    assert len(X) == 1
    # Alpha < Beta alphabetically -> team_a = Alpha, and Alpha is the home team
    assert X.loc[0, "home_a"] == 1.0
    assert X.loc[0, "home_b"] == 0.0


def test_train_writes_artifact_and_metrics(tmp_path):
    df = synthetic_team_matches(600)
    X, y, meta = build_dataset(df)
    metrics = train_and_evaluate(X, y, meta, out_dir=tmp_path)
    assert (tmp_path / "model.pkl").exists()
    saved = json.loads((tmp_path / "metrics.json").read_text())
    for key in [
        "model",
        "elo",
        "always_home_accuracy",
        "gate_passed",
        "n_train",
        "n_test",
        "test_period",
    ]:
        assert key in saved
    assert 0.0 < metrics["model"]["log_loss"] < 1.5
    # synthetic league is learnable: model should beat coin flip clearly
    assert metrics["model"]["accuracy"] > 0.55
