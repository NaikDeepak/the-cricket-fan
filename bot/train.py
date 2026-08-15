"""Offline training: Cricsheet dir -> team_matches df -> features -> LightGBM
+ isotonic calibration -> artifacts (model.pkl, metrics.json) with baseline gate.
"""

import argparse
import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

from .cricsheet import parse_result
from .elo import Elo
from .features import FEATURE_NAMES, build_features


def build_team_matches(cricsheet_dir: Path, league_map: dict[str, str]) -> pd.DataFrame:
    """league_map: file-stem (or stem prefix before first '_') -> league label.
    Supports '*' or 'default' fallback in league_map. Files whose stem is not mapped are skipped."""
    rows = []
    for f in sorted(cricsheet_dir.glob("*.json")):
        league = (
            league_map.get(f.stem)
            or league_map.get(f.stem.split("_")[0])
            or league_map.get("*")
            or league_map.get("default")
        )
        if not league:
            continue
        for r in parse_result(f, league=league):
            rows.append(r.__dict__)
    return pd.DataFrame(rows)


def build_dataset(df: pd.DataFrame):
    """One sample per match. team_a = alphabetically-first team (deterministic).

    Returns (X, y, meta) where meta is a DataFrame with columns date/team_a/team_b,
    index-aligned with X and y.
    """
    matches = df.copy()
    matches["pair"] = matches.apply(
        lambda r: tuple(sorted([r["team"], r["opponent"]])), axis=1
    )
    # Each match has one row per team; only the home team's OWN row carries
    # home=True. Resolve home_team from BOTH rows before deduping, since
    # drop_duplicates below keeps an arbitrary (possibly away-team) row.
    home_lookup = {}
    for _, r in matches.iterrows():
        if r["home"]:
            home_lookup[(r["date"], r["pair"])] = r["team"]
    matches = matches.drop_duplicates(subset=["date", "pair"])
    feats, labels, dts, pairs = [], [], [], []
    for _, m in matches.iterrows():
        team_a, team_b = m["pair"]
        won_a = m["won"] if m["team"] == team_a else not m["won"]
        home_team = home_lookup.get((m["date"], m["pair"]))
        f = build_features(
            df, team_a, team_b, m["venue"], m["date"], home_team=home_team
        )
        feats.append(f)
        labels.append(1 if won_a else 0)
        dts.append(m["date"])
        pairs.append((team_a, team_b))
    X = pd.DataFrame(feats, columns=FEATURE_NAMES)
    y = pd.Series(labels, name="y")
    meta = pd.DataFrame(
        {"date": dts, "team_a": [p[0] for p in pairs], "team_b": [p[1] for p in pairs]}
    )
    return X, y, meta


def _year(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s).dt.year


def train_and_evaluate(
    X: pd.DataFrame, y: pd.Series, meta: pd.DataFrame, out_dir: Path
) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    years = _year(meta["date"])
    max_year = int(years.max())
    tr = years <= max_year - 2
    va = years == max_year - 1
    te = years == max_year

    model = lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=15,
        min_child_samples=20,
        random_state=42,
        verbose=-1,
    )
    model.fit(X[tr], y[tr])

    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(model.predict_proba(X[va])[:, 1], y[va])
    p_test = np.clip(calibrator.predict(model.predict_proba(X[te])[:, 1]), 0.01, 0.99)
    y_test = y[te].to_numpy()

    # Elo baseline: replayed chronologically over all matches (train+val+test),
    # recording each pre-match expectation before applying the post-match update,
    # then scored only on the test period.
    elo = Elo()
    elo_p = np.zeros(len(meta))
    order = meta["date"].sort_values(kind="stable").index
    for idx in order:
        a, b = meta.loc[idx, "team_a"], meta.loc[idx, "team_b"]
        elo_p[meta.index.get_loc(idx)] = elo.expect(a, b)
        elo.update(a, b, a_won=bool(y.loc[idx]))
    elo_test = np.clip(elo_p[te.to_numpy()], 0.01, 0.99)

    home_pred = (X.loc[te, "home_a"] >= X.loc[te, "home_b"]).astype(int)

    metrics = {
        "model": {
            "accuracy": float(accuracy_score(y_test, p_test > 0.5)),
            "log_loss": float(log_loss(y_test, p_test)),
            "brier": float(brier_score_loss(y_test, p_test)),
        },
        "elo": {
            "accuracy": float(accuracy_score(y_test, elo_test > 0.5)),
            "log_loss": float(log_loss(y_test, elo_test)),
            "brier": float(brier_score_loss(y_test, elo_test)),
        },
        "always_home_accuracy": float(accuracy_score(y_test, home_pred)),
        "n_train": int(tr.sum()),
        "n_test": int(te.sum()),
        "test_period": str(max_year),
    }
    metrics["gate_passed"] = bool(
        metrics["model"]["log_loss"] < metrics["elo"]["log_loss"]
        and metrics["model"]["brier"] < metrics["elo"]["brier"]
    )
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    joblib.dump(
        {"model": model, "calibrator": calibrator, "feature_names": FEATURE_NAMES},
        out_dir / "model.pkl",
    )
    return metrics


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cricsheet-dir", type=Path, required=True)
    ap.add_argument(
        "--league-map",
        type=Path,
        required=True,
        help="JSON file: file-stem/prefix -> league label",
    )
    ap.add_argument("--out", type=Path, default=Path("bot/artifacts"))
    args = ap.parse_args()
    league_map = json.loads(args.league_map.read_text())
    df = build_team_matches(args.cricsheet_dir, league_map)
    X, y, meta = build_dataset(df)
    metrics = train_and_evaluate(X, y, meta, args.out)
    print(json.dumps(metrics, indent=2))
    if not metrics["gate_passed"]:
        raise SystemExit("GATE FAILED: model does not beat Elo baseline. Do not ship.")


if __name__ == "__main__":
    main()
