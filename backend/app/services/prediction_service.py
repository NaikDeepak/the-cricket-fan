def calculate_prediction(stats: dict) -> dict:
    """
    Weighted factor scoring. Three factors, each scored 0-100.
    Factor weights sum to 1.0.
    """
    factors = []

    # Factor 1: Death over economy (lower is better — MI leads)
    mi_econ = stats["mi_death_economy"]
    csk_econ = stats["csk_death_economy"]
    econ_score = 70 if mi_econ < csk_econ else 30
    factors.append({
        "label": "DEATH OVER DOMINANCE",
        "detail": f"Economy {mi_econ} vs CSK · Overs 17–20",
        "mi_score": econ_score,
        "weight": 0.35,
    })

    # Factor 2: Venue chase record
    mi_chase = stats["mi_chase_win_pct"]
    csk_chase = stats["csk_chase_win_pct"]
    chase_score = 75 if mi_chase > csk_chase else 40
    factors.append({
        "label": "WANKHEDE CHASE RECORD",
        "detail": f"{mi_chase}% wins chasing · CSK: {csk_chase}%",
        "mi_score": chase_score,
        "weight": 0.40,
    })

    # Factor 3: Spin weakness
    csk_spin = stats["csk_vs_spin_avg"]
    mi_spin = stats["mi_vs_spin_avg"]
    spin_score = 65 if mi_spin > csk_spin else 45
    factors.append({
        "label": "SPIN EXPOSURE",
        "detail": f"CSK top-3 avg {csk_spin} vs left-arm spin",
        "mi_score": spin_score,
        "weight": 0.25,
    })

    probability = round(sum(f["mi_score"] * f["weight"] for f in factors))
    winning_team = "MI" if probability >= 50 else "CSK"
    if winning_team == "CSK":
        probability = 100 - probability

    return {
        "team": winning_team,
        "probability": probability,
        "evidence": [{"label": f["label"], "detail": f["detail"]} for f in factors],
    }
