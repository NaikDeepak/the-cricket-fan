"""Load committed artifact; produce calibrated probability + top-3 SHAP reasons."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap


def load_artifact(path: Path) -> dict:
    # Security: joblib.load executes pickled code. Safe here because the artifact
    # is produced by our own retrain workflow and committed to this repo — it is
    # never loaded from user input or fetched over the network. Do not point this
    # at untrusted files.
    art = joblib.load(path)
    art["explainer"] = shap.TreeExplainer(art["model"])
    return art


def predict(artifact: dict, features: dict) -> tuple[float, list[str]]:
    names = artifact["feature_names"]
    X = pd.DataFrame([[features[n] for n in names]], columns=names)
    raw = artifact["model"].predict_proba(X)[:, 1]
    prob = float(np.clip(artifact["calibrator"].predict(raw), 0.02, 0.98)[0])
    sv = artifact["explainer"].shap_values(X)
    vals = sv[1][0] if isinstance(sv, list) else np.asarray(sv)[0]
    top = np.argsort(-np.abs(vals))[:3]
    return prob, [names[i] for i in top]
