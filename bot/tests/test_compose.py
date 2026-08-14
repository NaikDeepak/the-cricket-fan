from datetime import date

import pandas as pd

from bot.compose import (
    FEATURE_PHRASES,
    format_post_match_news_tweet,
    live_prediction_post,
    prediction_post,
    result_post,
    trivia_post,
)
from bot.features import FEATURE_NAMES

BANNED = ["bet", "odds", "stake", "wager", "gamble"]


def _tm(team, opp, *, won, venue="Wankhede Stadium, Mumbai", d=date(2025, 4, 1)):
    return dict(
        team=team,
        opponent=opp,
        date=d,
        season="2025",
        league="IPL",
        venue=venue,
        won=won,
        dls=False,
        runs_scored=160.0,
        overs_faced=20.0,
        runs_conceded=150.0,
        overs_bowled=20.0,
        home=False,
    )


def test_every_feature_has_phrase():
    assert set(FEATURE_PHRASES) == set(FEATURE_NAMES)


def test_prediction_post_length_and_content():
    text = prediction_post(
        "Chennai Super Kings",
        "Mumbai Indians",
        0.64,
        ["form5_a", "bat_rr_a", "h2h_a_rate"],
        "IPL",
    )
    assert len(text) <= 280
    assert "64%" in text and "Chennai Super Kings" in text
    assert all(b not in text.lower() for b in BANNED)


def test_prediction_post_unknown_feature_falls_back():
    text = prediction_post("A", "B", 0.55, ["mystery_feature"], "IPL")
    assert len(text) <= 280  # falls back to generic phrase, no KeyError


def test_prediction_post_long_content_keeps_branding_tag():
    """Near the 280 limit, the branding tag must survive truncation, not get
    sliced off along with the rest of the content (regression for blind
    text[:277] truncation that cut the tag)."""
    text = prediction_post(
        "Royal Challengers Bangalore",
        "Kolkata Knight Riders",
        0.64,
        [
            "form5_a",
            "form5_b",
            "form10_a",
            "form10_b",
            "h2h_a_rate",
            "venue_a_rate",
            "venue_b_rate",
            "venue_avg_1st_innings",
            "venue_chase_win_rate",
            "bat_rr_a",
            "bat_rr_b",
            "bowl_econ_a",
            "bowl_econ_b",
            "bat_pp_rr_a",
            "bat_pp_rr_b",
            "bowl_death_econ_a",
            "bowl_death_econ_b",
            "home_a",
            "home_b",
        ],
        "Indian Premier League",
    )
    assert "#TheCricketFan" in text
    assert len(text) <= 280


def test_trivia_h2h_when_enough_meetings():
    rows = [
        _tm("A", "B", won=True),
        _tm("A", "B", won=True),
        _tm("A", "B", won=False),
        _tm("B", "A", won=False),
        _tm("B", "A", won=False),
        _tm("B", "A", won=True),
    ]
    text = trivia_post(pd.DataFrame(rows), "A", "B", "Somewhere")
    assert "2" in text and len(text) <= 280  # A leads 2-1


def test_trivia_venue_stat_uses_home_win_rate_not_all_rows():
    """team_matches has two rows per match (one per team's perspective), so
    naively averaging `won` over all venue rows is tautologically ~50% (every
    match contributes exactly one win and one loss). The stat must be
    computed over one side per match (home) to be meaningful."""
    venue = "Eden Gardens, Kolkata"
    rows = []
    for _ in range(4):
        rows.append(_tm("Home Team", "Away Team", won=True, venue=venue))
        rows[-1]["home"] = True
        rows.append(_tm("Away Team", "Home Team", won=False, venue=venue))
    rows.append(_tm("Home Team", "Away Team", won=False, venue=venue))
    rows[-1]["home"] = True
    rows.append(_tm("Away Team", "Home Team", won=True, venue=venue))
    # Naive all-rows average: 5 wins / 10 rows = 50%. Home-only: 4/5 = 80%.
    text = trivia_post(pd.DataFrame(rows), "X", "Y", venue)
    assert "80%" in text
    assert "50%" not in text


def test_trivia_falls_back_to_venue_then_generic():
    venue_rows = []
    for _ in range(6):
        venue_rows.append(_tm("C", "D", won=True))
        venue_rows[-1]["home"] = True
    text = trivia_post(pd.DataFrame(venue_rows), "A", "B", "Wankhede Stadium, Mumbai")
    assert len(text) <= 280
    assert "100%" in text  # exercises the venue branch, not the generic fallback
    empty = trivia_post(
        pd.DataFrame([], columns=list(_tm("x", "y", won=True))), "A", "B", "Nowhere"
    )
    assert len(empty) <= 280 and "A" in empty


def test_result_post_correct_and_wrong():
    right = result_post("A", "B", 0.64, "A", season_correct=23, season_total=31)
    wrong = result_post("A", "B", 0.64, "B", season_correct=23, season_total=31)
    assert "23/31" in right and len(right) <= 280
    assert "23/31" in wrong and len(wrong) <= 280
    assert right != wrong


def test_post_match_news_tweet_never_truncates_url_mid_string():
    """Regression: Google News RSS links are long redirect URLs (200-500
    chars). Truncating from the tail to fit 280 chars can slice straight
    through the URL, producing a broken link. The URL must either appear in
    full, or the "Read: {url}" clause must be dropped entirely."""
    long_url = (
        "https://news.google.com/rss/articles/"
        "CBMiqAFBVV95cUxNc29tZVZlcnlMb25nQmFzZTY0RW5jb2RlZFN0cmluZ1RoYXRSZXByZXNlbnRz"
        "QVJlYWxHb29nbGVOZXdzUlNTQXJ0aWNsZUxpbmtXaXRoTW9yZVRoYW4yMDBDaGFyYWN0ZXJzSW5J"
        "dFRvU2ltdWxhdGVBUmVhbGlzdGljUmVkaXJlY3RVUkxUaGF0SXNWZXJ5TG9uZ0FuZFVudHJ1bmNh"
        "dGFibGVBbmRIYXNFbm91Z2hDaGFyYWN0ZXJzVG9FeGNlZWRUaHJlZUh1bmRyZWRUb3RhbA"
        "?oc=5"
    )
    assert len(long_url) > 300

    tweet = format_post_match_news_tweet(
        "Chennai Super Kings",
        "Mumbai Indians",
        "Dhoni Magic Seals Last-Ball Thriller",
        "A last-ball six from the finisher sealed a stunning chase after a "
        "roller-coaster middle overs collapse threatened to derail the innings.",
        source_url=long_url,
    )

    assert len(tweet) <= 280
    assert "#TheCricketFan" in tweet
    if "Read:" in tweet:
        # URL must be complete, never a partial/broken fragment.
        assert f"Read: {long_url}" in tweet
    else:
        assert long_url not in tweet


def test_post_match_news_tweet_short_url_included_as_before():
    tweet = format_post_match_news_tweet(
        "CSK",
        "MI",
        "CSK triumph over MI in IPL classic",
        "Dhoni hits last-ball six to secure dramatic victory for Chennai Super Kings.",
        source_url="https://example.com/csk-mi",
    )
    assert len(tweet) <= 280
    assert "Read: https://example.com/csk-mi" in tweet
    assert "#TheCricketFan" in tweet


def test_live_prediction_post_phases_and_no_emojis():
    # Pre-match
    pre = live_prediction_post("CSK", "MI", 0.65, ["form5_a"], phase="pre_match", league="IPL")
    assert len(pre) <= 280
    assert "CSK 65% to beat MI" in pre
    assert "#TheCricketFan" in pre
    # Check no emojis in text
    assert all(ord(char) < 10000 for char in pre)

    # Innings break
    ib = live_prediction_post(
        "CSK",
        "MI",
        0.72,
        ["CSK total (185) is +20 above venue average"],
        phase="innings_break",
        score_summary="CSK 185/5",
    )
    assert len(ib) <= 280
    assert "INNINGS BREAK: CSK vs MI (CSK 185/5)" in ib
    assert "CSK 72% vs MI 28%" in ib
    assert "#TheCricketFan" in ib
    assert all(ord(char) < 10000 for char in ib)

    # Chase in progress
    chase = live_prediction_post(
        "CSK",
        "MI",
        0.40,
        ["MI need 45 off 30 balls"],
        phase="chase_in_progress",
        score_summary="MI 140/3 (15.0 ov)",
    )
    assert len(chase) <= 280
    assert "LIVE UPDATE: CSK vs MI (MI 140/3 (15.0 ov))" in chase
    assert "MI 60% vs CSK 40%" in chase
    assert "#TheCricketFan" in chase
    assert all(ord(char) < 10000 for char in chase)

