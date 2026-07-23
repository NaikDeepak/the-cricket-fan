import pytest

from bot.aliases import UnresolvedEntityError, resolve, seed_aliases
from bot.db import aliases


@pytest.fixture
def conn(engine):
    with engine.begin() as c:
        yield c


def test_resolve_via_alias(conn):
    conn.execute(
        aliases.insert().values(
            kind="team",
            alias="royal challengers bangalore",
            canonical="Royal Challengers Bengaluru",
        )
    )
    assert (
        resolve(conn, "team", "Royal Challengers Bangalore")
        == "Royal Challengers Bengaluru"
    )


def test_resolve_canonical_passthrough(conn):
    conn.execute(
        aliases.insert().values(
            kind="team", alias="csk", canonical="Chennai Super Kings"
        )
    )
    # canonical names resolve to themselves even without an explicit self-alias
    assert resolve(conn, "team", "Chennai Super Kings ") == "Chennai Super Kings"


def test_unresolved_raises(conn):
    with pytest.raises(UnresolvedEntityError):
        resolve(conn, "team", "Gotham Galacticos")


def test_resolve_passthrough_via_team_matches_team(conn):
    """A team the model has history for (e.g. an international/non-IPL side from
    the T20I ingest) resolves to its stored canonical name even without an alias
    row, so live fixtures involving it are not hard-skipped."""
    from datetime import date

    from bot.db import team_matches

    conn.execute(
        team_matches.insert().values(
            team="Zimbabwe",
            opponent="India",
            date=date(2026, 7, 20),
            season="2026",
            league="T20I",
            venue="Harare Sports Club, Harare",
            won=False,
        )
    )
    assert resolve(conn, "team", "Zimbabwe") == "Zimbabwe"
    assert resolve(conn, "team", "zimbabwe") == "Zimbabwe"  # case-insensitive
    assert resolve(conn, "team", "India") == "India"  # the opponent side too


def test_resolve_passthrough_via_team_matches_venue(conn):
    from datetime import date

    from bot.db import team_matches

    conn.execute(
        team_matches.insert().values(
            team="Zimbabwe",
            opponent="India",
            date=date(2026, 7, 20),
            season="2026",
            league="T20I",
            venue="Harare Sports Club, Harare",
            won=False,
        )
    )
    assert (
        resolve(conn, "venue", "harare sports club, harare")
        == "Harare Sports Club, Harare"
    )


def test_unresolved_when_absent_from_both_aliases_and_team_matches(conn):
    with pytest.raises(UnresolvedEntityError):
        resolve(conn, "team", "Atlantis Krakens")


def test_seed_idempotent(conn):
    seed_aliases(conn)
    seed_aliases(conn)  # second run must not raise IntegrityError
    assert resolve(conn, "team", "RCB") == "Royal Challengers Bengaluru"
