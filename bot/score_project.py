"""Score projection heuristics for T20 match states."""

from .match_input import MatchInput


def project_first_innings(
    runs: int | None,
    wickets: int | None,
    overs: float | None,
    venue_avg: float = 165.0,
) -> tuple[int, int]:
    """Returns (projected_min, projected_max) for 1st innings score."""
    if runs is None or overs is None or overs <= 0:
        base = int(round(venue_avg))
        return max(120, base - 10), base + 10

    if overs >= 20.0 or (wickets is not None and wickets >= 10):
        return runs, runs

    crr = runs / overs
    remaining_overs = max(0.0, 20.0 - overs)
    w = wickets if wickets is not None else 0

    # Resource multiplier based on wickets in hand (similar to DLS/wasp concepts)
    if w <= 2:
        accel = 1.15
    elif w <= 4:
        accel = 1.05
    elif w <= 6:
        accel = 0.95
    elif w <= 8:
        accel = 0.80
    else:
        accel = 0.60

    # Blend current trajectory with venue expectations for early overs
    if overs < 6.0:
        weight_crr = overs / 6.0
        expected_rr = (crr * weight_crr) + ((venue_avg / 20.0) * (1 - weight_crr))
    else:
        expected_rr = crr

    projected_mid = runs + (expected_rr * remaining_overs * accel)
    spread = max(5, int(round(remaining_overs * 0.8)))

    low = int(round(projected_mid - spread))
    high = int(round(projected_mid + spread))
    return max(runs, low), max(runs + int(remaining_overs * 4), high)


def project_match_score(
    inp: MatchInput,
    venue_avg: float = 165.0,
) -> dict:
    """Returns projected score dictionary with narrative summary."""
    if inp.phase == "completed":
        return {
            "phase": inp.phase,
            "innings1_final": inp.innings1_runs,
            "innings2_final": inp.innings2_runs,
            "projection_text": f"Final: {inp.team_a} {inp.innings1_runs}/{inp.innings1_wickets or 0}, {inp.team_b} {inp.innings2_runs}/{inp.innings2_wickets or 0}",
        }
    if inp.phase == "chase_in_progress" and inp.innings1_runs is not None:
        target = inp.innings1_runs + 1
        runs2 = inp.innings2_runs or 0
        overs2 = inp.innings2_overs or 0.0
        runs_needed = max(0, target - runs2)
        balls_bowled = int(overs2) * 6 + int(round((overs2 - int(overs2)) * 10))
        balls_left = max(0, 120 - balls_bowled)
        rrr = (runs_needed / (balls_left / 6.0)) if balls_left > 0 else 99.0

        return {
            "phase": inp.phase,
            "target": target,
            "runs_needed": runs_needed,
            "balls_left": balls_left,
            "required_rate": round(rrr, 2),
            "projection_text": f"{inp.innings2_team or inp.team_b} need {runs_needed} runs from {balls_left} balls (RRR {rrr:.2f})",
        }
    if inp.phase == "innings_break" and inp.innings1_runs is not None:
        target = inp.innings1_runs + 1
        rrr = target / 20.0
        return {
            "phase": inp.phase,
            "target": target,
            "required_rate": round(rrr, 2),
            "projection_text": f"Target: {target} (Required RR: {rrr:.2f})",
        }
    # Pre-match or 1st innings in progress
    low, high = project_first_innings(
        inp.innings1_runs, inp.innings1_wickets, inp.innings1_overs, venue_avg
    )
    return {
        "phase": inp.phase,
        "projected_range": [low, high],
        "projected_text": f"Projected score: {low}–{high}",
    }
