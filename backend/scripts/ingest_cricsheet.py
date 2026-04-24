# backend/scripts/ingest_cricsheet.py
"""
Run: python -m scripts.ingest_cricsheet --dir data/cricsheet/matches
(from backend/ dir with .venv active)
"""
import asyncio
import argparse
from pathlib import Path
from app.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.player import Player, PlayerVsPlayer
from app.data.aggregator import build_pvp, build_venue_stats
from sqlalchemy import select


async def ingest(matches_dir: Path) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    pvp_data = build_pvp(matches_dir)
    venue_data = build_venue_stats(matches_dir)
    print(f"Parsed {len(pvp_data)} player-vs-player combinations")
    print(f"Parsed {len(venue_data)} venue-team combinations")

    async with AsyncSessionLocal() as session:
        player_cache: dict[str, int] = {}
        for batsman, bowler in pvp_data:
            for name in [batsman, bowler]:
                if name not in player_cache:
                    p = await session.scalar(select(Player).where(Player.name == name))
                    if not p:
                        p = Player(name=name, team_id=1)  # team resolved via separate team mapping
                        session.add(p)
                        await session.flush()
                    player_cache[name] = p.id

        for (batsman, bowler), s in pvp_data.items():
            bid = player_cache.get(batsman)
            bowl_id = player_cache.get(bowler)
            if not bid or not bowl_id:
                continue
            existing = await session.scalar(
                select(PlayerVsPlayer).where(
                    PlayerVsPlayer.batsman_id == bid,
                    PlayerVsPlayer.bowler_id == bowl_id,
                )
            )
            if existing:
                existing.balls = s["balls"]
                existing.runs = s["runs"]
                existing.dismissals = s["dismissals"]
                existing.dot_balls = s["dots"]
            else:
                session.add(
                    PlayerVsPlayer(
                        batsman_id=bid,
                        bowler_id=bowl_id,
                        balls=s["balls"],
                        runs=s["runs"],
                        dismissals=s["dismissals"],
                        dot_balls=s["dots"],
                    )
                )

        await session.commit()
        print("Ingest complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    args = parser.parse_args()
    asyncio.run(ingest(Path(args.dir)))
