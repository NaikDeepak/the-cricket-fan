"""Swappable adapter over a free cricket API (CricAPI currentMatches shape).

Hard-fail rule applied here: unresolved team/venue -> match skipped + logged.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from .aliases import UnresolvedEntityError, resolve

logger = logging.getLogger(__name__)

ABANDONED_MARKERS = ("abandoned", "no result")


def _resolve_league(m: dict) -> str:
    """CricAPI omits `series` entirely for The Hundred (both competitions) —
    the only place the competition name shows up is `name`
    ("Trent Rockets vs Manchester Originals, Final, The Hundred Mens
    Competition 2026"). Falling straight through to the "T20" default in
    that case produces a league string that can never match the canonical
    "The Hundred" / "The Hundred Women" values team_seed.py seeds and the
    UI's league dropdown is built from — backtest's upcoming-fixture query
    (bot/backtest.py) filters on exact league match, so the fixture would
    ingest but never surface. Every other league keeps using `series`
    verbatim, unchanged from before.
    """
    raw = m.get("series") or m.get("name") or ""
    low = raw.lower()
    if "hundred" in low:
        return "The Hundred Women" if "women" in low else "The Hundred"
    return raw or "T20"


@dataclass(frozen=True)
class Fixture:
    provider_match_id: str
    team_a: str
    team_b: str
    venue: str
    league: str
    start_time: datetime


@dataclass(frozen=True)
class Result:
    provider_match_id: str
    winner: str | None
    no_result: bool


class CricApiProvider:
    def __init__(
        self, base_url: str, api_key: str, client: httpx.Client | None = None
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=20)

    def fetch(self, conn) -> tuple[list[Fixture], list[Result]]:
        resp = self.client.get(
            f"{self.base_url}/currentMatches",
            params={"apikey": self.api_key, "offset": 0},
        )
        resp.raise_for_status()
        payload = resp.json()
        fixtures: list[Fixture] = []
        results: list[Result] = []
        for m in payload.get("data", []):
            match_type = (m.get("matchType") or "").lower()
            series_name = (m.get("series") or "").lower()
            is_supported_format = (
                "t20" in match_type
                or "ipl" in match_type
                or "hundred" in match_type
                or "t20" in series_name
                or "ipl" in series_name
                or "hundred" in series_name
            )
            if not is_supported_format:
                continue
            try:
                teams = sorted(resolve(conn, "team", t) for t in m.get("teams", []))
                venue = resolve(conn, "venue", m.get("venue", ""))
            except UnresolvedEntityError as e:
                logger.warning("skipping match %s: unresolved %s", m.get("id"), e)
                continue
            if len(teams) != 2:
                continue
            if not m.get("matchEnded"):
                fixtures.append(
                    Fixture(
                        provider_match_id=str(m["id"]),
                        team_a=teams[0],
                        team_b=teams[1],
                        venue=venue,
                        league=_resolve_league(m),
                        start_time=datetime.fromisoformat(m["dateTimeGMT"]).replace(
                            tzinfo=timezone.utc
                        ),
                    )
                )
            else:
                status = m.get("status", "").lower()
                no_result = any(k in status for k in ABANDONED_MARKERS)
                winner_raw = m.get("matchWinner")
                winner = None
                if winner_raw and not no_result:
                    try:
                        winner = resolve(conn, "team", winner_raw)
                    except UnresolvedEntityError:
                        no_result = True  # can't attribute -> treat as void
                elif not no_result:
                    no_result = True  # ended without winner info -> void
                results.append(
                    Result(
                        provider_match_id=str(m["id"]),
                        winner=winner,
                        no_result=no_result,
                    )
                )
        return fixtures, results
