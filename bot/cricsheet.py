"""Result-level Cricsheet parser. One match file -> two TeamMatchRow (or [] if no result)."""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path


# Franchises whose home city is not a substring of the team name, so the
# default `city in team` check misses them. Cricsheet's `info.city` field is
# checked against these instead.
_HOME_CITY_OVERRIDES: dict[str, set[str]] = {
    # IPL
    "Punjab Kings": {"mohali", "chandigarh", "new chandigarh", "dharamsala"},
    "Kings XI Punjab": {"mohali", "chandigarh", "new chandigarh", "dharamsala"},
    "Rajasthan Royals": {"jaipur"},
    "Gujarat Titans": {"ahmedabad"},
    "Gujarat Lions": {"rajkot"},
    "Deccan Chargers": {"hyderabad"},
    "Sunrisers Hyderabad": {"hyderabad"},
    "Kochi Tuskers Kerala": {"kochi"},
    "Pune Warriors India": {"pune"},
    "Rising Pune Supergiant": {"pune"},
    "Rising Pune Supergiants": {"pune"},
    "Royal Challengers Bangalore": {"bangalore", "bengaluru"},
    "Royal Challengers Bengaluru": {"bangalore", "bengaluru"},
    # The Hundred (Men & Women)
    "Southern Brave": {"southampton"},
    "Southern Brave Women": {"southampton"},
    "Northern Superchargers": {"leeds"},
    "Northern Superchargers Women": {"leeds"},
    "Sunrisers Leeds": {"leeds"},
    "Sunrisers Leeds Women": {"leeds"},
    "Trent Rockets": {"nottingham"},
    "Trent Rockets Women": {"nottingham"},
    "Welsh Fire": {"cardiff"},
    "Welsh Fire Women": {"cardiff"},
    "London Spirit": {"london"},
    "London Spirit Women": {"london"},
    "Oval Invincibles": {"london", "kennington"},
    "Oval Invincibles Women": {"london", "kennington"},
    "MI London": {"london"},
    "MI London Women": {"london"},
    "Manchester Originals": {"manchester"},
    "Manchester Originals Women": {"manchester"},
    "Manchester Super Giants": {"manchester"},
    "Birmingham Phoenix": {"birmingham"},
    "Birmingham Phoenix Women": {"birmingham"},
    # WPL
    "Royal Challengers Bengaluru Women": {"bangalore", "bengaluru"},
    "Mumbai Indians Women": {"mumbai", "navi mumbai"},
    "Delhi Capitals Women": {"delhi"},
    "UP Warriorz": {"lucknow"},
    "Gujarat Giants Women": {"ahmedabad", "rajkot"},
    # BBL & WBBL
    "Adelaide Strikers": {"adelaide"},
    "Adelaide Strikers Women": {"adelaide"},
    "Brisbane Heat": {"brisbane"},
    "Brisbane Heat Women": {"brisbane"},
    "Hobart Hurricanes": {"hobart"},
    "Hobart Hurricanes Women": {"hobart"},
    "Melbourne Renegades": {"melbourne", "geelong"},
    "Melbourne Renegades Women": {"melbourne", "geelong"},
    "Melbourne Stars": {"melbourne"},
    "Melbourne Stars Women": {"melbourne"},
    "Perth Scorchers": {"perth"},
    "Perth Scorchers Women": {"perth"},
    "Sydney Sixers": {"sydney"},
    "Sydney Sixers Women": {"sydney"},
    "Sydney Thunder": {"sydney", "canberra"},
    "Sydney Thunder Women": {"sydney", "canberra"},
}


def normalize_cricsheet_team_name(team: str, league: str) -> str:
    """Normalizes raw team names from Cricsheet to canonical team names."""
    if not team:
        return team
    t = team.strip()

    if league in ("The Hundred Women", "WBBL", "WCPL"):
        if not t.endswith(" Women"):
            return f"{t} Women"
    elif league == "WPL":
        if t in ("Royal Challengers Bangalore", "Royal Challengers Bengaluru"):
            return "Royal Challengers Bengaluru Women"
        if t == "Mumbai Indians":
            return "Mumbai Indians Women"
        if t == "Delhi Capitals":
            return "Delhi Capitals Women"
        if t == "Gujarat Giants":
            return "Gujarat Giants Women"
        if t == "UP Warriorz":
            return "UP Warriorz"
        if not t.endswith(" Women") and t != "UP Warriorz":
            return f"{t} Women"
    elif league == "IPL":
        if t == "Royal Challengers Bangalore":
            return "Royal Challengers Bengaluru"

    return t


def _is_home(team: str, city: str) -> bool:
    if not city:
        return False
    city_l = city.lower()
    override = _HOME_CITY_OVERRIDES.get(team)
    if override is not None:
        return city_l in override
    return city_l in team.lower()


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
    batted_first: bool
    pp_runs_scored: float | None
    pp_overs_faced: float | None
    death_runs_conceded: float | None
    death_overs_bowled: float | None


def _innings_stats(data: dict) -> dict[str, dict[str, float]]:
    """team -> {runs, balls, pp_runs, pp_balls, death_runs, death_balls}.
    Powerplay = Cricsheet overs 0-5 (0-indexed); death = overs 15-19."""
    stats: dict[str, dict[str, float]] = {}
    for innings in data.get("innings", []):
        team = innings.get("team", "")
        if team in stats:
            continue
        runs = balls = pp_runs = pp_balls = death_runs = death_balls = 0.0
        for over in innings.get("overs", []):
            over_num = over.get("over", 0)
            is_pp = over_num < 6
            is_death = over_num >= 15
            for d in over.get("deliveries", []):
                total = d.get("runs", {}).get("total", 0)
                extras = d.get("extras", {})
                legal = "wides" not in extras and "noballs" not in extras
                runs += total
                if legal:
                    balls += 1
                if is_pp:
                    pp_runs += total
                    if legal:
                        pp_balls += 1
                if is_death:
                    death_runs += total
                    if legal:
                        death_balls += 1
        stats[team] = {
            "runs": runs,
            "balls": balls,
            "pp_runs": pp_runs,
            "pp_balls": pp_balls,
            "death_runs": death_runs,
            "death_balls": death_balls,
        }
    return stats


def parse_match_dict(data: dict, league: str) -> list[TeamMatchRow]:
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
    stats = _innings_stats(data)
    innings_list = data.get("innings", [])
    first_batting_team = innings_list[0]["team"] if innings_list else None

    norm_winner = normalize_cricsheet_team_name(winner, league)

    rows = []
    for team in teams:
        opponent = next(t for t in teams if t != team)
        scored = stats.get(team)
        conceded = stats.get(opponent)
        norm_team = normalize_cricsheet_team_name(team, league)
        norm_opponent = normalize_cricsheet_team_name(opponent, league)
        rows.append(
            TeamMatchRow(
                team=norm_team,
                opponent=norm_opponent,
                date=match_date,
                season=season,
                league=league,
                venue=venue,
                won=(norm_team == norm_winner),
                dls=dls,
                runs_scored=scored["runs"] if scored else None,
                overs_faced=scored["balls"] / 6.0 if scored else None,
                runs_conceded=conceded["runs"] if conceded else None,
                overs_bowled=conceded["balls"] / 6.0 if conceded else None,
                home=_is_home(norm_team, city),
                batted_first=(team == first_batting_team),
                pp_runs_scored=scored["pp_runs"] if scored else None,
                pp_overs_faced=scored["pp_balls"] / 6.0 if scored else None,
                death_runs_conceded=conceded["death_runs"] if conceded else None,
                death_overs_bowled=conceded["death_balls"] / 6.0 if conceded else None,
            )
        )
    return rows


def parse_result(filepath: Path, league: str) -> list[TeamMatchRow]:
    with open(filepath) as f:
        data = json.load(f)
    return parse_match_dict(data, league)
