# backend/app/data/cricsheet_parser.py
import json
from pathlib import Path
from dataclasses import dataclass
from typing import Generator


@dataclass
class Delivery:
    batsman: str
    bowler: str
    runs_batter: int
    is_wicket: bool
    fielding_phase: str  # powerplay | middle | death
    venue: str
    batting_team: str
    bowling_team: str


def phase(over: int) -> str:
    if over < 6:
        return "powerplay"
    if over < 16:
        return "middle"
    return "death"


def parse_match(filepath: Path) -> Generator[Delivery, None, None]:
    with open(filepath) as f:
        data = json.load(f)

    info = data.get("info", {})
    venue = info.get("venue", "Unknown")
    teams = info.get("teams", [])

    for innings in data.get("innings", []):
        batting_team = innings.get("team", "")
        bowling_team = next((t for t in teams if t != batting_team), "")
        for over_data in innings.get("overs", []):
            over_num = over_data["over"]
            p = phase(over_num)
            for delivery in over_data.get("deliveries", []):
                batsman = delivery.get("batter", "")
                bowler = delivery.get("bowler", "")
                runs = delivery.get("runs", {}).get("batter", 0)
                is_wicket = bool(delivery.get("wickets"))
                yield Delivery(
                    batsman=batsman,
                    bowler=bowler,
                    runs_batter=runs,
                    is_wicket=is_wicket,
                    fielding_phase=p,
                    venue=venue,
                    batting_team=batting_team,
                    bowling_team=bowling_team,
                )
