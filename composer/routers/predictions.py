import json
import logging
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response

from bot.db import fixtures, predictions
from bot.match_input import parse_match_text

from ..deps import get_conn
from ..schemas import (
    LeagueAccuracyStats,
    PredictionAccuracyStats,
    PredictionIn,
    PredictionOut,
    PredictionPatch,
    PredictionResultIn,
    PredictionSettleFromTextIn,
    RunModelOut,
    SettleFromApiOut,
    TodayMatchOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["predictions"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _matches_team(team_canonical: str, query: str) -> bool:
    if not team_canonical or not query:
        return False
    tc = team_canonical.strip().lower()
    q = query.strip().lower()
    return q == tc or q in tc or tc in q


def _build_prediction_select():
    return sa.select(
        predictions.c.id,
        predictions.c.fixture_id,
        sa.func.coalesce(predictions.c.team_a, fixtures.c.team_a, "Team A").label("team_a"),
        sa.func.coalesce(predictions.c.team_b, fixtures.c.team_b, "Team B").label("team_b"),
        sa.func.coalesce(predictions.c.venue, fixtures.c.venue, "TBD").label("venue"),
        sa.func.coalesce(predictions.c.league, fixtures.c.league, "IPL").label("league"),
        fixtures.c.start_time,
        predictions.c.prob_team_a,
        predictions.c.reasons_json,
        predictions.c.actual_winner,
        predictions.c.result_summary,
        predictions.c.outcome,
        predictions.c.created_at,
        predictions.c.evaluated_at,
    ).select_from(
        predictions.outerjoin(fixtures, predictions.c.fixture_id == fixtures.c.id)
    )


def _row_to_prediction_out(r) -> PredictionOut:
    reasons = json.loads(r.reasons_json) if r.reasons_json else []
    team_a = r.team_a or "Team A"
    team_b = r.team_b or "Team B"
    predicted_winner = team_a if r.prob_team_a >= 0.5 else team_b
    return PredictionOut(
        id=r.id,
        fixture_id=r.fixture_id,
        team_a=team_a,
        team_b=team_b,
        venue=r.venue or "TBD",
        league=r.league or "IPL",
        start_time=r.start_time,
        prob_team_a=r.prob_team_a,
        reasons=reasons,
        predicted_winner=predicted_winner,
        actual_winner=r.actual_winner,
        result_summary=r.result_summary,
        outcome=r.outcome or "pending",
        created_at=r.created_at,
        evaluated_at=r.evaluated_at,
    )


@router.get("/predictions/accuracy", response_model=PredictionAccuracyStats)
def get_prediction_accuracy(conn=Depends(get_conn)) -> PredictionAccuracyStats:
    rows = conn.execute(_build_prediction_select().order_by(predictions.c.created_at.desc())).all()

    total = len(rows)
    pending = 0
    correct = 0
    incorrect = 0
    void = 0

    league_stats: dict[str, dict[str, int]] = {}
    recent_outcomes: list[str] = []

    for r in rows:
        outcome = r.outcome or "pending"
        lg = r.league or "IPL"
        if lg not in league_stats:
            league_stats[lg] = {"total": 0, "evaluated": 0, "correct": 0, "incorrect": 0}

        league_stats[lg]["total"] += 1

        if outcome == "correct":
            correct += 1
            league_stats[lg]["evaluated"] += 1
            league_stats[lg]["correct"] += 1
            recent_outcomes.append("correct")
        elif outcome == "incorrect":
            incorrect += 1
            league_stats[lg]["evaluated"] += 1
            league_stats[lg]["incorrect"] += 1
            recent_outcomes.append("incorrect")
        elif outcome == "void":
            void += 1
        else:
            pending += 1

    evaluated = correct + incorrect
    accuracy_pct = round((correct / evaluated) * 100) if evaluated > 0 else 0

    # Calculate current streak
    streak = 0
    streak_type = "none"
    if recent_outcomes:
        streak_type = "win" if recent_outcomes[0] == "correct" else "loss"
        target = "correct" if streak_type == "win" else "incorrect"
        for outcome in recent_outcomes:
            if outcome == target:
                streak += 1
            else:
                break

    by_league: list[LeagueAccuracyStats] = []
    for lg, s in sorted(league_stats.items(), key=lambda x: x[0]):
        eval_count = s["evaluated"]
        acc = round((s["correct"] / eval_count) * 100) if eval_count > 0 else 0
        by_league.append(
            LeagueAccuracyStats(
                league=lg,
                total=s["total"],
                evaluated=eval_count,
                correct=s["correct"],
                incorrect=s["incorrect"],
                accuracy_pct=acc,
            )
        )

    return PredictionAccuracyStats(
        total=total,
        evaluated=evaluated,
        pending=pending,
        correct=correct,
        incorrect=incorrect,
        void=void,
        accuracy_pct=accuracy_pct,
        streak=streak,
        streak_type=streak_type,
        recent_outcomes=recent_outcomes[:10],
        by_league=by_league,
    )


@router.get("/predictions", response_model=list[PredictionOut])
def list_predictions(
    outcome: str | None = None,
    league: str | None = None,
    search: str | None = None,
    limit: int = 100,
    conn=Depends(get_conn),
) -> list[PredictionOut]:
    q = _build_prediction_select().order_by(predictions.c.created_at.desc()).limit(limit)

    if outcome and outcome.strip() and outcome != "all":
        q = q.where(predictions.c.outcome == outcome.strip())
    if league and league.strip() and league != "All":
        q = q.where(
            sa.or_(
                predictions.c.league == league.strip(),
                fixtures.c.league == league.strip(),
            )
        )
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.where(
            sa.or_(
                sa.func.lower(predictions.c.team_a).like(term),
                sa.func.lower(predictions.c.team_b).like(term),
                sa.func.lower(fixtures.c.team_a).like(term),
                sa.func.lower(fixtures.c.team_b).like(term),
                sa.func.lower(predictions.c.venue).like(term),
            )
        )

    rows = conn.execute(q).all()
    return [_row_to_prediction_out(r) for r in rows]


@router.get("/predictions/today", response_model=list[TodayMatchOut])
def get_today_matches(conn=Depends(get_conn)) -> list[TodayMatchOut]:
    """Return today's fixtures joined with any existing model predictions."""
    from datetime import date
    today = date.today()

    # All fixtures for today (UTC start_time)
    fixture_rows = conn.execute(
        sa.select(fixtures).where(
            sa.func.date(fixtures.c.start_time) == today.isoformat()
        ).order_by(fixtures.c.start_time)
    ).all()

    if not fixture_rows:
        # Also look at tomorrow for pre-match purposes if nothing today
        from datetime import timedelta
        tomorrow = today + timedelta(days=1)
        fixture_rows = conn.execute(
            sa.select(fixtures).where(
                sa.func.date(fixtures.c.start_time) == tomorrow.isoformat()
            ).order_by(fixtures.c.start_time)
        ).all()

    result: list[TodayMatchOut] = []
    for f in fixture_rows:
        pred_row = conn.execute(
            _build_prediction_select().where(predictions.c.fixture_id == f.id)
        ).fetchone()
        pred_out = _row_to_prediction_out(pred_row) if pred_row else None

        result.append(TodayMatchOut(
            fixture_id=f.id,
            team_a=f.team_a,
            team_b=f.team_b,
            league=f.league,
            venue=f.venue,
            start_time=f.start_time,
            fixture_status=f.status,
            winner=f.winner,
            prediction=pred_out,
        ))

    return result


@router.get("/predictions/{pred_id}", response_model=PredictionOut)
def get_prediction(pred_id: int, conn=Depends(get_conn)) -> PredictionOut:
    q = _build_prediction_select().where(predictions.c.id == pred_id)
    row = conn.execute(q).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return _row_to_prediction_out(row)


@router.post("/predictions", response_model=PredictionOut, status_code=201)
def create_prediction(body: PredictionIn, conn=Depends(get_conn)) -> PredictionOut:
    now = _now()
    outcome = body.outcome or "pending"
    evaluated_at = now if outcome in ("correct", "incorrect", "void") else None

    # If actual_winner is provided, evaluate outcome automatically if outcome is pending
    if body.actual_winner and outcome == "pending":
        pred_winner = body.team_a if body.prob_team_a >= 0.5 else body.team_b
        if body.actual_winner.lower() in ("no_result", "abandoned", "void"):
            outcome = "void"
        elif _matches_team(pred_winner, body.actual_winner):
            outcome = "correct"
        else:
            outcome = "incorrect"
        evaluated_at = now

    pid = conn.execute(
        predictions.insert().values(
            fixture_id=body.fixture_id,
            team_a=body.team_a.strip(),
            team_b=body.team_b.strip(),
            league=body.league.strip(),
            venue=body.venue.strip(),
            prob_team_a=body.prob_team_a,
            reasons_json=json.dumps(body.reasons),
            features_json=json.dumps({}),
            actual_winner=body.actual_winner,
            result_summary=body.result_summary,
            outcome=outcome,
            created_at=now,
            evaluated_at=evaluated_at,
        )
    ).inserted_primary_key[0]
    conn.commit()

    q = _build_prediction_select().where(predictions.c.id == pid)
    row = conn.execute(q).one()
    return _row_to_prediction_out(row)


@router.post("/predictions/{pred_id}/result", response_model=PredictionOut)
def record_prediction_result(
    pred_id: int,
    body: PredictionResultIn,
    conn=Depends(get_conn),
) -> PredictionOut:
    row = conn.execute(_build_prediction_select().where(predictions.c.id == pred_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")

    now = _now()
    team_a = row.team_a
    team_b = row.team_b
    prob_team_a = row.prob_team_a
    predicted_winner = team_a if prob_team_a >= 0.5 else team_b

    actual_winner = body.actual_winner.strip()

    if body.outcome:
        outcome = body.outcome
    elif actual_winner.lower() in ("no_result", "abandoned", "void", "tied", "no result"):
        outcome = "void"
    elif _matches_team(predicted_winner, actual_winner):
        outcome = "correct"
    else:
        outcome = "incorrect"

    conn.execute(
        predictions.update()
        .where(predictions.c.id == pred_id)
        .values(
            actual_winner=actual_winner,
            result_summary=body.result_summary,
            outcome=outcome,
            evaluated_at=now,
        )
    )

    if row.fixture_id:
        conn.execute(
            fixtures.update()
            .where(fixtures.c.id == row.fixture_id)
            .values(
                status="void" if outcome == "void" else "completed",
                winner=actual_winner if outcome != "void" else None,
            )
        )

    conn.commit()

    updated = conn.execute(_build_prediction_select().where(predictions.c.id == pred_id)).one()
    return _row_to_prediction_out(updated)


@router.post("/predictions/settle-from-text", response_model=PredictionOut)
def settle_prediction_from_text(
    body: PredictionSettleFromTextIn,
    conn=Depends(get_conn),
) -> PredictionOut:
    raw_text = body.raw_text or ""
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Scorecard text or match summary is required.")

    parsed = parse_match_text(raw_text)
    team_a = parsed.innings1_team
    team_b = parsed.innings2_team

    if not team_a and not team_b:
        raise HTTPException(status_code=422, detail="Could not detect cricket teams from input text.")

    # Find pending prediction matching either team
    pending_rows = conn.execute(
        _build_prediction_select().where(predictions.c.outcome == "pending")
    ).all()

    matched_row = None
    for r in pending_rows:
        if (
            (team_a and (_matches_team(r.team_a, team_a) or _matches_team(r.team_b, team_a)))
            or (team_b and (_matches_team(r.team_a, team_b) or _matches_team(r.team_b, team_b)))
        ):
            matched_row = r
            break

    if not matched_row:
        raise HTTPException(
            status_code=404,
            detail=f"No pending prediction found matching teams {team_a or ''} vs {team_b or ''}.",
        )

    # Detect winner from parsed text (e.g. innings with higher runs or summary)
    winner = team_a or team_b
    i1_runs = parsed.innings1_runs or 0
    i2_runs = parsed.innings2_runs or 0
    if i2_runs > i1_runs and team_b:
        winner = team_b
    elif i1_runs > i2_runs and team_a:
        winner = team_a

    res_in = PredictionResultIn(
        actual_winner=winner,
        result_summary=f"{winner} won the match",
    )
    return record_prediction_result(matched_row.id, res_in, conn=conn)


@router.post("/predictions/sync-results", response_model=dict)
def sync_prediction_results(conn=Depends(get_conn)) -> dict:
    """Scans all pending predictions linked to completed fixtures or historical results."""
    pending_preds = conn.execute(
        _build_prediction_select().where(predictions.c.outcome == "pending")
    ).all()

    settled = 0
    now = _now()
    for p in pending_preds:
        if p.fixture_id:
            frow = conn.execute(
                sa.select(fixtures).where(fixtures.c.id == p.fixture_id)
            ).fetchone()
            if frow and frow.status in ("completed", "void"):
                predicted_a = p.prob_team_a >= 0.5
                if frow.status == "void" or not frow.winner:
                    outcome = "void"
                else:
                    actual_a = _matches_team(p.team_a, frow.winner)
                    outcome = "correct" if predicted_a == actual_a else "incorrect"

                conn.execute(
                    predictions.update()
                    .where(predictions.c.id == p.id)
                    .values(
                        actual_winner=frow.winner,
                        outcome=outcome,
                        evaluated_at=now,
                    )
                )
                settled += 1

    conn.commit()
    return {"status": "ok", "settled_count": settled}


@router.patch("/predictions/{pred_id}", response_model=PredictionOut)
def update_prediction(
    pred_id: int,
    body: PredictionPatch,
    conn=Depends(get_conn),
) -> PredictionOut:
    row = conn.execute(sa.select(predictions).where(predictions.c.id == pred_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")

    values: dict = {}
    if body.prob_team_a is not None:
        values["prob_team_a"] = body.prob_team_a
    if body.reasons is not None:
        values["reasons_json"] = json.dumps(body.reasons)
    if body.actual_winner is not None:
        values["actual_winner"] = body.actual_winner
    if body.result_summary is not None:
        values["result_summary"] = body.result_summary
    if body.outcome is not None:
        values["outcome"] = body.outcome
        if body.outcome in ("correct", "incorrect", "void") and not row.evaluated_at:
            values["evaluated_at"] = _now()

    if values:
        conn.execute(predictions.update().where(predictions.c.id == pred_id).values(**values))
        conn.commit()

    updated = conn.execute(_build_prediction_select().where(predictions.c.id == pred_id)).one()
    return _row_to_prediction_out(updated)


@router.delete("/predictions/{pred_id}", status_code=204)
def delete_prediction(pred_id: int, conn=Depends(get_conn)) -> Response:
    row = conn.execute(sa.select(predictions).where(predictions.c.id == pred_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Prediction not found")

    conn.execute(predictions.delete().where(predictions.c.id == pred_id))
    conn.commit()
    return Response(status_code=204)


# ── Today's Matches ────────────────────────────────────────────────────────────


# ── Run Model ─────────────────────────────────────────────────────────────────


@router.post("/predictions/run-model", response_model=RunModelOut)
def run_model(conn=Depends(get_conn)) -> RunModelOut:
    """Trigger the LightGBM prediction pipeline for today's fixtures.

    Imports bot.run machinery, builds features from team_matches history,
    runs the model, and stores predictions. Idempotent — skips fixtures
    that already have a prediction.
    """
    from pathlib import Path
    import json as _json
    from datetime import datetime, timezone as _tz

    errors: list[str] = []

    # Load model artifact
    artifact_path = Path(__file__).resolve().parent.parent.parent / "bot" / "artifacts" / "model.pkl"
    if not artifact_path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Model artifact not found at {artifact_path}. Run 'python -m bot.train' first."
        )

    try:
        from bot.predict import load_artifact, predict
        from bot.features import build_features
        from bot.run import _load_team_matches, _home_team_at_venue
        artifact = load_artifact(artifact_path)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to load model: {exc}") from exc

    # Find upcoming fixtures without a prediction yet
    now = datetime.now(_tz.utc)
    upcoming = conn.execute(
        sa.select(fixtures).where(
            fixtures.c.status == "upcoming",
            fixtures.c.start_time > now,
        ).order_by(fixtures.c.start_time)
    ).all()

    df = _load_team_matches(conn)
    created = 0
    skipped = 0

    for f in upcoming:
        existing = conn.execute(
            sa.select(predictions.c.id).where(predictions.c.fixture_id == f.id)
        ).first()
        if existing:
            skipped += 1
            continue

        try:
            home_team = _home_team_at_venue(df, f.venue, f.team_a, f.team_b)
            feats = build_features(df, f.team_a, f.team_b, f.venue, now.date(), home_team=home_team)
            prob, reasons = predict(artifact, feats)
        except Exception as exc:
            errors.append(f"Feature/predict error for {f.team_a} vs {f.team_b}: {exc}")
            skipped += 1
            continue

        conn.execute(
            predictions.insert().values(
                fixture_id=f.id,
                team_a=f.team_a,
                team_b=f.team_b,
                league=f.league,
                venue=f.venue,
                prob_team_a=prob,
                reasons_json=_json.dumps(reasons),
                features_json=_json.dumps(feats),
                created_at=now,
                outcome="pending",
            )
        )
        created += 1

    conn.commit()
    return RunModelOut(
        status="ok",
        predictions_created=created,
        predictions_skipped=skipped,
        fixtures_found=len(upcoming),
        errors=errors,
    )


# ── Settle from API ───────────────────────────────────────────────────────────


@router.post("/predictions/settle-from-api", response_model=SettleFromApiOut)
def settle_from_api(conn=Depends(get_conn)) -> SettleFromApiOut:
    """Call CricAPI for completed match results and auto-settle pending predictions.

    This is what the GitHub Actions evening cron calls. Requires CRICKET_API_KEY
    to be set in the environment. Gracefully errors if the key is absent.
    """
    import os
    from datetime import datetime, timezone as _tz

    api_key = os.getenv("CRICKET_API_KEY", "")
    api_base = os.getenv("CRICKET_API_BASE", "https://api.cricapi.com/v1")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="CRICKET_API_KEY environment variable is not set. Cannot auto-settle via API."
        )

    errors: list[str] = []
    now = datetime.now(_tz.utc)

    try:
        from bot.fixtures_provider import CricApiProvider
        provider = CricApiProvider(api_base, api_key)
        _fixture_list, result_list = provider.fetch(conn)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"CricAPI fetch failed: {exc}") from exc

    settled = 0
    voided = 0

    for res in result_list:
        frow = conn.execute(
            sa.select(fixtures).where(fixtures.c.provider_match_id == res.provider_match_id)
        ).first()
        if not frow or frow.status != "upcoming":
            continue

        pred = conn.execute(
            sa.select(predictions).where(predictions.c.fixture_id == frow.id)
        ).first()

        if res.no_result or res.winner is None:
            conn.execute(
                fixtures.update().where(fixtures.c.id == frow.id).values(status="void")
            )
            if pred:
                conn.execute(
                    predictions.update().where(predictions.c.id == pred.id).values(
                        outcome="void", evaluated_at=now
                    )
                )
                voided += 1
            continue

        conn.execute(
            fixtures.update().where(fixtures.c.id == frow.id).values(
                status="completed", winner=res.winner
            )
        )

        if not pred:
            continue

        predicted_a = pred.prob_team_a >= 0.5
        actual_a = _matches_team(frow.team_a, res.winner)
        outcome = "correct" if predicted_a == actual_a else "incorrect"

        conn.execute(
            predictions.update().where(predictions.c.id == pred.id).values(
                actual_winner=res.winner,
                outcome=outcome,
                evaluated_at=now,
            )
        )
        settled += 1

    conn.commit()
    return SettleFromApiOut(
        status="ok",
        settled_count=settled,
        void_count=voided,
        errors=errors,
    )
