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
    def __init__(self, base_url: str, api_key: str,
                 client: httpx.Client | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=20)

    def fetch(self, conn) -> tuple[list[Fixture], list[Result]]:
        resp = self.client.get(f"{self.base_url}/currentMatches",
                               params={"apikey": self.api_key, "offset": 0})
        resp.raise_for_status()
        payload = resp.json()
        fixtures: list[Fixture] = []
        results: list[Result] = []
        for m in payload.get("data", []):
            if m.get("matchType", "").lower() != "t20":
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
                fixtures.append(Fixture(
                    provider_match_id=str(m["id"]),
                    team_a=teams[0], team_b=teams[1], venue=venue,
                    league=m.get("series", "T20"),
                    start_time=datetime.fromisoformat(
                        m["dateTimeGMT"]).replace(tzinfo=timezone.utc),
                ))
            else:
                status = m.get("status", "").lower()
                no_result = any(k in status for k in ABANDONED_MARKERS)
                winner_raw = m.get("matchWinner")
                winner = None
                if winner_raw and not no_result:
                    try:
                        winner = resolve(conn, "team", winner_raw)
                    except UnresolvedEntityError:
                        no_result = True   # can't attribute -> treat as void
                elif not no_result:
                    no_result = True       # ended without winner info -> void
                results.append(Result(
                    provider_match_id=str(m["id"]),
                    winner=winner, no_result=no_result))
        return fixtures, results
