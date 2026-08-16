"""Live and mid-innings probability adjustment layer on top of pre-match baseline model."""

import numpy as np

from .match_input import MatchInput


def adjust_probability(
    pre_match_prob_a: float,
    inp: MatchInput,
    venue_avg_1st: float = 165.0,
    venue_chase_win_rate: float = 0.52,
) -> tuple[float, list[str]]:
    """Takes the pre-match LightGBM probability for team_a and adjusts for live match state."""
    prob_a = float(np.clip(pre_match_prob_a, 0.05, 0.95))
    reasons = []

    team_a = inp.team_a or "Team A"
    team_b = inp.team_b or "Team B"

    # Pre-Match Phase
    if inp.phase == "pre_match":
        if inp.toss_winner and inp.toss_decision:
            toss_chasing = inp.toss_decision == "field"
            chase_advantage = venue_chase_win_rate - 0.50
            if inp.toss_winner == team_a:
                delta = 0.04 + max(
                    0.0, chase_advantage if toss_chasing else -chase_advantage
                )
                prob_a = np.clip(prob_a + delta, 0.05, 0.95)
                reasons.append(f"{team_a} won toss & elected to {inp.toss_decision}")
            else:
                delta = 0.04 + max(
                    0.0, chase_advantage if toss_chasing else -chase_advantage
                )
                prob_a = np.clip(prob_a - delta, 0.05, 0.95)
                reasons.append(f"{team_b} won toss & elected to {inp.toss_decision}")
        return float(prob_a), reasons

    # Innings Break Phase
    if inp.phase == "innings_break":
        runs1 = inp.innings1_runs or int(venue_avg_1st)
        diff = runs1 - venue_avg_1st
        # Every 10 runs difference from venue average shifts win prob noticeably
        logit_shift = diff * 0.025

        if inp.innings1_team == team_a:
            prob_a = 1.0 / (
                1.0 + np.exp(-(np.log(prob_a / (1.0 - prob_a)) + logit_shift))
            )
            if diff > 5:
                reasons.append(
                    f"{team_a} total ({runs1}) is +{int(diff)} above venue average ({int(venue_avg_1st)})"
                )
            elif diff < -5:
                reasons.append(
                    f"{team_a} total ({runs1}) is {int(diff)} below venue average ({int(venue_avg_1st)})"
                )
            else:
                reasons.append(
                    f"{team_a} posted par score ({runs1}) matching venue average"
                )
        else:
            # Team B batted first
            prob_a = 1.0 / (
                1.0 + np.exp(-(np.log(prob_a / (1.0 - prob_a)) - logit_shift))
            )
            if diff > 5:
                reasons.append(
                    f"{team_b} total ({runs1}) is +{int(diff)} above venue average ({int(venue_avg_1st)})"
                )
            elif diff < -5:
                reasons.append(
                    f"{team_b} total ({runs1}) is {int(diff)} below venue average ({int(venue_avg_1st)})"
                )
            else:
                reasons.append(
                    f"{team_b} posted par score ({runs1}) matching venue average"
                )

        return float(np.clip(prob_a, 0.02, 0.98)), reasons

    # Chase in Progress Phase
    if inp.phase == "chase_in_progress":
        target = (
            (inp.innings1_runs + 1) if inp.innings1_runs else int(venue_avg_1st + 1)
        )
        runs2 = inp.innings2_runs or 0
        w2 = inp.innings2_wickets or 0
        overs2 = inp.innings2_overs or 0.0

        runs_needed = max(1, target - runs2)
        balls_bowled = int(overs2) * 6 + int(round((overs2 - int(overs2)) * 10))
        balls_left = max(1, 120 - balls_bowled)
        rrr = (runs_needed / (balls_left / 6.0)) if balls_left > 0 else 99.0
        wickets_in_hand = max(0, 10 - w2)

        # Baseline expected chase probability based on RRR & wickets in hand
        # Typical resource availability: RRR 8 with 8 wkts is ~50%, RRR 12 with 4 wkts is ~10%
        chase_difficulty = (rrr - 8.0) * 0.25 - (wickets_in_hand - 5) * 0.12

        chase_win_prob = 1.0 / (1.0 + np.exp(chase_difficulty))
        chase_win_prob = float(np.clip(chase_win_prob, 0.01, 0.99))

        chasing_team = inp.innings2_team or team_b
        if chasing_team == team_a:
            # Team A is chasing: blend pre-match prior with live match state
            blend_weight = min(0.90, balls_bowled / 100.0)
            prob_a = (1 - blend_weight) * prob_a + blend_weight * chase_win_prob
            reasons.append(
                f"{team_a} need {runs_needed} off {balls_left} balls (RRR {rrr:.2f}) with {wickets_in_hand} wkts left"
            )
        else:
            # Team B is chasing: chase_win_prob is Team B's win probability
            team_b_prob = chase_win_prob
            blend_weight = min(0.90, balls_bowled / 100.0)
            prob_b_prior = 1.0 - prob_a
            prob_b = (1 - blend_weight) * prob_b_prior + blend_weight * team_b_prob
            prob_a = 1.0 - prob_b
            reasons.append(
                f"{team_b} need {runs_needed} off {balls_left} balls (RRR {rrr:.2f}) with {wickets_in_hand} wkts left"
            )

        return float(np.clip(prob_a, 0.01, 0.99)), reasons

    if inp.phase == "completed":
        if inp.innings1_runs is not None and inp.innings2_runs is not None:
            if inp.innings2_runs >= inp.innings1_runs:
                winner = inp.innings2_team or team_b
            else:
                winner = inp.innings1_team or team_a
            prob_a = 1.0 if winner == team_a else 0.0
            reasons.append(f"Match concluded: {winner} won")
            return prob_a, reasons

    return prob_a, reasons
