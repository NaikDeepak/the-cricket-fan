import pytest

from bot.aliases import SEED, UnresolvedEntityError, resolve, seed_aliases
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


def test_seed_resolves_international_teams_and_venues(conn):
    seed_aliases(conn)
    assert resolve(conn, "team", "IND") == "India"
    assert resolve(conn, "team", "AUS") == "Australia"
    assert resolve(conn, "team", "PAK") == "Pakistan"
    assert resolve(conn, "venue", "wankhede stadium") == "Wankhede Stadium, Mumbai"


def test_hundred_2026_rebrand_teams_are_not_merged_with_predecessors(conn):
    """Manchester Super Giants, Sunrisers Leeds, and MI London are NOT
    renames of Manchester Originals / Northern Superchargers / London
    Spirit — team_matches (cricsheet-ingested) carries independent
    historical rows for all six names. A SEED row that aliases the new
    name to the old one's canonical silently merges two clubs' ELO/form
    history, corrupting every prediction touching either side. Regression
    guard for that exact bug (previously present in this file)."""
    seed_aliases(conn)
    assert resolve(conn, "team", "msg") == "Manchester Super Giants"
    assert resolve(conn, "team", "manchester super giants") == "Manchester Super Giants"
    assert resolve(conn, "team", "mo") == "Manchester Originals"
    assert resolve(conn, "team", "manchester originals") == "Manchester Originals"
    assert resolve(conn, "team", "srl") == "Sunrisers Leeds"
    assert resolve(conn, "team", "sunrisers leeds") == "Sunrisers Leeds"
    assert resolve(conn, "team", "nsc") == "Northern Superchargers"
    assert resolve(conn, "team", "northern superchargers") == "Northern Superchargers"
    assert resolve(conn, "team", "mil") == "MI London"
    assert resolve(conn, "team", "mi london") == "MI London"
    assert resolve(conn, "team", "ls") == "London Spirit"
    assert resolve(conn, "team", "london spirit") == "London Spirit"
    assert resolve(conn, "team", "milw") == "MI London Women"
    assert resolve(conn, "team", "mi london women") == "MI London Women"
    assert resolve(conn, "team", "sulw") == "Sunrisers Leeds Women"
    assert resolve(conn, "team", "sunrisers leeds women") == "Sunrisers Leeds Women"


def test_seed_has_no_duplicate_team_alias_keys():
    """Two SEED rows for the same (kind, alias) with different canonicals is
    how the rebrand-merge bug got in undetected — seed_aliases()'s INSERT-
    IF-NOT-EXISTS silently keeps whichever row runs first. Fail loudly
    instead of relying on dict ordering."""
    seen: dict[tuple[str, str], str] = {}
    dupes = []
    for kind, alias, canonical in SEED:
        key = (kind, alias)
        if key in seen and seen[key] != canonical:
            dupes.append((key, seen[key], canonical))
        seen[key] = canonical
    assert dupes == []
