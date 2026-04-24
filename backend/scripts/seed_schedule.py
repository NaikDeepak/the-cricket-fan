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

# IPL 2026 league phase — 74 matches
# Verify against https://www.iplt20.com/matches/schedule
FIXTURES = [
    {"date": "2026-03-22", "team_a": "KKR",  "team_b": "RCB",  "venue": "Eden Gardens, Kolkata",         "time": "7:30 PM"},
    {"date": "2026-03-23", "team_a": "DC",   "team_b": "LSG",  "venue": "Arun Jaitley Stadium, Delhi",   "time": "3:30 PM"},
    {"date": "2026-03-23", "team_a": "RR",   "team_b": "MI",   "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-03-24", "team_a": "CSK",  "team_b": "PBKS", "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-03-25", "team_a": "GT",   "team_b": "SRH",  "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-03-26", "team_a": "LSG",  "team_b": "KKR",  "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-03-27", "team_a": "RCB",  "team_b": "DC",   "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-03-28", "team_a": "MI",   "team_b": "CSK",  "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-03-29", "team_a": "SRH",  "team_b": "RR",   "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "3:30 PM"},
    {"date": "2026-03-29", "team_a": "PBKS", "team_b": "GT",   "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "7:30 PM"},
    {"date": "2026-03-30", "team_a": "KKR",  "team_b": "DC",   "venue": "Eden Gardens, Kolkata",         "time": "7:30 PM"},
    {"date": "2026-03-31", "team_a": "CSK",  "team_b": "LSG",  "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-04-01", "team_a": "MI",   "team_b": "SRH",  "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-04-02", "team_a": "RR",   "team_b": "GT",   "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-04-03", "team_a": "RCB",  "team_b": "PBKS", "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-04-04", "team_a": "DC",   "team_b": "MI",   "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-04-05", "team_a": "GT",   "team_b": "KKR",  "venue": "Narendra Modi Stadium, Ahmedabad","time": "3:30 PM"},
    {"date": "2026-04-05", "team_a": "CSK",  "team_b": "SRH",  "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-04-06", "team_a": "LSG",  "team_b": "RCB",  "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-04-07", "team_a": "PBKS", "team_b": "RR",   "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "7:30 PM"},
    {"date": "2026-04-08", "team_a": "MI",   "team_b": "GT",   "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-04-09", "team_a": "SRH",  "team_b": "KKR",  "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
    {"date": "2026-04-10", "team_a": "DC",   "team_b": "CSK",  "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-04-11", "team_a": "RR",   "team_b": "LSG",  "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-04-12", "team_a": "RCB",  "team_b": "GT",   "venue": "M Chinnaswamy Stadium, Bengaluru","time": "3:30 PM"},
    {"date": "2026-04-12", "team_a": "PBKS", "team_b": "MI",   "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "7:30 PM"},
    {"date": "2026-04-13", "team_a": "KKR",  "team_b": "CSK",  "venue": "Eden Gardens, Kolkata",         "time": "3:30 PM"},
    {"date": "2026-04-13", "team_a": "SRH",  "team_b": "DC",   "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
    {"date": "2026-04-14", "team_a": "GT",   "team_b": "RR",   "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-04-15", "team_a": "LSG",  "team_b": "PBKS", "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-04-16", "team_a": "MI",   "team_b": "RCB",  "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-04-17", "team_a": "DC",   "team_b": "RR",   "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-04-18", "team_a": "CSK",  "team_b": "GT",   "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-04-19", "team_a": "KKR",  "team_b": "SRH",  "venue": "Eden Gardens, Kolkata",         "time": "3:30 PM"},
    {"date": "2026-04-19", "team_a": "RCB",  "team_b": "LSG",  "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-04-20", "team_a": "PBKS", "team_b": "DC",   "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "3:30 PM"},
    {"date": "2026-04-20", "team_a": "RR",   "team_b": "CSK",  "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-04-21", "team_a": "GT",   "team_b": "LSG",  "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-04-22", "team_a": "MI",   "team_b": "KKR",  "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-04-23", "team_a": "SRH",  "team_b": "RCB",  "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
    {"date": "2026-04-24", "team_a": "MI",   "team_b": "CSK",  "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-04-25", "team_a": "DC",   "team_b": "GT",   "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-04-26", "team_a": "PBKS", "team_b": "KKR",  "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "3:30 PM"},
    {"date": "2026-04-26", "team_a": "RR",   "team_b": "SRH",  "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-04-27", "team_a": "CSK",  "team_b": "RCB",  "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-04-28", "team_a": "LSG",  "team_b": "MI",   "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-04-29", "team_a": "GT",   "team_b": "DC",   "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-04-30", "team_a": "KKR",  "team_b": "RR",   "venue": "Eden Gardens, Kolkata",         "time": "7:30 PM"},
    {"date": "2026-05-01", "team_a": "SRH",  "team_b": "PBKS", "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
    {"date": "2026-05-02", "team_a": "RCB",  "team_b": "MI",   "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-05-03", "team_a": "CSK",  "team_b": "DC",   "venue": "MA Chidambaram Stadium, Chennai","time": "3:30 PM"},
    {"date": "2026-05-03", "team_a": "GT",   "team_b": "PBKS", "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-05-04", "team_a": "LSG",  "team_b": "SRH",  "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-05-05", "team_a": "MI",   "team_b": "RR",   "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-05-06", "team_a": "KKR",  "team_b": "GT",   "venue": "Eden Gardens, Kolkata",         "time": "7:30 PM"},
    {"date": "2026-05-07", "team_a": "DC",   "team_b": "RCB",  "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-05-08", "team_a": "PBKS", "team_b": "CSK",  "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "7:30 PM"},
    {"date": "2026-05-09", "team_a": "SRH",  "team_b": "MI",   "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
    {"date": "2026-05-10", "team_a": "RR",   "team_b": "KKR",  "venue": "Sawai Mansingh Stadium, Jaipur","time": "3:30 PM"},
    {"date": "2026-05-10", "team_a": "LSG",  "team_b": "GT",   "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-05-11", "team_a": "RCB",  "team_b": "CSK",  "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-05-12", "team_a": "DC",   "team_b": "SRH",  "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-05-13", "team_a": "MI",   "team_b": "PBKS", "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-05-14", "team_a": "GT",   "team_b": "CSK",  "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-05-15", "team_a": "KKR",  "team_b": "LSG",  "venue": "Eden Gardens, Kolkata",         "time": "7:30 PM"},
    {"date": "2026-05-16", "team_a": "RR",   "team_b": "RCB",  "venue": "Sawai Mansingh Stadium, Jaipur","time": "7:30 PM"},
    {"date": "2026-05-17", "team_a": "SRH",  "team_b": "GT",   "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "3:30 PM"},
    {"date": "2026-05-17", "team_a": "PBKS", "team_b": "LSG",  "venue": "Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur","time": "7:30 PM"},
    {"date": "2026-05-18", "team_a": "MI",   "team_b": "DC",   "venue": "Wankhede Stadium, Mumbai",      "time": "7:30 PM"},
    {"date": "2026-05-19", "team_a": "RCB",  "team_b": "KKR",  "venue": "M Chinnaswamy Stadium, Bengaluru","time": "7:30 PM"},
    {"date": "2026-05-20", "team_a": "CSK",  "team_b": "RR",   "venue": "MA Chidambaram Stadium, Chennai","time": "7:30 PM"},
    {"date": "2026-05-21", "team_a": "GT",   "team_b": "MI",   "venue": "Narendra Modi Stadium, Ahmedabad","time": "7:30 PM"},
    {"date": "2026-05-22", "team_a": "DC",   "team_b": "KKR",  "venue": "Arun Jaitley Stadium, Delhi",   "time": "7:30 PM"},
    {"date": "2026-05-23", "team_a": "LSG",  "team_b": "RR",   "venue": "BRSABV Ekana Cricket Stadium, Lucknow","time": "7:30 PM"},
    {"date": "2026-05-24", "team_a": "SRH",  "team_b": "CSK",  "venue": "Rajiv Gandhi International Stadium, Hyderabad","time": "7:30 PM"},
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
