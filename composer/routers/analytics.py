import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import content_events, drafts
from bot.run import _season_record

from ..deps import get_conn
from ..schemas import AnalyticsOut, CategoryCount

router = APIRouter()

_ACTIONS = ("generated", "copied", "posted")


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(conn=Depends(get_conn)) -> AnalyticsOut:
    funnel: dict[str, int] = {}
    totals: dict[str, int] = {}
    for action in _ACTIONS:
        funnel[action] = conn.execute(
            sa.select(sa.func.count(sa.distinct(content_events.c.draft_id))).where(
                content_events.c.action == action
            )
        ).scalar_one()
        totals[action] = conn.execute(
            sa.select(sa.func.count())
            .select_from(content_events)
            .where(content_events.c.action == action)
        ).scalar_one()
    cats = conn.execute(
        sa.select(drafts.c.category, sa.func.count())
        .group_by(drafts.c.category)
        .order_by(sa.func.count().desc())
    ).all()
    correct, total = _season_record(conn)
    return AnalyticsOut(
        funnel=funnel,
        event_totals=totals,
        by_category=[CategoryCount(category=c, drafts=n) for c, n in cats],
        prediction_record={"correct": correct, "total": total},
    )
