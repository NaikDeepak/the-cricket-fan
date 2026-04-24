from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from ..database import get_session
from ..models.match import Match, Team
from ..models.player import PlayerVsPlayer, Player, VenueStats, DailyCache
from ..services.story_service import generate_story

router = APIRouter(prefix="/match-story", tags=["story"])

@router.get("/today")
async def get_today_story(session: AsyncSession = Depends(get_session)):
    cache_key = f"story_{date.today()}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == date.today()))
    if not match:
        raise HTTPException(status_code=404, detail="No match today")

    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    mi_venue = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id)
    )
    csk_venue = await session.scalar(
        select(VenueStats).where(VenueStats.venue == match.venue, VenueStats.team_id == match.team_b_id)
    )

    mi_chase_pct = round((mi_venue.chase_wins / mi_venue.chase_attempts) * 100) if (mi_venue and mi_venue.chase_attempts) else 0

    # TODO Task 14: derive featured players dynamically from today's match key battle
    rohit = await session.scalar(select(Player).where(Player.name == "Rohit Sharma"))
    jadeja = await session.scalar(select(Player).where(Player.name == "Ravindra Jadeja"))
    pvp = None
    if rohit and jadeja:
        pvp = await session.scalar(
            select(PlayerVsPlayer).where(
                PlayerVsPlayer.batsman_id == rohit.id,
                PlayerVsPlayer.bowler_id == jadeja.id,
            )
        )

    stats = {
        "team_a": {"name": team_a.name, "short_name": team_a.short_name, "color": team_a.primary_color},
        "team_b": {"name": team_b.name, "short_name": team_b.short_name, "color": team_b.primary_color},
        "venue": match.venue,
        "match_time": match.match_time,
        "shock_stat_value": 0,  # TODO Task 14: compute from real Cricsheet data
        "shock_stat_label": "ROHIT 50+ VS CSK (L10)",  # TODO Task 14: derive from featured battle
        "mi_win_pct": mi_chase_pct,
        "jadeja_dismissals": pvp.dismissals if pvp else 0,
    }

    generated = await generate_story(stats)

    response_data = {
        "headline": generated["headline"],
        "shock_stat": generated["shock_stat"],
        "team_a": stats["team_a"],
        "team_b": stats["team_b"],
        "venue": match.venue,
        "match_time": match.match_time,
        "stats_row": [
            {"value": str(generated["shock_stat"]["value"]), "label": generated["shock_stat"]["label"], "color": "team_a"},
            {"value": f"{mi_chase_pct}%", "label": "MI WIN % WANKHEDE", "color": "muted"},  # TODO Task 14
            {"value": str(pvp.dismissals if pvp else 0), "label": "JADEJA DISMISSALS VS ROHIT", "color": "team_b"},  # TODO Task 14
        ],
        "scroll_bait": "ROHIT vs JADEJA — THE KEY BATTLE",  # TODO Task 14: derive from key battle query
    }

    session.add(DailyCache(cache_key=cache_key, data=response_data))
    await session.commit()
    return response_data
