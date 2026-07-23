"""Entity resolution: live-API team/venue names -> canonical Cricsheet names.

Hard-fail rule: unresolved name raises UnresolvedEntityError; callers must skip
the match and log — never predict through unresolved entities.
"""

import sqlalchemy as sa

from .db import aliases, team_matches


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
    # feature-store passthrough: the alias SEED is IPL-only, but the model is
    # trained on every league/T20I ingested into team_matches. Any team/venue
    # the model actually has history for resolves to its stored canonical name,
    # so internationals and non-IPL sides aren't hard-skipped. Explicit alias
    # rows still handle spelling variants (e.g. Bangalore -> Bengaluru).
    if kind == "team":
        # a team appears in both `team` and `opponent` columns across rows;
        # match either side and return the stored (canonical-cased) value.
        row = conn.execute(
            sa.select(team_matches.c.team, team_matches.c.opponent)
            .where(
                sa.or_(
                    sa.func.lower(team_matches.c.team) == n,
                    sa.func.lower(team_matches.c.opponent) == n,
                )
            )
            .limit(1)
        ).first()
        if row:
            return row.team if _norm(row.team) == n else row.opponent
    else:
        row = conn.execute(
            sa.select(team_matches.c.venue)
            .where(sa.func.lower(team_matches.c.venue) == n)
            .limit(1)
        ).first()
        if row:
            return row[0]
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
