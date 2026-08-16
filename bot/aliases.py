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
    # International teams & abbreviations
    ("team", "ind", "India"),
    ("team", "aus", "Australia"),
    ("team", "eng", "England"),
    ("team", "pak", "Pakistan"),
    ("team", "sa", "South Africa"),
    ("team", "nz", "New Zealand"),
    ("team", "wi", "West Indies"),
    ("team", "sl", "Sri Lanka"),
    ("team", "ban", "Bangladesh"),
    ("team", "afg", "Afghanistan"),
    ("team", "ned", "Netherlands"),
    ("team", "ire", "Ireland"),
    ("team", "zim", "Zimbabwe"),
    ("team", "usa", "United States of America"),
    ("team", "united states", "United States of America"),
    # The Hundred (Men & Women) & Rebranded Names
    #
    # Manchester Super Giants, Sunrisers Leeds, and MI London are NOT
    # renames of Manchester Originals / Northern Superchargers / London
    # Spirit — team_matches has independent historical rows (own team AND
    # opponent columns) for all six names. Aliasing the new names to the
    # old ones (as this table used to) silently merged two different
    # clubs' ELO/form/run-rate history into one canonical identity,
    # corrupting predictions for every match involving any of them. Each
    # now resolves to its own canonical name; old-name rows are kept
    # unchanged so historical seasons under those names still resolve.
    ("team", "tre", "Trent Rockets"),
    ("team", "trent rockets", "Trent Rockets"),
    ("team", "msg", "Manchester Super Giants"),
    ("team", "manchester super giants", "Manchester Super Giants"),
    ("team", "mo", "Manchester Originals"),
    ("team", "manchester originals", "Manchester Originals"),
    ("team", "ls", "London Spirit"),
    ("team", "london spirit", "London Spirit"),
    ("team", "mil", "MI London"),
    ("team", "mi london", "MI London"),
    ("team", "oi", "Oval Invincibles"),
    ("team", "oval invincibles", "Oval Invincibles"),
    ("team", "sb", "Southern Brave"),
    ("team", "southern brave", "Southern Brave"),
    ("team", "wf", "Welsh Fire"),
    ("team", "welsh fire", "Welsh Fire"),
    ("team", "nsc", "Northern Superchargers"),
    ("team", "northern superchargers", "Northern Superchargers"),
    ("team", "srl", "Sunrisers Leeds"),
    ("team", "sunrisers leeds", "Sunrisers Leeds"),
    ("team", "bp", "Birmingham Phoenix"),
    ("team", "birmingham phoenix", "Birmingham Phoenix"),
    # The Hundred Women
    ("team", "trew", "Trent Rockets Women"),
    ("team", "trent rockets women", "Trent Rockets Women"),
    ("team", "nscw", "Northern Superchargers Women"),
    ("team", "northern superchargers women", "Northern Superchargers Women"),
    # "Sunrisers Leeds Women" has no team_matches history yet (brand-new
    # 2026 side, unlike the men's team which already has independent
    # rows) — no direct DB proof, but the men's-side merge above was
    # definitively wrong for the identical rename pattern, so this stays
    # its own canonical rather than repeating that mistake preemptively.
    # Retracts 70ea32b's "sulw" fix, which repointed it at Northern
    # Superchargers Women instead.
    ("team", "sulw", "Sunrisers Leeds Women"),
    ("team", "sunrisers leeds women", "Sunrisers Leeds Women"),
    ("team", "milw", "MI London Women"),
    ("team", "mi london women", "MI London Women"),
    ("team", "bpw", "Birmingham Phoenix Women"),
    ("team", "birmingham phoenix women", "Birmingham Phoenix Women"),
    ("team", "lsw", "London Spirit Women"),
    ("team", "london spirit women", "London Spirit Women"),
    ("team", "mow", "Manchester Originals Women"),
    ("team", "manchester originals women", "Manchester Originals Women"),
    ("team", "oiw", "Oval Invincibles Women"),
    ("team", "oval invincibles women", "Oval Invincibles Women"),
    ("team", "sbw", "Southern Brave Women"),
    ("team", "southern brave women", "Southern Brave Women"),
    ("team", "wfw", "Welsh Fire Women"),
    ("team", "welsh fire women", "Welsh Fire Women"),
    # WPL
    ("team", "rcbw", "Royal Challengers Bengaluru Women"),
    ("team", "miw", "Mumbai Indians Women"),
    ("team", "dcw", "Delhi Capitals Women"),
    ("team", "upw", "UP Warriorz"),
    ("team", "ggw", "Gujarat Giants Women"),
    # WBBL
    ("team", "asw", "Adelaide Strikers Women"),
    ("team", "bhw", "Brisbane Heat Women"),
    ("team", "hhw", "Hobart Hurricanes Women"),
    ("team", "mrw", "Melbourne Renegades Women"),
    ("team", "msw", "Melbourne Stars Women"),
    ("team", "psw", "Perth Scorchers Women"),
    ("team", "ssw", "Sydney Sixers Women"),
    ("team", "stw", "Sydney Thunder Women"),
    # Venues
    ("venue", "lord's", "Lord's, London"),
    ("venue", "lord's, london", "Lord's, London"),
    ("venue", "the oval", "Kennington Oval, London"),
    ("venue", "the oval, london", "Kennington Oval, London"),
    ("venue", "trent bridge", "Trent Bridge, Nottingham"),
    ("venue", "trent bridge, nottingham", "Trent Bridge, Nottingham"),
    ("venue", "headingley", "Headingley, Leeds"),
    ("venue", "headingley, leeds", "Headingley, Leeds"),
    ("venue", "edgbaston", "Edgbaston, Birmingham"),
    ("venue", "edgbaston, birmingham", "Edgbaston, Birmingham"),
    ("venue", "old trafford", "Old Trafford, Manchester"),
    ("venue", "old trafford, manchester", "Old Trafford, Manchester"),
    ("venue", "sophia gardens", "Sophia Gardens, Cardiff"),
    ("venue", "sophia gardens, cardiff", "Sophia Gardens, Cardiff"),
    ("venue", "the rose bowl", "The Rose Bowl, Southampton"),
    ("venue", "the rose bowl, southampton", "The Rose Bowl, Southampton"),
    ("venue", "m.chinnaswamy stadium", "M Chinnaswamy Stadium, Bengaluru"),
    ("venue", "m.chinnaswamy stadium, bengaluru", "M Chinnaswamy Stadium, Bengaluru"),
    ("venue", "wankhede stadium", "Wankhede Stadium, Mumbai"),
    ("venue", "wankhede stadium, mumbai", "Wankhede Stadium, Mumbai"),
    ("venue", "eden gardens", "Eden Gardens, Kolkata"),
    ("venue", "eden gardens, kolkata", "Eden Gardens, Kolkata"),
    ("venue", "arun jaitley stadium", "Arun Jaitley Stadium, Delhi"),
    ("venue", "arun jaitley stadium, delhi", "Arun Jaitley Stadium, Delhi"),
    ("venue", "ma chidambaram stadium", "MA Chidambaram Stadium, Chepauk, Chennai"),
    ("venue", "narendra modi stadium", "Narendra Modi Stadium, Ahmedabad"),
    # CricAPI prefixes the current sponsor name; Cricsheet doesn't.
    ("venue", "emirates old trafford, manchester", "Old Trafford, Manchester"),
]


def seed_aliases(conn) -> None:
    """Insert new SEED rows, and correct the canonical of any row already in
    the DB whose value has drifted from SEED (e.g. a since-fixed bad merge
    like msg -> Manchester Originals) — previously insert-only, so a SEED
    correction silently no-op'd against a DB that already had the wrong
    row, leaving it wrong forever.
    """
    for kind, alias, canonical in SEED:
        existing = conn.execute(
            sa.select(aliases.c.id, aliases.c.canonical).where(
                aliases.c.kind == kind, aliases.c.alias == alias
            )
        ).first()
        if existing is None:
            conn.execute(
                aliases.insert().values(kind=kind, alias=alias, canonical=canonical)
            )
        elif existing.canonical != canonical:
            conn.execute(
                aliases.update()
                .where(aliases.c.id == existing.id)
                .values(canonical=canonical)
            )
