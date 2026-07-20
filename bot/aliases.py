"""Entity resolution: live-API team/venue names -> canonical Cricsheet names.

Hard-fail rule: unresolved name raises UnresolvedEntityError; callers must skip
the match and log — never predict through unresolved entities.
"""

import sqlalchemy as sa

from .db import aliases


class UnresolvedEntityError(Exception):
    pass


def _norm(name: str) -> str:
    return " ".join(name.strip().lower().split())


def resolve(conn, kind: str, name: str) -> str:
    n = _norm(name)
    row = conn.execute(
        sa.select(aliases.c.canonical).where(
            aliases.c.kind == kind,
            sa.func.lower(aliases.c.alias) == n,
        )
    ).first()
    if row:
        return row.canonical
    # canonical passthrough: name already appears as a canonical value
    row = conn.execute(
        sa.select(aliases.c.canonical).where(
            aliases.c.kind == kind,
            sa.func.lower(aliases.c.canonical) == n,
        )
    ).first()
    if row:
        return row.canonical
    raise UnresolvedEntityError(f"{kind}: {name!r}")


SEED: list[tuple[str, str, str]] = [
    # (kind, alias, canonical) — extend as unresolved names surface in logs
    ("team", "rcb", "Royal Challengers Bengaluru"),
    ("team", "royal challengers bangalore", "Royal Challengers Bengaluru"),
    ("team", "csk", "Chennai Super Kings"),
    ("team", "mi", "Mumbai Indians"),
    ("team", "kkr", "Kolkata Knight Riders"),
    ("team", "srh", "Sunrisers Hyderabad"),
    ("team", "dc", "Delhi Capitals"),
    ("team", "pbks", "Punjab Kings"),
    ("team", "rr", "Rajasthan Royals"),
    ("team", "gt", "Gujarat Titans"),
    ("team", "lsg", "Lucknow Super Giants"),
    ("venue", "m.chinnaswamy stadium", "M Chinnaswamy Stadium, Bengaluru"),
]


def seed_aliases(conn) -> None:
    for kind, alias, canonical in SEED:
        exists = conn.execute(
            sa.select(aliases.c.id).where(
                aliases.c.kind == kind, aliases.c.alias == alias
            )
        ).first()
        if not exists:
            conn.execute(
                aliases.insert().values(kind=kind, alias=alias, canonical=canonical)
            )
