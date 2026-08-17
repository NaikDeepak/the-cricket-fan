from bot.league_keywords import (
    LEAGUE_KEYWORDS,
    WOMENS_ONLY_LABELS,
    match_league_keyword,
)


def test_matches_ipl():
    assert match_league_keyword("Indian Premier League 2026") == "IPL"


def test_matches_mens_t20_blast():
    assert match_league_keyword("Vitality T20 Blast 2026") == "T20 Blast"


def test_matches_womens_t20_blast_not_mens_keyword():
    # Regression: "women's t20 blast" contains "t20 blast" as a substring,
    # so ordering must put the women's entry first or this returns the
    # men's label instead.
    assert (
        match_league_keyword("Vitality Women's T20 Blast 2026") == "Women's T20 Blast"
    )


def test_matches_super_smash_women_not_mens_keyword():
    assert match_league_keyword("Dream11 Super Smash Women 2026") == "Super Smash Women"


def test_matches_mens_super_smash():
    assert match_league_keyword("Dream11 Super Smash 2026") == "Super Smash"


def test_case_insensitive():
    assert match_league_keyword("INDIAN PREMIER LEAGUE 2026") == "IPL"


def test_no_match_returns_none():
    assert (
        match_league_keyword("Women's T20I Quadrangular Series in Namibia 2026") is None
    )


def test_matches_womens_big_bash_not_mens_keyword():
    # Regression: "big bash league" is a substring of "Women's Big Bash League",
    # so ordering must put the women's entry first or this returns the
    # men's label instead.
    assert match_league_keyword("Women's Big Bash League 2026") == "WBBL"


def test_matches_womens_caribbean_premier_league_not_mens_keyword():
    # Regression: "caribbean premier league" is a substring of "Women's Caribbean Premier League",
    # so ordering must put the women's entry first or this returns the
    # men's label instead.
    assert match_league_keyword("Women's Caribbean Premier League 2026") == "WCPL"


def test_apostrophe_variant_still_matches():
    # Regression: CricAPI's actual apostrophe surface form (straight `'`,
    # curly U+2019, or none at all) for women's competitions is unknown —
    # all three must resolve to the same label.
    assert match_league_keyword("Vitality Womens T20 Blast 2026") == "Women's T20 Blast"
    assert (
        match_league_keyword("Vitality Women’s T20 Blast 2026") == "Women's T20 Blast"
    )


def test_womens_super_smash_word_order_now_covered():
    # This exact phrasing ("Women's Super Smash", not "Super Smash Women")
    # is now a directly mapped alias (owner-supplied real CricAPI data),
    # so it correctly resolves rather than falling through to the safety
    # net — the earlier version of this table only had "super smash women"
    # and this input would have hit the bare men's keyword + safety net
    # instead. Superseded by test_bare_mens_keyword_does_not_win_on_womens_input
    # below, which exercises the safety net with an input that genuinely
    # has no matching women's alias.
    assert match_league_keyword("Women's Super Smash 2026") == "Super Smash Women"


def test_bare_mens_keyword_does_not_win_on_womens_input():
    # Structural safety net: if the input clearly signals "women's" but the
    # only substring match found is a bare men's-competition label, return
    # None (safe fallback) rather than silently mislabeling as the men's
    # league. Constructed so no women's-specific alias matches (no
    # "t20 blast" variant here contains "xyz"), only the bare "t20 blast"
    # keyword does — and the input signals "women's" via an unrelated
    # phrase, the exact false-positive risk the label-membership check
    # (not keyword-text check) is designed to catch.
    assert match_league_keyword("Women's XYZ T20 Blast Exhibition 2026") is None


def test_short_code_alias_not_suppressed_by_unrelated_women_substring():
    # Regression for the risk the label-membership safety net specifically
    # fixes: "wbbl" itself doesn't contain "women", so a text-based safety
    # check would have wrongly suppressed this genuinely-correct WBBL match
    # just because "women" appears elsewhere in the input. Label-membership
    # (WBBL is in WOMENS_ONLY_LABELS) correctly allows it through.
    assert (
        match_league_keyword("ICC Women's Championship Feeder - WBBL Playoff 2026")
        == "WBBL"
    )


def test_womens_only_labels_all_appear_in_league_keywords():
    labels_in_table = {label for _, label in LEAGUE_KEYWORDS}
    assert WOMENS_ONLY_LABELS <= labels_in_table


# Real CricAPI series names supplied by the repo owner (from their own
# CricAPI research, not guessed) — the strongest evidence available for
# each of the 22 mapped leagues. Two examples per league where the owner
# supplied two (a sponsor-prefixed full name and a short form), one where
# only one was supplied.
SAMPLES: list[tuple[str, str]] = [
    ("Weber Women's Big Bash League 2025", "WBBL"),
    ("WBBL 11", "WBBL"),
    ("Massy Women's Caribbean Premier League 2025", "WCPL"),
    ("WCPL 2025", "WCPL"),
    ("Tata Women's Premier League 2026", "WPL"),
    ("WPL 2026", "WPL"),
    ("Vitality Women's T20 Blast 2025", "Women's T20 Blast"),
    ("Women's T20 Blast", "Women's T20 Blast"),
    ("Dream11 Women's Super Smash 2025-26", "Super Smash Women"),
    ("Charlotte Edwards Cup 2025", "Charlotte Edwards Cup"),
    ("FairBreak Invitational T20", "FairBreak"),
    ("FairBreak Global 2023", "FairBreak"),
    ("Tata Indian Premier League 2026", "IPL"),
    ("IPL 2026", "IPL"),
    ("KFC Big Bash League 2025-26", "BBL"),
    ("BBL|15", "BBL"),
    ("HBL Pakistan Super League 2026", "PSL"),
    ("PSL 11", "PSL"),
    ("Republic Bank Caribbean Premier League 2026", "CPL"),
    ("CPL 2026", "CPL"),
    ("Betway SA20 2026", "SA20"),
    ("SA20 Season 4", "SA20"),
    ("Cognizant Major League Cricket 2026", "MLC"),
    ("MLC 2026", "MLC"),
    ("DP World International League T20 2026", "ILT20"),
    ("ILT20 2026", "ILT20"),
    ("Lanka Premier League 2026", "LPL"),
    ("LPL 2026", "LPL"),
    ("Bangladesh Premier League 2026", "BPL"),
    ("BPL 2026", "BPL"),
    ("Mzansi Super League 2019", "MSL"),
    ("MSL T20", "MSL"),
    ("Nepal Premier League 2025-26", "NPL"),
    ("Siddhartha Bank NPL", "NPL"),
    ("CSA T20 Challenge 2025-26", "CSA T20"),
    ("CSA Provincial T20", "CSA T20"),
    ("Syed Mushtaq Ali Trophy 2025-26", "SMAT"),
    ("SMAT 2025", "SMAT"),
    ("Vitality Blast 2026", "T20 Blast"),
    ("Vitality T20 Blast", "T20 Blast"),
    ("Dream11 Super Smash 2025-26", "Super Smash"),
]


def test_samples_cover_every_canonical_label():
    labels_in_samples = {label for _, label in SAMPLES}
    labels_in_table = {label for _, label in LEAGUE_KEYWORDS}
    assert labels_in_samples == labels_in_table, (
        "SAMPLES must cover every canonical label in LEAGUE_KEYWORDS — "
        f"missing: {labels_in_table - labels_in_samples}, "
        f"unexpected: {labels_in_samples - labels_in_table}"
    )


def test_samples_resolve_to_expected_label():
    for series_name, expected_label in SAMPLES:
        actual = match_league_keyword(series_name)
        assert actual == expected_label, (
            f"match_league_keyword({series_name!r}) == {actual!r}, "
            f"expected {expected_label!r}"
        )
