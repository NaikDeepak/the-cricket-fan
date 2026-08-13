"""Fetch and extract latest news recap articles for completed matches using Google News RSS feeds."""

import logging
import urllib.parse
import xml.etree.ElementTree as ET
import requests

from .compose import format_post_match_news_tweet

logger = logging.getLogger(__name__)

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"


def fetch_match_news_article(team_a: str, team_b: str, timeout: float = 10.0) -> dict | None:
    """Fetch the latest news article matching team_a vs team_b match report."""
    query = f'"{team_a}" "{team_b}" match report cricket'
    params = {
        "q": query,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }
    url = f"{GOOGLE_NEWS_RSS_URL}?{urllib.parse.urlencode(params)}"
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "the-cricket-fan/1.0"},
            timeout=timeout,
        )
        if resp.status_code != 200:
            logger.warning("Google News RSS returned status %d", resp.status_code)
            return None
        root = ET.fromstring(resp.text)
        channel = root.find("channel")
        if channel is None:
            return None
        item = channel.find("item")
        if item is None:
            return None
        title = item.findtext("title") or f"{team_a} vs {team_b} Recap"
        link = item.findtext("link") or ""
        description = item.findtext("description") or ""

        # Clean description HTML tags if any
        import re

        clean_desc = re.sub(r"<[^>]+>", "", description).strip()
        # Use first line or short sentence from description
        summary = clean_desc.split(".")[0] + "." if clean_desc else "Match analysis and highlights."

        return {
            "headline": title.split(" - ")[0],  # Strip publisher name from Google RSS title
            "summary": summary[:120],
            "source_url": link,
        }
    except Exception as e:
        logger.warning("Failed to fetch match news for %s vs %s: %s", team_a, team_b, e)
        return None


def get_match_recap_tweet(team_a: str, team_b: str) -> str:
    """Fetch latest match news article and transform into branded tweet."""
    article = fetch_match_news_article(team_a, team_b)
    if article:
        return format_post_match_news_tweet(
            team_a,
            team_b,
            article["headline"],
            article["summary"],
            source_url=article["source_url"],
        )
    # Fallback if news RSS is unreachable or empty
    return format_post_match_news_tweet(
        team_a,
        team_b,
        "Match Concluded!",
        f"{team_a} and {team_b} finished a thriller today.",
    )
