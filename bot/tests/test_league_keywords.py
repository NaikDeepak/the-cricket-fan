from bot.league_keywords import match_league_keyword


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
