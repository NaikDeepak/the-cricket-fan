"""Match input extractor: parses freeform text or live scorecard URLs (Cricbuzz / Cricinfo).

Produces a structured MatchInput instance with teams, venue, toss, scores, and phase.
"""

import re
from dataclasses import asdict, dataclass
import httpx

try:
    import lxml.html
    HAS_LXML = True
except ImportError:
    HAS_LXML = False

from .aliases import resolve, UnresolvedEntityError

COMMON_ABBREVIATIONS: dict[str, str] = {
    # IPL
    "csk": "Chennai Super Kings",
    "mi": "Mumbai Indians",
    "rcb": "Royal Challengers Bengaluru",
    "kkr": "Kolkata Knight Riders",
    "srh": "Sunrisers Hyderabad",
    "dc": "Delhi Capitals",
    "pbks": "Punjab Kings",
    "rr": "Rajasthan Royals",
    "gt": "Gujarat Titans",
    "lsg": "Lucknow Super Giants",
    # CPL
    "abf": "Antigua & Barbuda Falcons",
    "antigua and barbuda falcons": "Antigua & Barbuda Falcons",
    "antigua & barbuda falcons": "Antigua & Barbuda Falcons",
    "jkm": "Jamaica Tallawahs",
    "jamaica tallawahs": "Jamaica Tallawahs",
    "sknp": "St Kitts and Nevis Patriots",
    "st kitts & nevis patriots": "St Kitts and Nevis Patriots",
    "st kitts and nevis patriots": "St Kitts and Nevis Patriots",
    "tkr": "Trinbago Knight Riders",
    "trinbago knight riders": "Trinbago Knight Riders",
    "br": "Barbados Royals",
    "barbados royals": "Barbados Royals",
    "gaw": "Guyana Amazon Warriors",
    "guyana amazon warriors": "Guyana Amazon Warriors",
    "slk": "Saint Lucia Kings",
    "saint lucia kings": "Saint Lucia Kings",
    # Internationals
    "ind": "India",
    "aus": "Australia",
    "eng": "England",
    "pak": "Pakistan",
    "sa": "South Africa",
    "nz": "New Zealand",
    "wi": "West Indies",
    "sl": "Sri Lanka",
    "ban": "Bangladesh",
    "afg": "Afghanistan",
    "ned": "Netherlands",
    "ire": "Ireland",
    "zim": "Zimbabwe",
    "usa": "United States of America",
    "sco": "Scotland",
    "nam": "Namibia",
}


@dataclass
class MatchInput:
    team_a: str = ""
    team_b: str = ""
    league: str = "T20"
    venue: str = ""
    toss_winner: str | None = None
    toss_decision: str | None = None  # 'bat' | 'field'
    innings1_team: str | None = None
    innings1_runs: int | None = None
    innings1_wickets: int | None = None
    innings1_overs: float | None = None
    innings2_team: str | None = None
    innings2_runs: int | None = None
    innings2_wickets: int | None = None
    innings2_overs: float | None = None
    phase: str = "pre_match"  # 'pre_match' | 'innings_break' | 'chase_in_progress' | 'completed'

    def to_dict(self) -> dict:
        return asdict(self)


def normalize_team_name(name: str, conn=None) -> str:
    cleaned = name.strip()
    if not cleaned:
        return cleaned
    lower = cleaned.lower()
    if lower in COMMON_ABBREVIATIONS:
        return COMMON_ABBREVIATIONS[lower]
    if conn:
        try:
            return resolve(conn, "team", cleaned)
        except UnresolvedEntityError:
            pass
    return cleaned


def parse_match_text(text: str, conn=None) -> MatchInput:
    result = MatchInput()
    if not text or not text.strip():
        return result

    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]

    # 1. Look for matchup (e.g., "CSK vs MI", "India vs Australia", "JKM vs ABF")
    vs_match = re.search(
        r"([A-Za-z0-9\s&'-]+?)\s+(?:vs\.?|v/s|v)\s+([A-Za-z0-9\s&'-]+?)(?:,|\n|\s*-\s*|\s+at\s+|\s+in\s+|\s+1st|\s+2nd|\s+3rd|\s+4th|\s+5th|\s+Match|\s+T20|\s*$)",
        text,
        re.IGNORECASE,
    )
    if vs_match:
        t_a = normalize_team_name(vs_match.group(1).strip(), conn)
        t_b = normalize_team_name(vs_match.group(2).strip(), conn)
        # Avoid false positives like "Overs vs Runs"
        if len(t_a) > 1 and len(t_b) > 1:
            result.team_a = t_a
            result.team_b = t_b

    # 2. Look for Venue
    venue_match = re.search(
        r"(?:Venue|Stadium|Match\s+Venue|Ground|At):\s*([A-Za-z0-9\s,.'-]+?)(?:\n|$|\s*-\s*|\s*\|)",
        text,
        re.IGNORECASE,
    )
    if venue_match:
        result.venue = venue_match.group(1).strip()
    else:
        for line in lines:
            if any(
                k in line
                for k in [
                    "Stadium",
                    "Ground",
                    "Oval",
                    "Garden",
                    "Gardens",
                    "Park",
                    "Chepauk",
                    "Chinnaswamy",
                    "Wankhede",
                    "Kotla",
                    "Motera",
                ]
            ):
                clean_line = re.sub(r"^(?:at|,)\s+", "", line, flags=re.IGNORECASE).strip()
                if not any(
                    stop in clean_line.lower()
                    for stop in ["vs", "premier league", "league", "toss", "won the toss"]
                ):
                    result.venue = clean_line
                    break

    # 3. Look for Toss
    toss_match = re.search(
        r"([A-Za-z0-9\s&'-]+?)\s+(?:won the toss and (?:opted|elected|chose) to|win the toss and (?:opt|elect|choose) to)\s+(bat|bowl|field)",
        text,
        re.IGNORECASE,
    )
    if toss_match:
        result.toss_winner = normalize_team_name(toss_match.group(1).strip(), conn)
        decision = toss_match.group(2).lower()
        result.toss_decision = "field" if decision in ("bowl", "field") else "bat"

    # 4. Look for League
    league_match = re.search(
        r"(IPL|Indian Premier League|CPL|Caribbean Premier League|BBL|Big Bash League|PSL|Pakistan Super League|SA20|MLC|Major League Cricket|The Hundred|T20I|World Cup|T20)",
        text,
        re.IGNORECASE,
    )
    if league_match:
        league_str = league_match.group(1).upper()
        if "IPL" in league_str or "INDIAN PREMIER LEAGUE" in league_str:
            result.league = "IPL"
        elif "CPL" in league_str or "CARIBBEAN" in league_str:
            result.league = "CPL"
        elif "BBL" in league_str or "BIG BASH" in league_str:
            result.league = "BBL"
        elif "PSL" in league_str:
            result.league = "PSL"
        elif "SA20" in league_str:
            result.league = "SA20"
        elif "MLC" in league_str:
            result.league = "MLC"
        else:
            result.league = league_str

    # 5. Look for Innings / Scores
    # Patterns:
    # "Antigua & Barbuda Falcons 163/4 (20.0 ov)" or "CSK 175-4 (20)" or "MI: 82/3 in 10.2 overs"
    score_pattern = re.compile(
        r"(?:([A-Za-z0-9\s&'-]+?)[:\s]+)?(\d{1,3})[-/](\d{1,2})\s*(?:\(([\d.]+)(?:\s*(?:ov|overs|ovs))?\)?|in\s+([\d.]+)\s*(?:ov|overs|ovs))",
        re.IGNORECASE,
    )
    scores = []
    for line in lines:
        for m in score_pattern.finditer(line):
            team_raw = m.group(1) or ""
            runs = int(m.group(2))
            wickets = int(m.group(3))
            overs_str = m.group(4) or m.group(5) or "20"
            overs = float(overs_str)
            team_norm = normalize_team_name(team_raw.strip(), conn) if team_raw.strip() else None
            # Filter out false positives
            if runs <= 400 and wickets <= 10 and overs <= 50:
                scores.append((team_norm, runs, wickets, overs))

    if len(scores) >= 1:
        s1 = scores[0]
        result.innings1_team = s1[0] or result.team_a
        result.innings1_runs = s1[1]
        result.innings1_wickets = s1[2]
        result.innings1_overs = s1[3]

    if len(scores) >= 2:
        s2 = scores[1]
        result.innings2_team = s2[0] or result.team_b
        result.innings2_runs = s2[1]
        result.innings2_wickets = s2[2]
        result.innings2_overs = s2[3]

    # If teams were not resolved by vs_match, infer from innings teams
    if not result.team_a and result.innings1_team:
        result.team_a = result.innings1_team
    if not result.team_b and result.innings2_team:
        result.team_b = result.innings2_team

    # 6. Determine Phase
    if result.innings2_runs is not None:
        if (
            result.innings2_overs is not None and result.innings2_overs >= 20.0
        ) or (
            result.innings2_wickets == 10
        ) or (
            result.innings1_runs is not None and result.innings2_runs > result.innings1_runs
        ) or (
            "won by" in text.lower()
        ):
            result.phase = "completed"
        else:
            result.phase = "chase_in_progress"
    elif result.innings1_runs is not None:
        if (
            result.innings1_overs is not None and result.innings1_overs >= 20.0
        ) or (
            result.innings1_wickets == 10
        ) or (
            "innings break" in text.lower() or "opt to bowl" in text.lower() or "target" in text.lower()
        ):
            result.phase = "innings_break"
        else:
            result.phase = "chase_in_progress"  # or live 1st innings
    else:
        result.phase = "pre_match"

    return result


def fetch_and_parse_url(url: str, conn=None) -> MatchInput:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    with httpx.Client(timeout=10.0, headers=headers, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        html = resp.text

    if HAS_LXML:
        doc = lxml.html.fromstring(html)
        title = doc.findtext(".//title") or ""
        page_text = doc.text_content()
    else:
        title_m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_m.group(1).strip() if title_m else ""
        page_text = re.sub(r"<[^>]+>", " ", html)

    # Combine title and body text for parsing
    full_text = f"{title}\n\n{page_text}"
    parsed = parse_match_text(full_text, conn=conn)

    return parsed
