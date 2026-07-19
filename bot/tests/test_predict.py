from pathlib import Path

from bot.predict import load_artifact, predict
from bot.tests.test_train import synthetic_team_matches
from bot.train import build_dataset, train_and_evaluate


def _artifact(tmp_path) -> Path:
    df = synthetic_team_matches(600)
    X, y, meta = build_dataset(df)
    train_and_evaluate(X, y, meta, out_dir=tmp_path)
    return tmp_path / "model.pkl"


def test_predict_prob_and_reasons(tmp_path):
    art = load_artifact(_artifact(tmp_path))
    strong_a = {n: 0.5 for n in art["feature_names"]}
    strong_a.update({"form5_a": 0.95, "form10_a": 0.9, "form5_b": 0.1,
                     "form10_b": 0.15, "bat_rr_a": 9.5, "bat_rr_b": 6.5})
    prob, reasons = predict(art, strong_a)
    assert 0.02 <= prob <= 0.98
    assert prob > 0.5
    assert len(reasons) == 3
    assert all(r in art["feature_names"] for r in reasons)


def test_predict_clips_extremes(tmp_path):
    art = load_artifact(_artifact(tmp_path))
    f = {n: 0.5 for n in art["feature_names"]}
    prob, _ = predict(art, f)
    assert 0.02 <= prob <= 0.98
