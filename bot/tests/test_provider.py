import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.db import resolved_leagues
from bot.fixtures_provider import CricApiProvider

DATA = json.loads(
    (Path(__file__).parent / "data" / "provider_matches.json").read_text()
)


@pytest.fixture
def provider():
    def handler(request):
        return httpx.Response(200, json=DATA)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    return CricApiProvider("https://api.example.com/v1", "k", client=client)


@pytest.fixture
def conn(engine):
    # engine.connect() (not engine.begin()) so tests can call conn.commit()
    # mid-test (as the resolved_leagues cache-hit/cache-miss tests below
    # do) without breaking subsequent execute() calls — engine.begin()'s
    # "begin-once" context manager raises InvalidRequestError on any
    # execute() issued after a manual commit() inside its block. Reads
    # still see prior writes without a commit since everything in a test
    # runs on this same connection/transaction.
    with engine.connect() as c:
        seed_aliases(c)
        yield c


def test_fetch_resolves_and_splits(provider, conn):
    fixtures, results = provider.fetch(conn)
    ids = {f.provider_match_id for f in fixtures}
    assert ids == {"up-1"}  # unknown-1 skipped, odi-1 filtered
    up = fixtures[0]
    assert up.team_a == "Chennai Super Kings"  # alias-resolved + sorted
    assert up.team_b == "Royal Challengers Bengaluru"
    assert up.venue == "M Chinnaswamy Stadium, Bengaluru"
    assert up.start_time.tzinfo == timezone.utc

    by_id = {r.provider_match_id: r for r in results}
    assert by_id["done-1"].winner == "Mumbai Indians"
    assert by_id["nr-1"].no_result is True and by_id["nr-1"].winner is None


def test_unresolved_team_skipped_not_raised(provider, conn):
    fixtures, _ = provider.fetch(conn)  # must not raise despite Gotham Galacticos
    assert all(f.provider_match_id != "unknown-1" for f in fixtures)


def test_fetch_supports_t20i_and_ipl_match_types(conn):
    payload = {
        "status": "success",
        "data": [
            {
                "id": "t20i-1",
                "matchType": "t20i",
                "teams": ["Chennai Super Kings", "Mumbai Indians"],
                "venue": "M.Chinnaswamy Stadium",
                "dateTimeGMT": "2026-08-14T14:00:00",
                "series": "T20 International Series",
                "matchStarted": False,
                "matchEnded": False,
            }
        ],
    }

    def handler(request):
        return httpx.Response(200, json=payload)

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert len(fixtures) == 1
    assert fixtures[0].provider_match_id == "t20i-1"


def test_fetch_resolves_the_hundred_league_from_name(conn):
    # Real CricAPI shape for The Hundred (verified against a live poll):
    # matchType is plain "t20" (already passed the old filter) and the
    # "series" key is omitted entirely — the competition only appears in
    # "name". Without league resolution the fixture would ingest under
    # league="T20", never matching backtest's "The Hundred" query.
    payload = {
        "status": "success",
        "data": [
            {
                "id": "hnd-1",
                "name": (
                    "Trent Rockets vs Manchester Super Giants, Final, "
                    "The Hundred Mens Competition 2026"
                ),
                "matchType": "t20",
                "teams": ["Trent Rockets", "Manchester Super Giants"],
                "venue": "Lord's",
                "dateTimeGMT": "2026-08-30T18:00:00",
                "matchStarted": False,
                "matchEnded": False,
            }
        ],
    }

    def handler(request):
        return httpx.Response(200, json=payload)

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert len(fixtures) == 1
    f = fixtures[0]
    assert f.provider_match_id == "hnd-1"
    assert f.team_a == "Manchester Super Giants"  # sorted
    assert f.team_b == "Trent Rockets"
    assert f.venue == "Lord's, London"
    assert f.league == "The Hundred"


def test_fetch_resolves_the_hundred_women_league_from_name(conn):
    payload = {
        "status": "success",
        "data": [
            {
                "id": "hnd-w-1",
                "name": (
                    "Birmingham Phoenix Women vs Welsh Fire Women, "
                    "32nd Match, The Hundred Womens Competition 2026"
                ),
                "matchType": "t20",
                "teams": ["Birmingham Phoenix Women", "Welsh Fire Women"],
                "venue": "Edgbaston",
                "dateTimeGMT": "2026-08-20T17:00:00",
                "matchStarted": False,
                "matchEnded": False,
            }
        ],
    }

    def handler(request):
        return httpx.Response(200, json=payload)

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert len(fixtures) == 1
    assert fixtures[0].league == "The Hundred Women"


def test_fetch_resolves_league_via_series_id_cache_hit(conn):
    conn.execute(
        resolved_leagues.insert().values(
            series_id="series-ipl-1",
            series_name="Indian Premier League 2026",
            canonical_league="IPL",
            resolved_at=datetime.now(timezone.utc),
        )
    )
    conn.commit()
    calls = {"series_info": 0}

    def handler(request):
        if "series_info" in str(request.url):
            calls["series_info"] += 1
            return httpx.Response(200, json={"data": {"info": {"name": "unused"}}})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "ipl-1",
                        "name": "Team A vs Team B",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-ipl-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert len(fixtures) == 1
    assert fixtures[0].league == "IPL"
    assert calls["series_info"] == 0


def test_fetch_resolves_league_via_series_id_cache_miss_matches_keyword(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(
                200,
                json={"data": {"info": {"name": "Pakistan Super League 2026"}}},
            )
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "psl-1",
                        "name": "Team A vs Team B",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-psl-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "PSL"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-psl-1"
        )
    ).first()
    assert row.canonical_league == "PSL"
    assert row.series_name == "Pakistan Super League 2026"


def test_fetch_resolves_league_via_series_id_cache_miss_no_keyword_match(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "data": {
                        "info": {
                            "name": "Womens T20I Quadrangular Series in Namibia 2026"
                        }
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "unmapped-1",
                        "name": "Team A vs Team B, Namibia Quadrangular",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-namibia-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Team A vs Team B, Namibia Quadrangular"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-namibia-1"
        )
    ).first()
    assert row.canonical_league is None


def test_fetch_uses_cached_null_without_recalling_series_info(conn):
    conn.execute(
        resolved_leagues.insert().values(
            series_id="series-unmapped-1",
            series_name="Some Unmapped Series 2026",
            canonical_league=None,
            resolved_at=datetime.now(timezone.utc),
        )
    )
    conn.commit()
    calls = {"series_info": 0}

    def handler(request):
        if "series_info" in str(request.url):
            calls["series_info"] += 1
            return httpx.Response(200, json={"data": {"info": {"name": "unused"}}})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "x-1",
                        "name": "Fallback Name String",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-unmapped-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Fallback Name String"
    assert calls["series_info"] == 0


def test_fetch_falls_back_when_series_info_call_fails(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(500, json={"error": "server error"})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "err-1",
                        "name": "Some Match Description League 2026",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-error-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Some Match Description League 2026"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-error-1"
        )
    ).first()
    assert row is None
