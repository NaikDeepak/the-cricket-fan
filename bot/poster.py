"""X API v2 posting with dry-run and monthly quota circuit breaker.

Priority when near quota: prediction > result > trivia.
"""

import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING

import requests
import sqlalchemy as sa

from .config import Settings
from .db import posts

if TYPE_CHECKING:
    import tweepy

logger = logging.getLogger(__name__)

TRIVIA_CUTOFF = 450  # at/above: stop trivia
RESULTS_ONLY_CUTOFF = 490  # at/above: results only
X_REQUEST_TIMEOUT_S = 10


class _TimeoutSession(requests.Session):
    """tweepy.Client takes no timeout parameter; without one a stalled
    create_tweet() call can block a tick indefinitely."""

    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", X_REQUEST_TIMEOUT_S)
        return super().request(*args, **kwargs)


def month_post_count(conn, now: datetime) -> int:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return conn.execute(
        sa.select(sa.func.count())
        .select_from(posts)
        .where(posts.c.state == "posted", posts.c.posted_at >= start)
    ).scalar_one()


def allowed(post_type: str, count: int) -> bool:
    if count >= RESULTS_ONLY_CUTOFF:
        return post_type == "result"
    if count >= TRIVIA_CUTOFF:
        return post_type not in ("trivia", "standalone_trivia")
    return True


class Poster:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None

    def _x_client(self) -> "tweepy.Client":
        if self._client is None:
            import tweepy

            self._client = tweepy.Client(
                consumer_key=self.settings.x_api_key,
                consumer_secret=self.settings.x_api_secret,
                access_token=self.settings.x_access_token,
                access_token_secret=self.settings.x_access_token_secret,
            )
            self._client.session = _TimeoutSession()
        return self._client

    def send(self, text: str) -> bool:
        if self.settings.dry_run:
            print(f"DRY RUN POST:\n{text}\n")
            summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary_path:
                with open(summary_path, "a") as f:
                    f.write(f"### Tweet (copy/paste)\n```\n{text}\n```\n\n")
            return True
        try:
            self._x_client().create_tweet(text=text)
            return True
        except Exception:
            logger.exception("X post failed")
            summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary_path:
                with open(summary_path, "a") as f:
                    f.write(f"### Post FAILED — copy/paste manually\n```\n{text}\n```\n\n")
            return False
