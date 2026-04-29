# backend/app/api/stats.py
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.player import Player, PlayerVsPlayer
from ..models.match import Team

router = APIRouter(prefix="/stats", tags=["stats"])


class StatRow(BaseModel):
    label: str
    batsman_val: float
    bowler_val: float


class PlayerVsPlayerResponse(BaseModel):
    batsman: str
    bowler: str
    stats: list[StatRow]


class PlayerResult(BaseModel):
    id: int
    name: str
    team: str


@router.get("/players", response_model=list[PlayerResult])
async def get_players(
    q: str = Query("", description="Name substring, min 2 chars"),
    session: AsyncSession = Depends(get_session),
):
    if len(q) < 2:
        return []
    result = await session.execute(
        select(Player).where(Player.name.ilike(f"%{q}%")).limit(10)
    )
    players = result.scalars().all()
    out = []
    for p in players:
        team = await session.get(Team, p.team_id)
        out.append({"id": p.id, "name": p.name, "team": team.short_name if team else ""})
    return out


@router.get("/player-vs-player", response_model=PlayerVsPlayerResponse)
async def get_pvp(
    player_a: str = Query(..., description="Batsman name"),
    player_b: str = Query(..., description="Bowler name"),
    session: AsyncSession = Depends(get_session),
):
    batsman = await session.scalar(select(Player).where(Player.name == player_a))
    bowler = await session.scalar(select(Player).where(Player.name == player_b))

    if not batsman or not bowler:
        raise HTTPException(status_code=404, detail="Player not found")

    pvp = await session.scalar(
        select(PlayerVsPlayer).where(
            PlayerVsPlayer.batsman_id == batsman.id,
            PlayerVsPlayer.bowler_id == bowler.id,
        )
    )
    if not pvp:
        raise HTTPException(status_code=404, detail="No head-to-head data")

    sr = round((pvp.runs / pvp.balls) * 100, 1) if pvp.balls else 0
    economy = round((pvp.runs / pvp.balls) * 6, 1) if pvp.balls else 0
    dot_pct = round((pvp.dot_balls / pvp.balls) * 100, 1) if pvp.balls else 0

    return {
        "batsman": player_a,
        "bowler": player_b,
        "stats": [
            {"label": "BALLS FACED", "batsman_val": pvp.balls, "bowler_val": pvp.balls},
            {"label": "DISMISSALS", "batsman_val": pvp.dismissals, "bowler_val": pvp.dismissals},
            {"label": "STRIKE RATE / ECONOMY", "batsman_val": sr, "bowler_val": economy},
            {"label": "DOT BALL %", "batsman_val": dot_pct, "bowler_val": dot_pct},
        ],
    }
