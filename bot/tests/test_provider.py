import json
from datetime import timezone
from pathlib import Path

import httpx
import pytest

from bot.aliases import seed_aliases
from bot.fixtures_provider import CricApiProvider

DATA = json.loads(
    (Path(__file__).parent / "data" / "provider_matches.json").read_text()
)


@pytest.fixture()
def provider():
    def handler(request):
        return httpx.Response(200, json=DATA)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    return CricApiProvider("https://api.example.com/v1", "k", client=client)


@pytest.fixture()
def conn(engine):
    with engine.begin() as c:
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
