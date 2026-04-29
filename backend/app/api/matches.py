from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import DailyCache

router = APIRouter(prefix="/matches", tags=["matches"])


class TeamSummary(BaseModel):
    short_name: str
    name: str
    primary_color: str


class MatchSummary(BaseModel):
    date: str
    team_a: TeamSummary
    team_b: TeamSummary
    venue: str
    match_time: str
    has_story: bool
    headline: str | None


@router.get("", response_model=list[MatchSummary])
async def list_matches(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Match)
        .where(Match.match_date <= date.today())
        .order_by(Match.match_date.desc())
    )
    matches = result.scalars().all()

    output = []
    for m in matches:
        team_a = await session.get(Team, m.team_a_id)
        team_b = await session.get(Team, m.team_b_id)
        cache_key = f"story_{m.match_date}"
        cached = await session.scalar(
            select(DailyCache).where(DailyCache.cache_key == cache_key)
        )
        has_story = cached is not None
        headline = (
            cached.data.get("headline")
            if (cached and isinstance(cached.data, dict))
            else None
        )
        output.append(
            MatchSummary(
                date=str(m.match_date),
                team_a=TeamSummary(
                    short_name=team_a.short_name,
                    name=team_a.name,
                    primary_color=team_a.primary_color,
                ),
                team_b=TeamSummary(
                    short_name=team_b.short_name,
                    name=team_b.name,
                    primary_color=team_b.primary_color,
                ),
                venue=m.venue,
                match_time=m.match_time,
                has_story=has_story,
                headline=headline,
            )
        )
    return output
