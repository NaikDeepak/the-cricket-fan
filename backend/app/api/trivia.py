from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from ..database import get_session
from ..models.match import Match, Team
from ..models.player import DailyCache
from ..services.trivia_service import generate_trivia

router = APIRouter(prefix="/trivia", tags=["trivia"])

@router.get("/today")
async def get_today_trivia(session: AsyncSession = Depends(get_session)):
    cache_key = f"trivia_{date.today()}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.is_today == True))
    if not match:
        raise HTTPException(status_code=404, detail="No match today")
    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    result = await generate_trivia(match.venue, team_a.short_name, team_b.short_name)

    session.add(DailyCache(cache_key=cache_key, data=result))
    await session.commit()
    return result
