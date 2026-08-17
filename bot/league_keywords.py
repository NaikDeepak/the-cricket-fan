"""Keyword table mapping CricAPI series_info tournament names to the
canonical short league labels bot/scripts/ingest_all_leagues.py's LEAGUES
list defines.

Ordering is load-bearing: a women's competition's keyword is checked
before its men's counterpart's keyword, because e.g. "women's t20 blast"
contains "t20 blast" as a substring and would otherwise match the men's
entry first.

Deliberately excludes (see docs/superpowers/specs/2026-08-17-fixture-
league-resolution-design.md's "Keyword table" section for why):
- "The Hundred" / "The Hundred Women" — handled by
  bot/fixtures_provider.py::_resolve_league's existing dedicated
  substring check against the match name, before this table is
  consulted at all.
- "T20I" / "WT20I" — no single stable series name across bilateral
  tours; the raw-name fallback already carries enough signal.
- "WSL" / "Women's T20 Challenge" — real-world CricAPI naming for these
  two wasn't confirmed at design time; add entries here once known,
  following the same (keyword, canonical_label) tuple shape.
"""

LEAGUE_KEYWORDS: list[tuple[str, str]] = [
    ("indian premier league", "IPL"),
    ("women's big bash", "WBBL"),  # before the bare entry below
    ("big bash league", "BBL"),
    ("pakistan super league", "PSL"),
    ("women's caribbean premier league", "WCPL"),  # before the bare entry below
    ("caribbean premier league", "CPL"),
    ("sa20", "SA20"),
    ("major league cricket", "MLC"),
    ("international league t20", "ILT20"),
    ("lanka premier league", "LPL"),
    ("bangladesh premier league", "BPL"),
    ("mzansi super league", "MSL"),
    ("nepal premier league", "NPL"),
    ("csa t20", "CSA T20"),
    ("syed mushtaq ali", "SMAT"),
    ("women's premier league", "WPL"),
    ("charlotte edwards cup", "Charlotte Edwards Cup"),
    ("women's t20 blast", "Women's T20 Blast"),  # before the bare entry below
    ("t20 blast", "T20 Blast"),
    ("super smash women", "Super Smash Women"),  # before the bare entry below
    ("super smash", "Super Smash"),
    ("fairbreak", "FairBreak"),
]


def match_league_keyword(series_name: str) -> str | None:
    """Case-insensitive substring match against LEAGUE_KEYWORDS, in order.
    Returns the first matching canonical label, or None if nothing
    matches — callers fall back to the existing raw-name behavior.
    """
    low = series_name.lower()
    for keyword, label in LEAGUE_KEYWORDS:
        if keyword in low:
            return label
    return None
