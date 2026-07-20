"""One idempotent cron tick. Window-based timing; cron is best-effort.

Flow: fetch -> upsert fixtures + schedule posts -> prediction window ->
trivia window -> late-tick guard -> results (accuracy log + result post).
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import sqlalchemy as sa

from .compose import prediction_post, result_post, trivia_post
from .db import fixtures, posts, predictions, team_matches
from .features import build_features
from .poster import allowed, month_post_count
from .predict import predict

logger = logging.getLogger(__name__)

PREDICTION_WINDOW_H = 3
TRIVIA_WINDOW_H = 1
MAX_ATTEMPTS = 3


def _load_team_matches(conn) -> pd.DataFrame:
    rows = conn.execute(sa.select(team_matches)).mappings().all()
    return pd.DataFrame([dict(r) for r in rows])


def _upsert_fixtures(conn, fixture_list) -> None:
    for f in fixture_list:
        exists = conn.execute(
            sa.select(fixtures.c.id).where(
                fixtures.c.provider_match_id == f.provider_match_id
            )
        ).first()
        if exists:
            continue
        fid = conn.execute(
            fixtures.insert().values(
                provider_match_id=f.provider_match_id,
                team_a=f.team_a,
                team_b=f.team_b,
                venue=f.venue,
                league=f.league,
                start_time=f.start_time,
                status="upcoming",
            )
        ).inserted_primary_key[0]
        for post_type in ("prediction", "trivia"):
            conn.execute(
                posts.insert().values(
                    fixture_id=fid, post_type=post_type, state="scheduled", attempts=0
                )
            )


def _try_post(conn, poster, post_row, text: str, now: datetime) -> None:
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning(
            "quota breaker: skipping %s (month count %d)", post_row.post_type, count
        )
        return
    ok = poster.send(text)
    attempts = post_row.attempts + 1
    if ok:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="posted", attempts=attempts, text=text, posted_at=now)
        )
    elif attempts >= MAX_ATTEMPTS:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="abandoned", attempts=attempts)
        )
        logger.error(
            "abandoning %s post after %d attempts", post_row.post_type, attempts
        )
    else:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="failed", attempts=attempts)
        )


def _due(conn, post_type: str, window_h: float, now: datetime):
    """Scheduled/failed posts of type whose fixture starts within window (not started)."""
    rows = conn.execute(
        sa.select(
            posts,
            fixtures.c.team_a,
            fixtures.c.team_b,
            fixtures.c.venue,
            fixtures.c.league,
            fixtures.c.start_time,
            fixtures.c.id.label("fid"),
        )
        .join(fixtures, fixtures.c.id == posts.c.fixture_id)
        .where(
            posts.c.post_type == post_type,
            posts.c.state.in_(["scheduled", "failed"]),
            fixtures.c.status == "upcoming",
        )
    ).all()
    due, late = [], []
    for r in rows:
        start = (
            r.start_time
            if r.start_time.tzinfo
            else r.start_time.replace(tzinfo=timezone.utc)
        )
        if start <= now:
            late.append(r)
        elif start - now <= timedelta(hours=window_h):
            due.append(r)
    return due, late


def _season_record(conn) -> tuple[int, int]:
    total = conn.execute(
        sa.select(sa.func.count())
        .select_from(predictions)
        .where(predictions.c.outcome.in_(["correct", "incorrect"]))
    ).scalar_one()
    correct = conn.execute(
        sa.select(sa.func.count())
        .select_from(predictions)
        .where(predictions.c.outcome == "correct")
    ).scalar_one()
    return correct, total


def tick(conn, provider, artifact, poster, now: datetime) -> None:
    try:
        fixture_list, result_list = provider.fetch(conn)
    except Exception:
        logger.exception("provider fetch failed; skipping tick (never post stale)")
        return
    _upsert_fixtures(conn, fixture_list)
    df = _load_team_matches(conn)

    # Prediction window
    due, late = _due(conn, "prediction", PREDICTION_WINDOW_H, now)
    for r in due:
        feats = build_features(
            df, r.team_a, r.team_b, r.venue, now.date(), home_team=None
        )
        prob, reasons = predict(artifact, feats)
        existing = conn.execute(
            sa.select(predictions.c.id).where(predictions.c.fixture_id == r.fid)
        ).first()
        if not existing:
            conn.execute(
                predictions.insert().values(
                    fixture_id=r.fid,
                    prob_team_a=prob,
                    reasons_json=json.dumps(reasons),
                    features_json=json.dumps(feats),
                    created_at=now,
                    outcome="pending",
                )
            )
        text = prediction_post(r.team_a, r.team_b, prob, reasons, r.league)
        _try_post(conn, poster, r, text, now)
    for r in late:  # late-tick guard: never post at/after start
        conn.execute(posts.update().where(posts.c.id == r.id).values(state="abandoned"))
        logger.warning(
            "late-tick guard: abandoned %s for fixture %d", r.post_type, r.fid
        )

    # Trivia window
    due, late = _due(conn, "trivia", TRIVIA_WINDOW_H, now)
    for r in due:
        text = trivia_post(df, r.team_a, r.team_b, r.venue)
        _try_post(conn, poster, r, text, now)
    for r in late:
        conn.execute(posts.update().where(posts.c.id == r.id).values(state="abandoned"))

    # Results
    for res in result_list:
        frow = conn.execute(
            sa.select(fixtures).where(
                fixtures.c.provider_match_id == res.provider_match_id
            )
        ).first()
        if not frow or frow.status != "upcoming":
            continue
        pred = conn.execute(
            sa.select(predictions).where(predictions.c.fixture_id == frow.id)
        ).first()
        if res.no_result or res.winner is None:
            conn.execute(
                fixtures.update().where(fixtures.c.id == frow.id).values(status="void")
            )
            if pred:
                conn.execute(
                    predictions.update()
                    .where(predictions.c.id == pred.id)
                    .values(outcome="void")
                )
            continue
        conn.execute(
            fixtures.update()
            .where(fixtures.c.id == frow.id)
            .values(status="completed", winner=res.winner)
        )
        if not pred:
            continue  # never predicted (e.g. discovered too late) -> no result post
        predicted_a = pred.prob_team_a >= 0.5
        actual_a = res.winner == frow.team_a
        outcome = "correct" if predicted_a == actual_a else "incorrect"
        conn.execute(
            predictions.update()
            .where(predictions.c.id == pred.id)
            .values(outcome=outcome)
        )
        existing = conn.execute(
            sa.select(posts.c.id).where(
                posts.c.fixture_id == frow.id, posts.c.post_type == "result"
            )
        ).first()
        if not existing:
            conn.execute(
                posts.insert().values(
                    fixture_id=frow.id,
                    post_type="result",
                    state="scheduled",
                    attempts=0,
                )
            )
        prow = conn.execute(
            sa.select(posts).where(
                posts.c.fixture_id == frow.id,
                posts.c.post_type == "result",
                posts.c.state.in_(["scheduled", "failed"]),
            )
        ).first()
        if prow:
            correct, total = _season_record(conn)
            text = result_post(
                frow.team_a, frow.team_b, pred.prob_team_a, res.winner, correct, total
            )
            _try_post(conn, poster, prow, text, now)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    from .config import get_settings
    from .db import get_engine
    from .fixtures_provider import CricApiProvider
    from .poster import Poster
    from .predict import load_artifact

    settings = get_settings()
    engine = get_engine(settings.database_url)
    artifact = load_artifact(Path("bot/artifacts/model.pkl"))
    provider = CricApiProvider(settings.cricket_api_base, settings.cricket_api_key)
    poster = Poster(settings)
    with engine.begin() as conn:
        tick(conn, provider, artifact, poster, datetime.now(timezone.utc))


if __name__ == "__main__":
    main()
