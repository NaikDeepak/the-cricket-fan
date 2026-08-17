from bot.league_keywords import LEAGUE_KEYWORDS, match_league_keyword


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


def test_bare_mens_keyword_does_not_win_on_womens_input():
    # Structural safety net: if the input clearly signals "women's" but the
    # only substring match found is a bare men's keyword, return None
    # (safe fallback) rather than silently mislabeling as the men's league.
    assert match_league_keyword("Women's Super Smash 2026") is None


# One realistic full series name per LEAGUE_KEYWORDS entry, paired with the
# expected canonical label. Mechanizes catching the same bug class Fixes 2/4
# describe: every entry in the table must actually be reachable and correct
# via a plausible real-world series name, not just the keyword substring in
# isolation.
SAMPLES: list[tuple[str, str]] = [
    ("Indian Premier League 2026", "IPL"),
    ("Women's Big Bash League 2026", "WBBL"),
    ("KFC Big Bash League 2026", "BBL"),
    ("Pakistan Super League 2026", "PSL"),
    ("Women's Caribbean Premier League 2026", "WCPL"),
    ("Caribbean Premier League 2026", "CPL"),
    ("SA20 2026", "SA20"),
    ("Major League Cricket 2026", "MLC"),
    ("International League T20 2026", "ILT20"),
    ("Lanka Premier League 2026", "LPL"),
    ("Bangladesh Premier League 2026", "BPL"),
    ("Mzansi Super League 2026", "MSL"),
    ("Nepal Premier League 2026", "NPL"),
    ("CSA T20 Challenge 2026", "CSA T20"),
    ("Syed Mushtaq Ali Trophy 2026", "SMAT"),
    ("Women's Premier League 2026", "WPL"),
    ("Charlotte Edwards Cup 2026", "Charlotte Edwards Cup"),
    ("Vitality Women's T20 Blast 2026", "Women's T20 Blast"),
    ("Vitality T20 Blast 2026", "T20 Blast"),
    ("Dream11 Super Smash Women 2026", "Super Smash Women"),
    ("Dream11 Super Smash 2026", "Super Smash"),
    ("FairBreak Invitational T20 2026", "FairBreak"),
]


def test_samples_cover_every_league_keyword_entry():
    assert len(SAMPLES) == len(LEAGUE_KEYWORDS), (
        "SAMPLES must have one entry per LEAGUE_KEYWORDS row — add a sample "
        "for any newly added keyword"
    )


def test_samples_resolve_to_expected_label():
    for series_name, expected_label in SAMPLES:
        actual = match_league_keyword(series_name)
        assert actual == expected_label, (
            f"match_league_keyword({series_name!r}) == {actual!r}, "
            f"expected {expected_label!r}"
        )
