from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from ..database import get_session
from ..models.match import Match, Team
from ..models.player import PlayerVsPlayer, Player, VenueStats, DailyCache
from ..services.story_service import generate_story

router = APIRouter(prefix="/match-story", tags=["story"])


async def _top_battle(team_a_id: int, team_b_id: int, session: AsyncSession):
    """Return the PlayerVsPlayer record with most balls between the two squads."""
    a_ids = (await session.execute(
        select(Player.id).where(Player.team_id == team_a_id)
    )).scalars().all()
    b_ids = (await session.execute(
        select(Player.id).where(Player.team_id == team_b_id)
    )).scalars().all()

    if not a_ids or not b_ids:
        return None, None, None

    pvp = await session.scalar(
        select(PlayerVsPlayer)
        .where(
            or_(
                and_(PlayerVsPlayer.batsman_id.in_(a_ids), PlayerVsPlayer.bowler_id.in_(b_ids)),
                and_(PlayerVsPlayer.batsman_id.in_(b_ids), PlayerVsPlayer.bowler_id.in_(a_ids)),
            )
        )
        .order_by(PlayerVsPlayer.balls.desc())
        .limit(1)
    )
    if not pvp:
        return None, None, None

    batsman = await session.get(Player, pvp.batsman_id)
    bowler = await session.get(Player, pvp.bowler_id)
    return pvp, batsman, bowler


async def _get_story_for_date(target_date: date_type, session: AsyncSession) -> dict:
    cache_key = f"story_{target_date}"
    cached = await session.scalar(select(DailyCache).where(DailyCache.cache_key == cache_key))
    if cached and "featured_batsman" in cached.data:
        return cached.data

    match = await session.scalar(select(Match).where(Match.match_date == target_date))
    if not match:
        raise HTTPException(status_code=404, detail="No match on this date")

    team_a = await session.get(Team, match.team_a_id)
    team_b = await session.get(Team, match.team_b_id)
    if not team_a or not team_b:
        raise HTTPException(status_code=500, detail="Match team data missing")

    team_a_venue = await session.scalar(
        select(VenueStats).where(
            VenueStats.venue == match.venue, VenueStats.team_id == match.team_a_id
        )
    )
    team_a_chase_pct = (
        round((team_a_venue.chase_wins / team_a_venue.chase_attempts) * 100)
        if (team_a_venue and team_a_venue.chase_attempts) else 0
    )

    pvp, batsman, bowler = await _top_battle(match.team_a_id, match.team_b_id, session)

    stats = {
        "team_a": {"name": team_a.name, "short_name": team_a.short_name, "color": team_a.primary_color},
        "team_b": {"name": team_b.name, "short_name": team_b.short_name, "color": team_b.primary_color},
        "venue": match.venue,
        "match_time": match.match_time,
        "shock_stat_value": pvp.dismissals if pvp else 0,
        "shock_stat_label": (
            f"{bowler.name} DISMISSALS VS {batsman.name} (L2 SEASONS)"
            if (batsman and bowler) else "KEY BATTLE STAT"
        ),
        "team_a_chase_pct": team_a_chase_pct,
        "featured_dismissals": pvp.dismissals if pvp else 0,
        "featured_batsman": batsman.name if batsman else "",
        "featured_bowler": bowler.name if bowler else "",
    }

    generated = await generate_story(stats)

    batsman_team = team_a.short_name if (batsman and batsman.team_id == team_a.id) else team_b.short_name
    bowler_team = team_b.short_name if batsman_team == team_a.short_name else team_a.short_name

    response_data = {
        "headline": generated["headline"],
        "shock_stat": generated["shock_stat"],
        "team_a": stats["team_a"],
        "team_b": stats["team_b"],
        "venue": match.venue,
        "match_time": match.match_time,
        "stats_row": [
            {
                "value": str(generated["shock_stat"]["value"]),
                "label": generated["shock_stat"]["label"],
                "color": "team_a",
            },
            {
                "value": f"{team_a_chase_pct}%",
                "label": f"{team_a.short_name} WIN % {match.venue.split(',')[0].upper()}",
                "color": "muted",
            },
            {
                "value": str(pvp.dismissals if pvp else 0),
                "label": (
                    f"{bowler.name} DISMISSALS VS {batsman.name}"
                    if (batsman and bowler) else "KEY DISMISSALS"
                ),
                "color": "team_b",
            },
        ],
        "scroll_bait": (
            f"{batsman.name} vs {bowler.name} — THE KEY BATTLE"
            if (batsman and bowler) else "THE KEY BATTLE"
        ),
        "featured_batsman": batsman.name if batsman else "",
        "featured_bowler": bowler.name if bowler else "",
    }

    session.add(DailyCache(cache_key=cache_key, data=response_data))
    await session.commit()
    return response_data


@router.get("/today")
async def get_today_story(session: AsyncSession = Depends(get_session)):
    return await _get_story_for_date(date_type.today(), session)


@router.get("/{match_date}")
async def get_story_for_date(match_date: str, session: AsyncSession = Depends(get_session)):
    try:
        target = date_type.fromisoformat(match_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")
    if target > date_type.today():
        raise HTTPException(status_code=400, detail="Cannot request future dates")
    return await _get_story_for_date(target, session)
