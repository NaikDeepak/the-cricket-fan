"""Tests for news_fetcher module."""

from unittest.mock import MagicMock, patch
from bot.news_fetcher import fetch_match_news_article, get_match_recap_tweet


def test_fetch_match_news_article_success():
    mock_rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Google News</title>
        <item>
          <title>India beat Australia in last-over thriller - ESPNcricinfo</title>
          <link>https://example.com/match-report</link>
          <description>&lt;p&gt;VVS Laxman scored a brilliant century to guide India home.&lt;/p&gt;</description>
        </item>
      </channel>
    </rss>"""

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = mock_rss_xml

    with patch("requests.get", return_value=mock_resp):
        article = fetch_match_news_article("India", "Australia")
        assert article is not None
        assert article["headline"] == "India beat Australia in last-over thriller"
        assert "Laxman" in article["summary"]
        assert article["source_url"] == "https://example.com/match-report"


def test_get_match_recap_tweet_includes_branding():
    mock_rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Google News</title>
        <item>
          <title>CSK triumph over MI in IPL classic - Cricbuzz</title>
          <link>https://example.com/csk-mi</link>
          <description>Dhoni hits last-ball six to secure dramatic victory for Chennai Super Kings.</description>
        </item>
      </channel>
    </rss>"""

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = mock_rss_xml

    with patch("requests.get", return_value=mock_resp):
        tweet = get_match_recap_tweet("CSK", "MI")
        assert "#TheCricketFan" in tweet
        assert "#Cricket" in tweet
        assert "CSK vs MI" in tweet
        assert len(tweet) <= 280
