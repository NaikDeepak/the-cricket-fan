"""Result-level Cricsheet parser. One match file -> two TeamMatchRow (or [] if no result)."""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class TeamMatchRow:
    team: str
    opponent: str
    date: date
    season: str
    league: str
    venue: str
    won: bool
    dls: bool
    runs_scored: float | None
    overs_faced: float | None
    runs_conceded: float | None
    overs_bowled: float | None
    home: bool


def _innings_totals(data: dict) -> dict[str, tuple[float, float]]:
    """team -> (total runs incl extras, overs faced as decimal overs)."""
    totals: dict[str, tuple[float, float]] = {}
    for innings in data.get("innings", []):
        team = innings.get("team", "")
        if team in totals:
            continue
        runs = 0.0
        balls = 0
        for over in innings.get("overs", []):
            for d in over.get("deliveries", []):
                runs += d.get("runs", {}).get("total", 0)
                extras = d.get("extras", {})
                if "wides" not in extras and "noballs" not in extras:
                    balls += 1
        totals[team] = (runs, balls / 6.0)
    return totals


def parse_result(filepath: Path, league: str) -> list[TeamMatchRow]:
    with open(filepath) as f:
        data = json.load(f)
    info = data.get("info", {})
    outcome = info.get("outcome", {})
    teams = info.get("teams", [])
    if len(teams) != 2:
        return []

    winner = outcome.get("winner") or outcome.get("eliminator")
    if not winner:  # true tie or no result
        return []

    method = str(outcome.get("method", ""))
    dls = "D/L" in method or "DLS" in method
    venue = info.get("venue", "Unknown")
    city = info.get("city", "")
    season = str(info.get("season", ""))
    dates = info.get("dates") or ["1970-01-01"]
    match_date = date.fromisoformat(dates[0])
    totals = _innings_totals(data)

    rows = []
    for team in teams:
        opponent = next(t for t in teams if t != team)
        scored = totals.get(team)
        conceded = totals.get(opponent)
        rows.append(
            TeamMatchRow(
                team=team,
                opponent=opponent,
                date=match_date,
                season=season,
                league=league,
                venue=venue,
                won=(team == winner),
                dls=dls,
                runs_scored=scored[0] if scored else None,
                overs_faced=scored[1] if scored else None,
                runs_conceded=conceded[0] if conceded else None,
                overs_bowled=conceded[1] if conceded else None,
                home=bool(city) and city.lower() in team.lower(),
            )
        )
    return rows
