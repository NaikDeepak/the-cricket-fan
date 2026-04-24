from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import VenueStats, DailyCache
from ..services.prediction_service import calculate_prediction

router = APIRouter(prefix="/prediction", tags=["prediction"])


async def _get_prediction_for_date(target_date: date_type, session: AsyncSession) -> dict:
    cache_key = f"prediction_{target_date}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == target_date))
    if not match:
        raise HTTPException(status_code=404, detail="No match on this date")
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    mi_v = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id)
    )
    csk_v = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_b_id)
    )

    stats = {
        "team_a_short": team_a.short_name,
        "team_b_short": team_b.short_name,
        "venue": match.venue,
        "mi_chase_win_pct": round((mi_v.chase_wins / mi_v.chase_attempts) * 100) if (mi_v and mi_v.chase_attempts) else 50,
        "csk_chase_win_pct": round((csk_v.chase_wins / csk_v.chase_attempts) * 100) if (csk_v and csk_v.chase_attempts) else 50,
        "mi_death_economy": 7.2,
        "csk_death_economy": 8.9,
        "csk_vs_spin_avg": 18,
        "mi_vs_spin_avg": 34,
    }

    result = calculate_prediction(stats)
    result["team_color"] = team_a.primary_color if result["team"] == team_a.short_name else team_b.primary_color

    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result


@router.get("/today")
async def get_today_prediction(session: AsyncSession = Depends(get_session)):
    return await _get_prediction_for_date(date_type.today(), session)


@router.get("/{match_date}")
async def get_prediction_for_date(match_date: str, session: AsyncSession = Depends(get_session)):
    try:
        target = date_type.fromisoformat(match_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    if target > date_type.today():
        raise HTTPException(status_code=400, detail="Cannot request future dates")
    return await _get_prediction_for_date(target, session)
