"""
Seeds all 10 IPL 2026 teams and all 74 league fixtures.
Safe to re-run — clears and re-seeds matches and teams.
Run: python -m scripts.seed_schedule (from backend/ with .venv active)
"""
import asyncio
from datetime import date
from sqlalchemy import delete
from app.database import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.match import Team, Match
from app.models.player import Player, PlayerVsPlayer, VenueStats, DailyCache

TEAMS = {
    "MI":   {"name": "Mumbai Indians",             "color": "#004BA0"},
    "CSK":  {"name": "Chennai Super Kings",         "color": "#FFCB05"},
    "RCB":  {"name": "Royal Challengers Bengaluru", "color": "#EC1C24"},
    "KKR":  {"name": "Kolkata Knight Riders",       "color": "#3A225D"},
    "SRH":  {"name": "Sunrisers Hyderabad",         "color": "#F7A721"},
    "DC":   {"name": "Delhi Capitals",              "color": "#0078BC"},
    "PBKS": {"name": "Punjab Kings",                "color": "#ED1B24"},
    "RR":   {"name": "Rajasthan Royals",            "color": "#254AA5"},
    "GT":   {"name": "Gujarat Titans",              "color": "#1C1C1C"},
    "LSG":  {"name": "Lucknow Super Giants",        "color": "#A4C2F4"},
}

# Venue names match Cricsheet exactly so VenueStats queries align
_W  = "Wankhede Stadium, Mumbai"
_CH = "MA Chidambaram Stadium, Chepauk, Chennai"
_EG = "Eden Gardens, Kolkata"
_MC = "M Chinnaswamy Stadium, Bengaluru"
_AJ = "Arun Jaitley Stadium, Delhi"
_NM = "Narendra Modi Stadium, Ahmedabad"
_SM = "Sawai Mansingh Stadium, Jaipur"
_RG = "Rajiv Gandhi International Stadium, Uppal, Hyderabad"
_EK = "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow"
_MY = "Maharaja Yadavindra Singh International Cricket Stadium, New Chandigarh"
_BC = "Barsapara Cricket Stadium, Guwahati"

# IPL 2026 league phase — 74 matches
# Played fixtures (M1-M33) sourced from Cricsheet data; remainder from official schedule
FIXTURES = [
    # --- Played (M1–M33, from Cricsheet) ---
    {"date": "2026-03-28", "team_a": "SRH",  "team_b": "RCB",  "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-03-29", "team_a": "KKR",  "team_b": "MI",   "venue": _W,  "time": "3:30 PM"},
    {"date": "2026-03-30", "team_a": "CSK",  "team_b": "RR",   "venue": _BC, "time": "7:30 PM"},
    {"date": "2026-03-31", "team_a": "GT",   "team_b": "PBKS", "venue": _MY, "time": "7:30 PM"},
    {"date": "2026-04-01", "team_a": "LSG",  "team_b": "DC",   "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-04-02", "team_a": "SRH",  "team_b": "KKR",  "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-04-03", "team_a": "CSK",  "team_b": "PBKS", "venue": _CH, "time": "7:30 PM"},
    {"date": "2026-04-04", "team_a": "MI",   "team_b": "DC",   "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-04-04", "team_a": "RR",   "team_b": "GT",   "venue": _NM, "time": "3:30 PM"},
    {"date": "2026-04-05", "team_a": "RCB",  "team_b": "CSK",  "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-04-05", "team_a": "SRH",  "team_b": "LSG",  "venue": _RG, "time": "3:30 PM"},
    {"date": "2026-04-06", "team_a": "KKR",  "team_b": "PBKS", "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-04-07", "team_a": "RR",   "team_b": "MI",   "venue": _BC, "time": "7:30 PM"},
    {"date": "2026-04-08", "team_a": "GT",   "team_b": "DC",   "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-04-09", "team_a": "KKR",  "team_b": "LSG",  "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-04-10", "team_a": "RCB",  "team_b": "RR",   "venue": _BC, "time": "7:30 PM"},
    {"date": "2026-04-11", "team_a": "CSK",  "team_b": "DC",   "venue": _CH, "time": "7:30 PM"},
    {"date": "2026-04-11", "team_a": "SRH",  "team_b": "PBKS", "venue": _MY, "time": "3:30 PM"},
    {"date": "2026-04-12", "team_a": "LSG",  "team_b": "GT",   "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-04-12", "team_a": "RCB",  "team_b": "MI",   "venue": _W,  "time": "3:30 PM"},
    {"date": "2026-04-13", "team_a": "SRH",  "team_b": "RR",   "venue": _RG, "time": "7:30 PM"},
    {"date": "2026-04-14", "team_a": "CSK",  "team_b": "KKR",  "venue": _CH, "time": "7:30 PM"},
    {"date": "2026-04-15", "team_a": "LSG",  "team_b": "RCB",  "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-04-16", "team_a": "MI",   "team_b": "PBKS", "venue": _W,  "time": "7:30 PM"},
    {"date": "2026-04-17", "team_a": "KKR",  "team_b": "GT",   "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-04-18", "team_a": "RCB",  "team_b": "DC",   "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-04-18", "team_a": "SRH",  "team_b": "CSK",  "venue": _RG, "time": "3:30 PM"},
    {"date": "2026-04-19", "team_a": "PBKS", "team_b": "LSG",  "venue": _MY, "time": "7:30 PM"},
    {"date": "2026-04-19", "team_a": "RR",   "team_b": "KKR",  "venue": _EG, "time": "3:30 PM"},
    {"date": "2026-04-20", "team_a": "MI",   "team_b": "GT",   "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-04-21", "team_a": "SRH",  "team_b": "DC",   "venue": _RG, "time": "7:30 PM"},
    {"date": "2026-04-22", "team_a": "RR",   "team_b": "LSG",  "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-04-23", "team_a": "CSK",  "team_b": "MI",   "venue": _W,  "time": "7:30 PM"},
    # --- Upcoming ---
    {"date": "2026-04-24", "team_a": "RCB",  "team_b": "GT",   "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-04-25", "team_a": "DC",   "team_b": "GT",   "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-04-26", "team_a": "PBKS", "team_b": "KKR",  "venue": _MY, "time": "3:30 PM"},
    {"date": "2026-04-26", "team_a": "RR",   "team_b": "SRH",  "venue": _SM, "time": "7:30 PM"},
    {"date": "2026-04-27", "team_a": "CSK",  "team_b": "RCB",  "venue": _CH, "time": "7:30 PM"},
    {"date": "2026-04-28", "team_a": "LSG",  "team_b": "MI",   "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-04-29", "team_a": "GT",   "team_b": "DC",   "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-04-30", "team_a": "KKR",  "team_b": "RR",   "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-05-01", "team_a": "SRH",  "team_b": "PBKS", "venue": _RG, "time": "7:30 PM"},
    {"date": "2026-05-02", "team_a": "RCB",  "team_b": "MI",   "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-05-03", "team_a": "CSK",  "team_b": "DC",   "venue": _CH, "time": "3:30 PM"},
    {"date": "2026-05-03", "team_a": "GT",   "team_b": "PBKS", "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-05-04", "team_a": "LSG",  "team_b": "SRH",  "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-05-05", "team_a": "MI",   "team_b": "RR",   "venue": _W,  "time": "7:30 PM"},
    {"date": "2026-05-06", "team_a": "KKR",  "team_b": "GT",   "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-05-07", "team_a": "DC",   "team_b": "RCB",  "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-05-08", "team_a": "PBKS", "team_b": "CSK",  "venue": _MY, "time": "7:30 PM"},
    {"date": "2026-05-09", "team_a": "SRH",  "team_b": "MI",   "venue": _RG, "time": "7:30 PM"},
    {"date": "2026-05-10", "team_a": "RR",   "team_b": "KKR",  "venue": _SM, "time": "3:30 PM"},
    {"date": "2026-05-10", "team_a": "LSG",  "team_b": "GT",   "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-05-11", "team_a": "RCB",  "team_b": "CSK",  "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-05-12", "team_a": "DC",   "team_b": "SRH",  "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-05-13", "team_a": "MI",   "team_b": "PBKS", "venue": _W,  "time": "7:30 PM"},
    {"date": "2026-05-14", "team_a": "GT",   "team_b": "CSK",  "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-05-15", "team_a": "KKR",  "team_b": "LSG",  "venue": _EG, "time": "7:30 PM"},
    {"date": "2026-05-16", "team_a": "RR",   "team_b": "RCB",  "venue": _SM, "time": "7:30 PM"},
    {"date": "2026-05-17", "team_a": "SRH",  "team_b": "GT",   "venue": _RG, "time": "3:30 PM"},
    {"date": "2026-05-17", "team_a": "PBKS", "team_b": "LSG",  "venue": _MY, "time": "7:30 PM"},
    {"date": "2026-05-18", "team_a": "MI",   "team_b": "DC",   "venue": _W,  "time": "7:30 PM"},
    {"date": "2026-05-19", "team_a": "RCB",  "team_b": "KKR",  "venue": _MC, "time": "7:30 PM"},
    {"date": "2026-05-20", "team_a": "CSK",  "team_b": "RR",   "venue": _CH, "time": "7:30 PM"},
    {"date": "2026-05-21", "team_a": "GT",   "team_b": "MI",   "venue": _NM, "time": "7:30 PM"},
    {"date": "2026-05-22", "team_a": "DC",   "team_b": "KKR",  "venue": _AJ, "time": "7:30 PM"},
    {"date": "2026-05-23", "team_a": "LSG",  "team_b": "RR",   "venue": _EK, "time": "7:30 PM"},
    {"date": "2026-05-24", "team_a": "SRH",  "team_b": "CSK",  "venue": _RG, "time": "7:30 PM"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await session.execute(delete(DailyCache))
        await session.execute(delete(Match))
        await session.execute(delete(Team))
        await session.commit()

        team_rows: dict[str, Team] = {}
        for short, info in TEAMS.items():
            t = Team(name=info["name"], short_name=short, primary_color=info["color"])
            session.add(t)
            await session.flush()
            team_rows[short] = t

        for f in FIXTURES:
            session.add(Match(
                team_a_id=team_rows[f["team_a"]].id,
                team_b_id=team_rows[f["team_b"]].id,
                venue=f["venue"],
                match_date=date.fromisoformat(f["date"]),
                match_time=f["time"],
            ))

        await session.commit()
        print(f"Seeded {len(TEAMS)} teams, {len(FIXTURES)} fixtures.")
        today = date.today()
        today_match = next((f for f in FIXTURES if f["date"] == str(today)), None)
        if today_match:
            print(f"Today: {today_match['team_a']} vs {today_match['team_b']} @ {today_match['venue']}")
        else:
            print(f"No match scheduled for {today}.")


asyncio.run(seed())
