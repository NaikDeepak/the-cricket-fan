"""Swappable adapter over a free cricket API (CricAPI currentMatches shape).

Hard-fail rule applied here: unresolved team/venue -> match skipped + logged.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
import sqlalchemy as sa

from .aliases import UnresolvedEntityError, resolve
from .db import resolved_leagues
from .league_keywords import match_league_keyword

logger = logging.getLogger(__name__)

ABANDONED_MARKERS = ("abandoned", "no result")


def _resolve_league(
    conn,
    client: httpx.Client,
    api_key: str,
    base_url: str,
    m: dict,
    failed_series_ids: set[str],
) -> str:
    """Resolves a fixture's league label.

    CricAPI omits `series` entirely from currentMatches (confirmed live,
    see docs/superpowers/specs/2026-08-17-fixture-league-resolution-design.md)
    — only `series_id` (a UUID) is present. This falls back to the raw
    match-description `name` string (with a dedicated substring check for
    The Hundred, whose competition name only appears in `name`, never in
    a resolvable series) unless `series_id` is present and resolvable via
    CricAPI's series_info endpoint + the curated keyword table in
    bot/league_keywords.py — cached in resolved_leagues so each
    tournament costs at most one series_info API call for its entire run,
    not one per match. Every failure mode (missing series_id, unmatched
    keyword, API error) falls through to the raw-name fallback —
    ingestion must never break on a resolution miss.

    `failed_series_ids` is a run-scoped (not persisted) set of series_ids
    that have already failed resolution earlier in this same fetch() call.
    It is not written to the DB cache — a persistently-failing series_id
    is deliberately retried on the *next* ingestion run — but within one
    run it prevents K matches sharing a failing series_id from repeating
    the same series_info API call K times.
    """
    raw = m.get("series") or m.get("name") or ""
    low = raw.lower()
    if "hundred" in low:
        fallback = "The Hundred Women" if "women" in low else "The Hundred"
    else:
        fallback = raw or "T20"

    series_id = m.get("series_id")
    if not series_id:
        return fallback

    cached = conn.execute(
        sa.select(resolved_leagues.c.canonical_league).where(
            resolved_leagues.c.series_id == series_id
        )
    ).first()
    if cached is not None:
        return cached.canonical_league or fallback

    if series_id in failed_series_ids:
        return fallback

    try:
        resp = client.get(
            f"{base_url}/series_info", params={"apikey": api_key, "id": series_id}
        )
        resp.raise_for_status()
        series_name = resp.json()["data"]["info"]["name"]
        canonical = match_league_keyword(series_name)
    except Exception as exc:
        logger.warning("series_info lookup failed for series_id=%s: %s", series_id, exc)
        failed_series_ids.add(series_id)
        return fallback

    stored_series_name = series_name
    if len(series_name) > 256:
        logger.warning(
            "series_name for series_id=%s is %d chars, truncating to 256",
            series_id,
            len(series_name),
        )
        stored_series_name = series_name[:256]

    try:
        with conn.begin_nested():
            conn.execute(
                resolved_leagues.insert().values(
                    series_id=series_id,
                    series_name=stored_series_name,
                    canonical_league=canonical,
                    resolved_at=datetime.now(timezone.utc),
                )
            )
    except sa.exc.IntegrityError:
        logger.info(
            "resolved_leagues row for series_id=%s already inserted concurrently; skipping",
            series_id,
        )
    return canonical or fallback


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
        failed_series_ids: set[str] = set()
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
                        league=_resolve_league(
                            conn,
                            self.client,
                            self.api_key,
                            self.base_url,
                            m,
                            failed_series_ids,
                        ),
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
