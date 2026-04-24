# backend/scripts/seed_match.py
"""
Seeds Rohit vs Jadeja player stats and venue stats for Wankhede.
Run AFTER seed_schedule.py.
Run: python -m scripts.seed_match (from backend/ with .venv active)
"""
import asyncio
from sqlalchemy import delete, select
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team
from app.models.player import Player, PlayerVsPlayer, VenueStats


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for model in [PlayerVsPlayer, VenueStats, Player]:
            await session.execute(delete(model))
        await session.commit()

        mi = await session.scalar(select(Team).where(Team.short_name == "MI"))
        csk = await session.scalar(select(Team).where(Team.short_name == "CSK"))
        if not mi or not csk:
            print("ERROR: Run seed_schedule.py first.")
            return

        rohit = Player(name="Rohit Sharma", team_id=mi.id)
        jadeja = Player(name="Ravindra Jadeja", team_id=csk.id)
        session.add_all([rohit, jadeja])
        await session.flush()

        session.add(PlayerVsPlayer(
            batsman_id=rohit.id, bowler_id=jadeja.id,
            balls=147, runs=89, dismissals=5, dot_balls=54,
        ))
        session.add_all([
            VenueStats(venue="Wankhede Stadium, Mumbai", team_id=mi.id,
                       matches=18, wins=14, chase_wins=8, chase_attempts=10, avg_score=182.0),
            VenueStats(venue="Wankhede Stadium, Mumbai", team_id=csk.id,
                       matches=16, wins=7, chase_wins=3, chase_attempts=8, avg_score=168.0),
        ])
        await session.commit()
        print("Player/venue stats seeded.")


asyncio.run(seed())
