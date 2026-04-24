# backend/scripts/ingest_cricsheet.py
"""
Parses all IPL JSON files from backend/data/cricsheet/ and writes to DB.

Strategy:
  Player-vs-player : IPL 2025 + 2026 (recent form, enough data)
  Venue stats      : All IPL history 2008-present (large sample = reliable %)
  Players          : Seeded from 2026 squads with current team assignment

Run after seed_schedule.py (teams must already exist):
  python -m scripts.seed_schedule
  python -m scripts.ingest_cricsheet
"""

import asyncio
import json
import glob
from collections import defaultdict
from pathlib import Path

from sqlalchemy import delete, select

from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team
from app.models.player import Player, PlayerVsPlayer, VenueStats

DATA_DIR = Path(__file__).parent.parent / "data" / "cricsheet"

PVP_FROM_YEAR = 2025   # player-vs-player: last 2 seasons

# Cricsheet full team name → our short name
TEAM_SHORT: dict[str, str] = {
    "Mumbai Indians": "MI",
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Sunrisers Hyderabad": "SRH",
    "Delhi Capitals": "DC",
    "Delhi Daredevils": "DC",
    "Punjab Kings": "PBKS",
    "Kings XI Punjab": "PBKS",
    "Rajasthan Royals": "RR",
    "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
}


# ---------------------------------------------------------------------------
# Pure-Python data extraction (no DB, no async)
# ---------------------------------------------------------------------------

def _is_ipl(info: dict) -> bool:
    return "Indian Premier League" in info.get("event", {}).get("name", "")


def _year(info: dict) -> int:
    dates = info.get("dates", [])
    return int(dates[0][:4]) if dates else 0


def parse_all() -> tuple[dict[str, str], dict[tuple, dict], dict[tuple, dict]]:
    """
    Returns:
      players_2026  : {abbrev_name: team_short}  — players seen in 2026 matches
      pvp           : {(batsman, bowler): {balls, runs, dismissals, dot_balls}}
      venue_data    : {(venue, team_short): {matches, wins, chase_wins, chase_attempts,
                                              total_score, innings_count}}
    """
    players_2026: dict[str, str] = {}
    pvp: dict[tuple, dict] = defaultdict(
        lambda: {"balls": 0, "runs": 0, "dismissals": 0, "dot_balls": 0}
    )
    venue_data: dict[tuple, dict] = defaultdict(
        lambda: {"matches": 0, "wins": 0, "chase_wins": 0, "chase_attempts": 0,
                 "total_score": 0, "innings_count": 0}
    )

    files = sorted(glob.glob(str(DATA_DIR / "*.json")))
    processed = skipped = 0

    for filepath in files:
        try:
            with open(filepath) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            skipped += 1
            continue

        info = data.get("info", {})
        if not _is_ipl(info):
            continue

        year = _year(info)
        match_venue = info.get("venue", "")
        teams = info.get("teams", [])
        winner = info.get("outcome", {}).get("winner", "")

        team_shorts = {t: TEAM_SHORT[t] for t in teams if t in TEAM_SHORT}

        # ── 2026 squad snapshot ───────────────────────────────────────────
        if year == 2026:
            for team_full, plist in info.get("players", {}).items():
                short = TEAM_SHORT.get(team_full)
                if short:
                    for p in plist:
                        players_2026[p] = short

        # ── Venue stats (all history) ─────────────────────────────────────
        innings_list = data.get("innings", [])
        batting_order: list[str] = []
        team_scores: dict[str, int] = {}

        for innings in innings_list:
            batting_team = innings.get("team", "")
            score = sum(
                d.get("runs", {}).get("total", 0)
                for ov in innings.get("overs", [])
                for d in ov.get("deliveries", [])
            )
            team_scores[batting_team] = score
            batting_order.append(batting_team)

        for team_full, short in team_shorts.items():
            key = (match_venue, short)
            venue_data[key]["matches"] += 1
            if winner == team_full:
                venue_data[key]["wins"] += 1
            # chasing = batted second in first innings
            if len(batting_order) >= 2 and batting_order[1] == team_full:
                venue_data[key]["chase_attempts"] += 1
                if winner == team_full:
                    venue_data[key]["chase_wins"] += 1
            score = team_scores.get(team_full, 0)
            if score > 0:
                venue_data[key]["total_score"] += score
                venue_data[key]["innings_count"] += 1

        # ── Player-vs-player (2025+) ──────────────────────────────────────
        if year >= PVP_FROM_YEAR:
            for innings in innings_list:
                for ov in innings.get("overs", []):
                    for d in ov.get("deliveries", []):
                        batsman = d.get("batter", "")
                        bowler = d.get("bowler", "")
                        if not batsman or not bowler:
                            continue
                        runs = d.get("runs", {}).get("batter", 0)
                        is_wicket = bool(d.get("wickets"))
                        key = (batsman, bowler)
                        pvp[key]["balls"] += 1
                        pvp[key]["runs"] += runs
                        if is_wicket:
                            pvp[key]["dismissals"] += 1
                        if runs == 0 and not d.get("extras"):
                            pvp[key]["dot_balls"] += 1

        processed += 1

    print(f"  Parsed {processed} IPL matches ({skipped} skipped)")
    return players_2026, dict(pvp), dict(venue_data)


# ---------------------------------------------------------------------------
# DB writes
# ---------------------------------------------------------------------------

async def ingest() -> None:
    print("Step 1/4  Parsing Cricsheet data…")
    players_2026, pvp, venue_data = parse_all()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Team))
        teams_by_short = {t.short_name: t for t in result.scalars().all()}

        # ── Clear old player / pvp / venue data ──────────────────────────
        print("Step 2/4  Clearing old player/stats data…")
        await session.execute(delete(PlayerVsPlayer))
        await session.execute(delete(VenueStats))
        await session.execute(delete(Player))
        await session.commit()

        # ── Insert 2026 players ───────────────────────────────────────────
        print("Step 3/4  Inserting players and PvP stats…")
        player_rows: dict[str, Player] = {}
        for abbrev, short in players_2026.items():
            team = teams_by_short.get(short)
            if not team:
                continue
            p = Player(name=abbrev, team_id=team.id)
            session.add(p)
            player_rows[abbrev] = p
        await session.flush()
        print(f"  {len(player_rows)} players inserted")

        # ── Insert PvP stats ─────────────────────────────────────────────
        pvp_count = 0
        for (batsman, bowler), stats in pvp.items():
            bat = player_rows.get(batsman)
            bowl = player_rows.get(bowler)
            if not bat or not bowl:
                continue
            if stats["balls"] < 6:   # skip micro-matchups
                continue
            session.add(PlayerVsPlayer(
                batsman_id=bat.id,
                bowler_id=bowl.id,
                balls=stats["balls"],
                runs=stats["runs"],
                dismissals=stats["dismissals"],
                dot_balls=stats["dot_balls"],
            ))
            pvp_count += 1
        print(f"  {pvp_count} player-vs-player records inserted")

        # ── Insert venue stats ───────────────────────────────────────────
        print("Step 4/4  Inserting venue stats…")
        venue_count = 0
        for (venue_name, short), stats in venue_data.items():
            team = teams_by_short.get(short)
            if not team or stats["matches"] == 0:
                continue
            avg = (
                round(stats["total_score"] / stats["innings_count"], 1)
                if stats["innings_count"] > 0 else 0.0
            )
            session.add(VenueStats(
                venue=venue_name,
                team_id=team.id,
                matches=stats["matches"],
                wins=stats["wins"],
                chase_wins=stats["chase_wins"],
                chase_attempts=stats["chase_attempts"],
                avg_score=avg,
            ))
            venue_count += 1
        print(f"  {venue_count} venue-team stat records inserted")

        await session.commit()
        print("Ingest complete.")


if __name__ == "__main__":
    asyncio.run(ingest())
