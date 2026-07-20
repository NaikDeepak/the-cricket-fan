"""X API v2 posting with dry-run and monthly quota circuit breaker.

Priority when near quota: prediction > result > trivia.
"""
import logging
from datetime import datetime

import sqlalchemy as sa

from .config import Settings
from .db import posts

logger = logging.getLogger(__name__)

TRIVIA_CUTOFF = 450        # at/above: stop trivia
RESULTS_ONLY_CUTOFF = 490  # at/above: results only


def month_post_count(conn, now: datetime) -> int:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return conn.execute(
        sa.select(sa.func.count()).select_from(posts).where(
            posts.c.state == "posted", posts.c.posted_at >= start)
    ).scalar_one()


def allowed(post_type: str, count: int) -> bool:
    if count >= RESULTS_ONLY_CUTOFF:
        return post_type == "result"
    if count >= TRIVIA_CUTOFF:
        return post_type != "trivia"
    return True


class Poster:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None

    def _x_client(self):
        if self._client is None:
            import tweepy
            self._client = tweepy.Client(
                consumer_key=self.settings.x_api_key,
                consumer_secret=self.settings.x_api_secret,
                access_token=self.settings.x_access_token,
                access_token_secret=self.settings.x_access_token_secret,
            )
        return self._client

    def send(self, text: str) -> bool:
        if self.settings.dry_run:
            print(f"DRY RUN POST:\n{text}\n")
            return True
        try:
            self._x_client().create_tweet(text=text)
            return True
        except Exception:
            logger.exception("X post failed")
            return False
