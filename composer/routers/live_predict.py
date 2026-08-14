from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from bot.compose import live_prediction_post
from bot.features import build_features
from bot.live_adjust import adjust_probability
from bot.match_input import MatchInput, fetch_and_parse_url, parse_match_text
from bot.predict import predict
from bot.run import _home_team_at_venue, _load_team_matches
from bot.score_project import project_match_score

from ..deps import get_conn
from ..schemas import LivePredictionOut, MatchInputSchema, MatchParseIn

router = APIRouter()


@router.post("/live-predict/parse", response_model=MatchInputSchema)
def parse_match(body: MatchParseIn, conn=Depends(get_conn)) -> MatchInputSchema:
    if body.url and body.url.strip():
        try:
            match_input = fetch_and_parse_url(body.url.strip(), conn=conn)
        except Exception as e:
            raise HTTPException(400, f"Failed to fetch or parse URL: {e}") from e
    elif body.raw_text and body.raw_text.strip():
        match_input = parse_match_text(body.raw_text, conn=conn)
    else:
        raise HTTPException(422, "Either raw_text or url must be provided")

    return MatchInputSchema(
        team_a=match_input.team_a,
        team_b=match_input.team_b,
        league=match_input.league,
        venue=match_input.venue,
        toss_winner=match_input.toss_winner,
        toss_decision=match_input.toss_decision,
        innings1_team=match_input.innings1_team,
        innings1_runs=match_input.innings1_runs,
        innings1_wickets=match_input.innings1_wickets,
        innings1_overs=match_input.innings1_overs,
        innings2_team=match_input.innings2_team,
        innings2_runs=match_input.innings2_runs,
        innings2_wickets=match_input.innings2_wickets,
        innings2_overs=match_input.innings2_overs,
        phase=match_input.phase,
    )


@router.post("/live-predict/run", response_model=LivePredictionOut)
def run_live_prediction(
    body: MatchInputSchema, request: Request, conn=Depends(get_conn)
) -> LivePredictionOut:
    if not body.team_a or not body.team_b:
        raise HTTPException(422, "Both team_a and team_b are required for prediction")

    inp = MatchInput(
        team_a=body.team_a,
        team_b=body.team_b,
        league=body.league,
        venue=body.venue,
        toss_winner=body.toss_winner,
        toss_decision=body.toss_decision,
        innings1_team=body.innings1_team,
        innings1_runs=body.innings1_runs,
        innings1_wickets=body.innings1_wickets,
        innings1_overs=body.innings1_overs,
        innings2_team=body.innings2_team,
        innings2_runs=body.innings2_runs,
        innings2_wickets=body.innings2_wickets,
        innings2_overs=body.innings2_overs,
        phase=body.phase,
    )

    df = _load_team_matches(conn)
    artifact = getattr(request.app.state, "artifact", None)

    # 1. Base pre-match probability & SHAP reasons
    prob_base = 0.50
    reasons_base: list[str] = []

    if artifact is not None:
        try:
            home = _home_team_at_venue(df, inp.venue, inp.team_a, inp.team_b)
            feats = build_features(
                df,
                inp.team_a,
                inp.team_b,
                inp.venue,
                datetime.now(timezone.utc).date(),
                home_team=home,
            )
            prob_base, reasons_base = predict(artifact, feats)
        except Exception:
            prob_base = 0.50
            reasons_base = []

    # 2. Historical venue 1st innings average
    venue_avg = 165.0
    if len(df) and inp.venue:
        venue_rows = df[(df["venue"] == inp.venue) & (df["batted_first"])]
        if len(venue_rows) > 0 and venue_rows["runs_scored"].notnull().any():
            venue_avg = float(venue_rows["runs_scored"].dropna().mean())

    # 3. Live Probability Adjustment
    prob_live, live_reasons = adjust_probability(
        prob_base, inp, venue_avg_1st=venue_avg
    )

    # Combined reasons (live factors first, then pre-match feature drivers)
    combined_reasons = list(live_reasons)
    for r in reasons_base:
        if len(combined_reasons) >= 3:
            break
        if r not in combined_reasons:
            combined_reasons.append(r)

    # 4. Score Projection
    score_proj = project_match_score(inp, venue_avg=venue_avg)

    # 5. Score summary string
    score_summary = None
    if inp.phase == "innings_break" and inp.innings1_runs is not None:
        score_summary = f"{inp.innings1_team or inp.team_a} {inp.innings1_runs}/{inp.innings1_wickets or 0}"
    elif inp.phase == "chase_in_progress" and inp.innings2_runs is not None:
        score_summary = f"{inp.innings2_team or inp.team_b} {inp.innings2_runs}/{inp.innings2_wickets or 0} ({inp.innings2_overs or 0} ov)"
    elif inp.innings1_runs is not None:
        score_summary = f"{inp.innings1_team or inp.team_a} {inp.innings1_runs}/{inp.innings1_wickets or 0} ({inp.innings1_overs or 0} ov)"

    # 6. Tweet Generation (no emojis, hashtag included)
    tweet_text = live_prediction_post(
        team_a=inp.team_a,
        team_b=inp.team_b,
        prob_a=prob_live,
        reasons=combined_reasons,
        phase=inp.phase,
        league=inp.league,
        score_summary=score_summary,
    )

    # 7. Card metadata
    card_meta = {
        "team_a": inp.team_a,
        "team_b": inp.team_b,
        "prob_a": prob_live,
        "reasons": combined_reasons,
        "phase": inp.phase,
        "league": inp.league,
        "venue": inp.venue,
        "score_summary": score_summary,
        "score_projection": score_proj,
    }

    return LivePredictionOut(
        team_a=inp.team_a,
        team_b=inp.team_b,
        prob_team_a=prob_live,
        reasons=combined_reasons,
        phase=inp.phase,
        score_projection=score_proj,
        tweet_text=tweet_text,
        card_meta=card_meta,
    )
