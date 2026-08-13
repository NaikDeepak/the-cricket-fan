"""Post text composition. Everything <=280 chars, statistical language only."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)

FEATURE_PHRASES: dict[str, str] = {
    "form5_a": "recent form (last 5)",
    "form5_b": "opponent's recent form",
    "form10_a": "sustained form (last 10)",
    "form10_b": "opponent's sustained form",
    "h2h_a_rate": "head-to-head record",
    "venue_a_rate": "record at this venue",
    "venue_b_rate": "opponent's record at this venue",
    "venue_avg_1st_innings": "venue's typical first-innings total",
    "venue_chase_win_rate": "venue's chase-success rate",
    "bat_rr_a": "batting run-rate trend",
    "bat_rr_b": "opponent's batting run-rate",
    "bowl_econ_a": "bowling economy trend",
    "bowl_econ_b": "opponent's bowling economy",
    "bat_pp_rr_a": "powerplay batting tempo",
    "bat_pp_rr_b": "opponent's powerplay batting tempo",
    "bowl_death_econ_a": "death-overs bowling economy",
    "bowl_death_econ_b": "opponent's death-overs bowling economy",
    "home_a": "home advantage",
    "home_b": "opponent's home advantage",
}
GENERIC_PHRASE = "overall statistical edge"


def _phrase(feature: str) -> str:
    if feature not in FEATURE_PHRASES:
        logger.warning("no phrase for feature %s; using generic", feature)
        return GENERIC_PHRASE
    return FEATURE_PHRASES[feature]


def _truncate(text: str) -> str:
    return text if len(text) <= 280 else text[:277] + "..."


def _truncate_reserving_tag(content: str, tag: str) -> str:
    """Truncate content so the trailing branding tag always fits within 280 chars."""
    max_content_len = 280 - len(tag)
    if len(content) > max_content_len:
        content = content[: max_content_len - 3] + "..."
    return content + tag


def prediction_post(
    team_a: str, team_b: str, prob_a: float, reasons: list[str], league: str
) -> str:
    fav, other, p = (
        (team_a, team_b, prob_a) if prob_a >= 0.5 else (team_b, team_a, 1 - prob_a)
    )
    why = ", ".join(dict.fromkeys(_phrase(r) for r in reasons))
    tag = " #Cricket #TheCricketFan"
    content = (
        f"🔮 {league}: {fav} {round(p * 100)}% to beat {other}.\n"
        f"Why: {why}.\n"
        f"Model pick, publicly tracked."
    )
    return _truncate_reserving_tag(content, tag)


def trivia_post(df: pd.DataFrame, team_a: str, team_b: str, venue: str) -> str:
    tag = " #Cricket #TheCricketFan"
    if len(df):
        h2h = df[(df["team"] == team_a) & (df["opponent"] == team_b)]
        if len(h2h) >= 3:
            wins_a = int(h2h["won"].sum())
            content = (
                f"📊 {team_a} vs {team_b}: {team_a} lead {wins_a}-"
                f"{len(h2h) - wins_a} in their last {len(h2h)} meetings.\n"
                f"Today's chapter starts soon."
            )
            return _truncate_reserving_tag(content, tag)
        at_venue = df[df["venue"] == venue]
        # team_matches has one row per team per match; average over all rows
        # is tautologically ~50% (each match contributes one win, one loss).
        # Filter to the home side so the stat reflects one row per match.
        home_rows = at_venue[at_venue["home"]]
        if len(home_rows) >= 5:
            win_rate = home_rows["won"].mean()
            first = venue.split(",")[0]
            content = (
                f"📊 {first}: home teams have won "
                f"{round(win_rate * 100)}% of recent matches here.\n"
                f"{team_a} vs {team_b} today."
            )
            return _truncate_reserving_tag(content, tag)
    content = f"📊 {team_a} vs {team_b} today. Two lineups, one result. Numbers at stumps."
    return _truncate_reserving_tag(content, tag)


def result_post(
    team_a: str,
    team_b: str,
    prob_a: float,
    winner: str,
    season_correct: int,
    season_total: int,
) -> str:
    fav = team_a if prob_a >= 0.5 else team_b
    p = max(prob_a, 1 - prob_a)
    hit = winner == fav
    mark = "✅" if hit else "❌"
    verdict = "Called it" if hit else "Missed"
    tag = " #Cricket #TheCricketFan"
    content = (
        f"{mark} {verdict}: {fav} {round(p * 100)}% — {winner} won.\n"
        f"Season record: {season_correct}/{season_total}. "
        f"Every pick tracked, hits and misses."
    )
    return _truncate_reserving_tag(content, tag)


def format_post_match_news_tweet(
    team_a: str,
    team_b: str,
    headline: str,
    summary: str,
    source_url: str | None = None,
) -> str:
    """Format the post-match recap news tweet; branding tag always fits."""
    tag = "\n#Cricket #TheCricketFan"
    content = f"📰 {team_a} vs {team_b}: {headline}\n{summary}"
    if source_url:
        content += f"\nRead: {source_url}"
    return _truncate_reserving_tag(content, tag)


