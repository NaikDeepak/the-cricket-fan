"""Keyword table mapping CricAPI series_info tournament names to the
canonical short league labels bot/scripts/ingest_all_leagues.py's LEAGUES
list defines.

Ordering is load-bearing: every women's-competition alias is listed
before any men's-competition alias, because e.g. "women's t20 blast"
contains "t20 blast" as a substring and would otherwise match the men's
entry first. Within a canonical label's own aliases, order doesn't
matter (they all resolve to the same label).

Deliberately excludes (see docs/superpowers/specs/2026-08-17-fixture-
league-resolution-design.md's "Keyword table" section for why):
- "The Hundred" / "The Hundred Women" — handled by
  bot/fixtures_provider.py::_resolve_league's existing dedicated
  substring check against the match name, before this table is
  consulted at all.
- "T20I" / "WT20I" — no single stable series name across bilateral
  tours; the raw-name fallback already carries enough signal.
- "WSL" / "Women's T20 Challenge" — real-world CricAPI naming for these
  two isn't confirmed yet; add entries here once known, following the
  same (keyword, canonical_label) tuple shape.

Data provenance: the 22 mapped leagues' aliases (including title-sponsor
variants like "Tata IPL", "Weber WBBL", "HBL PSL") were supplied by the
repo owner from their own CricAPI research, replacing an earlier
single-alias-per-league table that was drafted from general knowledge
only. Still not verified against a live production run — no automated
observability in this branch's own ingestion path surfaces an unmatched
league yet. (Separately, PR #15 — already merged to feature/mvp, but not
yet in this branch's own tree — adds per-league routing logs to
composer/routers/predictions.py::run_model; once this branch merges,
that logging becomes a secondary signal for catching an unmatched
league, once a retrain populates league_elo_override. It does not exist
in this file's own module today.)
"""

WOMENS_ONLY_LABELS: frozenset[str] = frozenset(
    {
        "WBBL",
        "WCPL",
        "WPL",
        "Women's T20 Blast",
        "Super Smash Women",
        "Charlotte Edwards Cup",
        "FairBreak",
    }
)

LEAGUE_KEYWORDS: list[tuple[str, str]] = [
    # --- Women's competitions (must precede any men's alias they contain) ---
    ("womens big bash", "WBBL"),
    ("wbbl", "WBBL"),
    ("weber wbbl", "WBBL"),
    ("weber womens big bash", "WBBL"),
    ("womens caribbean premier league", "WCPL"),
    ("wcpl", "WCPL"),
    ("massy wcpl", "WCPL"),
    ("massy womens cpl", "WCPL"),
    ("womens premier league", "WPL"),
    ("wpl", "WPL"),
    ("tata wpl", "WPL"),
    ("tata womens premier league", "WPL"),
    ("womens t20 blast", "Women's T20 Blast"),
    ("vitality womens t20 blast", "Women's T20 Blast"),
    ("ecb womens t20 blast", "Women's T20 Blast"),
    ("super smash women", "Super Smash Women"),
    ("womens super smash", "Super Smash Women"),
    ("dream11 womens super smash", "Super Smash Women"),
    ("charlotte edwards cup", "Charlotte Edwards Cup"),
    ("charlotte edwards", "Charlotte Edwards Cup"),
    ("fairbreak", "FairBreak"),
    ("fairbreak invitational", "FairBreak"),
    ("fairbreak global", "FairBreak"),
    ("fairbreak t20", "FairBreak"),
    # --- Men's / mixed competitions ---
    ("indian premier league", "IPL"),
    ("ipl", "IPL"),
    ("tata ipl", "IPL"),
    ("big bash league", "BBL"),
    ("bbl", "BBL"),
    ("kfc bbl", "BBL"),
    ("kfc big bash league", "BBL"),
    ("pakistan super league", "PSL"),
    ("psl", "PSL"),
    ("hbl psl", "PSL"),
    ("hbl pakistan super league", "PSL"),
    ("caribbean premier league", "CPL"),
    ("cpl", "CPL"),
    ("republic bank cpl", "CPL"),
    ("sa20", "SA20"),
    ("betway sa20", "SA20"),
    ("south africa t20", "SA20"),
    ("major league cricket", "MLC"),
    ("mlc", "MLC"),
    ("cognizant major league cricket", "MLC"),
    ("cognizant mlc", "MLC"),
    ("international league t20", "ILT20"),
    ("ilt20", "ILT20"),
    ("dp world ilt20", "ILT20"),
    ("dp world international league t20", "ILT20"),
    ("lanka premier league", "LPL"),
    ("lpl", "LPL"),
    ("bangladesh premier league", "BPL"),
    ("bpl", "BPL"),
    ("mzansi super league", "MSL"),
    ("msl", "MSL"),
    ("nepal premier league", "NPL"),
    ("npl", "NPL"),
    ("siddhartha bank npl", "NPL"),
    ("csa t20 challenge", "CSA T20"),
    ("csa provincial t20", "CSA T20"),
    ("csa 4-day t20", "CSA T20"),
    ("csa t20 knock-out", "CSA T20"),
    ("csa t20", "CSA T20"),
    ("syed mushtaq ali trophy", "SMAT"),
    ("syed mushtaq ali", "SMAT"),
    ("mushtaq ali trophy", "SMAT"),
    ("smat", "SMAT"),
    ("vitality t20 blast", "T20 Blast"),
    ("vitality blast", "T20 Blast"),
    ("natwest t20 blast", "T20 Blast"),
    ("twenty20 cup", "T20 Blast"),
    ("t20 blast", "T20 Blast"),
    ("dream11 super smash", "Super Smash"),
    ("burger king super smash", "Super Smash"),
    ("mens super smash", "Super Smash"),
    ("super smash", "Super Smash"),
]


def match_league_keyword(series_name: str) -> str | None:
    """Case-insensitive substring match against LEAGUE_KEYWORDS, in order.
    Returns the first matching canonical label, or None if nothing
    matches — callers fall back to the existing raw-name behavior.

    Apostrophes (ASCII `'` and the Unicode right single quotation mark
    U+2019) are stripped from the lowercased input before matching, since
    it's unknown which surface form CricAPI actually emits for women's
    competitions — LEAGUE_KEYWORDS' apostrophe-bearing entries are
    written in their stripped form (e.g. "womens big bash") to match.
    canonical_league label values themselves are untouched.

    Structural safety net: a match whose *canonical label* is not in
    WOMENS_ONLY_LABELS is rejected — returning None instead — if the
    input contains "women" or "girls" anywhere, so a men's-competition
    label can never silently win on an input that clearly signals
    "women's". This checks the matched label's membership in
    WOMENS_ONLY_LABELS rather than scanning the matched keyword's own
    text, specifically because several correct women's-competition
    aliases (e.g. "wbbl", "wcpl", "wpl") don't themselves contain the
    substring "women" — a text-based check would have created false
    suppressions of genuinely-correct women's matches whenever the input
    also happened to contain "women" via an unrelated phrase elsewhere
    in the string. Label-membership is the reliable signal.
    """
    low = series_name.lower().replace("’", "").replace("'", "")
    for keyword, label in LEAGUE_KEYWORDS:
        if keyword in low:
            if label not in WOMENS_ONLY_LABELS and ("women" in low or "girls" in low):
                return None
            return label
    return None
