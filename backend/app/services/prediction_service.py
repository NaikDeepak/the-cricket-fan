def calculate_prediction(stats: dict) -> dict:
    """
    Weighted factor scoring — three factors, each scored 0–100.
    All inputs come from VenueStats; no team-specific hardcoding.
    """
    team_a = stats["team_a_short"]
    team_b = stats["team_b_short"]
    venue_short = stats["venue"].split(",")[0]
    factors = []

    # Factor 1: Overall win % at this venue (weight 0.40)
    a_win = stats["team_a_win_pct"]
    b_win = stats["team_b_win_pct"]
    factors.append({
        "label": f"{venue_short.upper()} RECORD",
        "detail": f"{team_a} win {a_win}% here · {team_b} win {b_win}%",
        "a_score": 70 if a_win > b_win else (30 if a_win < b_win else 50),
        "weight": 0.40,
    })

    # Factor 2: Chase win % at venue (weight 0.35)
    a_chase = stats["team_a_chase_pct"]
    b_chase = stats["team_b_chase_pct"]
    factors.append({
        "label": "CHASE RECORD",
        "detail": f"{team_a} chase {a_chase}% here · {team_b} chase {b_chase}%",
        "a_score": 70 if a_chase > b_chase else (30 if a_chase < b_chase else 50),
        "weight": 0.35,
    })

    # Factor 3: Average score at venue — proxy for batting depth (weight 0.25)
    a_avg = stats["team_a_avg_score"]
    b_avg = stats["team_b_avg_score"]
    factors.append({
        "label": "BATTING FIREPOWER",
        "detail": f"{team_a} avg {a_avg:.0f} at this ground · {team_b} avg {b_avg:.0f}",
        "a_score": 65 if a_avg > b_avg else (40 if a_avg < b_avg else 50),
        "weight": 0.25,
    })

    team_a_prob = round(sum(f["a_score"] * f["weight"] for f in factors))
    winning_team = team_a if team_a_prob >= 50 else team_b
    probability = team_a_prob if winning_team == team_a else 100 - team_a_prob

    return {
        "team": winning_team,
        "probability": probability,
        "evidence": [{"label": f["label"], "detail": f["detail"]} for f in factors],
    }
