# backend/app/api/stats.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_session
from ..models.player import Player, PlayerVsPlayer

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/player-vs-player")
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
    dot_pct = round((pvp.dot_balls / pvp.balls) * 100, 1) if pvp.balls else 0

    return {
        "batsman": player_a,
        "bowler": player_b,
        "stats": [
            {"label": "BALLS FACED", "batsman_val": pvp.balls, "bowler_val": pvp.balls},
            {"label": "DISMISSALS", "batsman_val": pvp.dismissals, "bowler_val": pvp.dismissals},
            {"label": "STRIKE RATE", "batsman_val": sr, "bowler_val": sr},
            {"label": "DOT BALL %", "batsman_val": dot_pct, "bowler_val": dot_pct},
        ],
    }
