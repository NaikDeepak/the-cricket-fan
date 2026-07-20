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


def test_seed_idempotent(conn):
    seed_aliases(conn)
    seed_aliases(conn)  # second run must not raise IntegrityError
    assert resolve(conn, "team", "RCB") == "Royal Challengers Bengaluru"
