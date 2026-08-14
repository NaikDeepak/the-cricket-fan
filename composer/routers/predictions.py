import json

import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import fixtures, predictions

from ..deps import get_conn
from ..schemas import PredictionOut

router = APIRouter()


@router.get("/predictions", response_model=list[PredictionOut])
def list_predictions(
    outcome: str | None = None,
    limit: int = 50,
    conn=Depends(get_conn),
) -> list[PredictionOut]:
    q = (
        sa.select(
            predictions.c.id,
            predictions.c.fixture_id,
            fixtures.c.team_a,
            fixtures.c.team_b,
            fixtures.c.venue,
            fixtures.c.league,
            fixtures.c.start_time,
            predictions.c.prob_team_a,
            predictions.c.reasons_json,
            predictions.c.outcome,
            predictions.c.created_at,
        )
        .select_from(
            predictions.join(fixtures, predictions.c.fixture_id == fixtures.c.id)
        )
        .order_by(predictions.c.created_at.desc())
        .limit(limit)
    )
    if outcome:
        q = q.where(predictions.c.outcome == outcome)
    return [
        PredictionOut(
            id=r.id,
            fixture_id=r.fixture_id,
            team_a=r.team_a,
            team_b=r.team_b,
            venue=r.venue,
            league=r.league,
            start_time=r.start_time,
            prob_team_a=r.prob_team_a,
            reasons=json.loads(r.reasons_json),
            outcome=r.outcome,
            created_at=r.created_at,
        )
        for r in conn.execute(q).all()
    ]
