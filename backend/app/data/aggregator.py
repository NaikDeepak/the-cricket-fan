# backend/app/data/aggregator.py
import json
from collections import defaultdict
from pathlib import Path
from .cricsheet_parser import parse_match


def build_pvp(matches_dir: Path) -> dict:
    """Returns {(batsman, bowler): {balls, runs, dismissals, dots}}"""
    stats: dict = defaultdict(lambda: {"balls": 0, "runs": 0, "dismissals": 0, "dots": 0})
    for f in matches_dir.glob("*.json"):
        for d in parse_match(f):
            key = (d.batsman, d.bowler)
            stats[key]["balls"] += 1
            stats[key]["runs"] += d.runs_batter
            if d.is_wicket:
                stats[key]["dismissals"] += 1
            if d.runs_batter == 0:
                stats[key]["dots"] += 1
    return dict(stats)


def build_venue_stats(matches_dir: Path) -> dict:
    """Returns {(venue, team): {matches, wins, chase_wins, chase_attempts}}"""
    stats: dict = defaultdict(
        lambda: {"matches": 0, "wins": 0, "chase_wins": 0, "chase_attempts": 0}
    )
    for f in matches_dir.glob("*.json"):
        with open(f) as fh:
            data = json.load(fh)
        info = data.get("info", {})
        venue = info.get("venue", "Unknown")
        winner = info.get("outcome", {}).get("winner")
        teams = info.get("teams", [])
        toss = info.get("toss", {})
        toss_winner = toss.get("winner")
        toss_decision = toss.get("decision")  # bat or field
        chasing_team = (
            toss_winner
            if toss_decision == "field"
            else next((t for t in teams if t != toss_winner), None)
        )

        for team in teams:
            stats[(venue, team)]["matches"] += 1
            if winner == team:
                stats[(venue, team)]["wins"] += 1
            if chasing_team == team:
                stats[(venue, team)]["chase_attempts"] += 1
                if winner == team:
                    stats[(venue, team)]["chase_wins"] += 1
    return dict(stats)
