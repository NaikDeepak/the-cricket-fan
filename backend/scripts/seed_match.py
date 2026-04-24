# backend/scripts/seed_match.py
"""
Seeds one MI vs CSK match at Wankhede with known head-to-head stats.
Run: python -m scripts.seed_match (from backend/ dir with .venv active)
"""
import asyncio
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team, Match
from app.models.player import Player, PlayerVsPlayer, VenueStats
from datetime import date
from sqlalchemy import delete

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Clear existing seed data
        for model in [PlayerVsPlayer, VenueStats, Player, Match, Team]:
            await session.execute(delete(model))
        await session.commit()

        # Teams
        mi = Team(name="Mumbai Indians", short_name="MI", primary_color="#004BA0")
        csk = Team(name="Chennai Super Kings", short_name="CSK", primary_color="#FFCB05")
        session.add_all([mi, csk])
        await session.flush()

        # Today's match
        today_match = Match(
            team_a_id=mi.id,
            team_b_id=csk.id,
            venue="Wankhede Stadium",
            match_date=date.today(),
            match_time="7:30 PM",
        )
        session.add(today_match)
        await session.flush()

        # Players
        rohit = Player(name="Rohit Sharma", team_id=mi.id)
        jadeja = Player(name="Ravindra Jadeja", team_id=csk.id)
        session.add_all([rohit, jadeja])
        await session.flush()

        # Rohit vs Jadeja head-to-head (real IPL historical stats)
        pvp = PlayerVsPlayer(
            batsman_id=rohit.id,
            bowler_id=jadeja.id,
            balls=147,
            runs=89,
            dismissals=5,
            dot_balls=54,
        )
        session.add(pvp)

        # Venue stats — MI at Wankhede
        mi_wankhede = VenueStats(
            venue="Wankhede Stadium",
            team_id=mi.id,
            matches=18,
            wins=14,
            chase_wins=8,
            chase_attempts=10,
            avg_score=182.0,
        )
        # Venue stats — CSK at Wankhede
        csk_wankhede = VenueStats(
            venue="Wankhede Stadium",
            team_id=csk.id,
            matches=16,
            wins=7,
            chase_wins=3,
            chase_attempts=8,
            avg_score=168.0,
        )
        session.add_all([mi_wankhede, csk_wankhede])
        await session.commit()
        print("Seed complete.")
        print(f"  MI id={mi.id}, CSK id={csk.id}")
        print(f"  Rohit id={rohit.id}, Jadeja id={jadeja.id}")
        print(f"  Match id={today_match.id}")

asyncio.run(seed())
