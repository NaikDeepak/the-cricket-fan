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
from .db import fixtures, posts, predictions, team_matches, trivia_log
from .features import build_features
from .poster import allowed, month_post_count
from .predict import predict
from .trivia_standalone import pick_standalone_trivia

logger = logging.getLogger(__name__)

PREDICTION_WINDOW_H = 3
TRIVIA_WINDOW_H = 1
MAX_ATTEMPTS = 3
STANDALONE_TRIVIA_MIN_GAP_H = (
    5  # ~3x/day cadence; window (not exact hour) survives cron drift
)
TRIVIA_LOG_LOOKBACK_DAYS = 30


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
            conn.execute(
                fixtures.update()
                .where(fixtures.c.id == exists.id)
                .values(venue=f.venue, start_time=f.start_time, league=f.league)
            )
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


def _try_post(conn, poster, post_row, text: str, now: datetime) -> bool:
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning(
            "quota breaker: skipping %s (month count %d)", post_row.post_type, count
        )
        return False
    ok = poster.send(text)
    attempts = post_row.attempts + 1
    if ok:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="posted", attempts=attempts, text=text, posted_at=now)
        )
        posted = True
    elif attempts >= MAX_ATTEMPTS:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="abandoned", attempts=attempts, text=text)
        )
        logger.error(
            "abandoning %s post after %d attempts", post_row.post_type, attempts
        )
        posted = False
    else:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="failed", attempts=attempts, text=text)
        )
        posted = False
    # Commit immediately: poster.send() is an irreversible external side effect.
    # If a later step in this tick raises, only this state update must survive
    # the rollback -- otherwise the next tick would resend an already-posted tweet.
    conn.commit()
    return posted


def _post_standalone(conn, poster, post_row, fmt: str, segments: list[str], now) -> int:
    """Post a standalone single or thread. Returns tweets_sent (0 == nothing
    posted). Sets state posted/partial/failed and, when any tweet lands,
    tweet_count + posted_at. No retry/abandon: standalone rows are slot-keyed
    and single-attempt, matching the existing quiet-day design."""
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning(
            "quota breaker: skipping %s (month count %d)", post_row.post_type, count
        )
        return 0
    if fmt == "thread":
        all_ok, tweets_sent = poster.send_thread(segments)
    else:
        all_ok = poster.send(segments[0])
        tweets_sent = 1 if all_ok else 0
    if tweets_sent == 0:
        state = "failed"
    elif all_ok:
        state = "posted"
    else:
        state = "partial"
    values = {"state": state, "attempts": post_row.attempts + 1, "text": segments[0]}
    if tweets_sent > 0:
        values["posted_at"] = now
        values["tweet_count"] = tweets_sent
    conn.execute(posts.update().where(posts.c.id == post_row.id).values(**values))
    conn.commit()  # irreversible external side effect must survive a later raise
    return tweets_sent


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


def _has_upcoming_fixture_within_24h(conn, now: datetime) -> bool:
    rows = conn.execute(
        sa.select(fixtures.c.start_time).where(fixtures.c.status == "upcoming")
    ).all()
    for r in rows:
        start = (
            r.start_time
            if r.start_time.tzinfo
            else r.start_time.replace(tzinfo=timezone.utc)
        )
        if now <= start <= now + timedelta(hours=24):
            return True
    return False


def _recent_trivia_keys(conn, now: datetime) -> set[str]:
    cutoff = now - timedelta(days=TRIVIA_LOG_LOOKBACK_DAYS)
    rows = conn.execute(
        sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at >= cutoff)
    ).all()
    return {r.content_key for r in rows}


def _standalone_trivia_due(conn, now: datetime) -> bool:
    """Windowed, not exact-hour: scheduled cron ticks drift/skip under GH Actions
    load, so requiring now.hour to land on a specific value silently starves
    this path for days. Firing once the gap since the last post clears the
    threshold is robust to that drift and still idempotent via slot_key.
    """
    last = conn.execute(sa.select(sa.func.max(trivia_log.c.posted_at))).scalar_one()
    if last is None:
        return True
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return now - last >= timedelta(hours=STANDALONE_TRIVIA_MIN_GAP_H)


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


def _home_team_at_venue(
    df: pd.DataFrame, venue: str, team_a: str, team_b: str
) -> str | None:
    """Which of team_a/team_b is historically the home side at this venue.

    The live fixtures feed carries no home/away designation, so this infers it
    from team_matches.home (populated by cricsheet parsing) rather than
    hardcoding a second team->city mapping that could drift from cricsheet.py.
    Returns None for neutral venues / no history, matching training-time
    behavior where home_a/home_b are both 0.
    """
    if not len(df):
        return None
    at_venue = df[(df["venue"] == venue) & (df["home"])]
    if not len(at_venue):
        return None
    counts = at_venue["team"].value_counts()
    for team in (team_a, team_b):
        if team in counts.index:
            return team
    return None


def tick(
    conn, provider, artifact, poster, now: datetime, *, force_trivia: bool = False
) -> None:
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
        home_team = _home_team_at_venue(df, r.venue, r.team_a, r.team_b)
        feats = build_features(
            df, r.team_a, r.team_b, r.venue, now.date(), home_team=home_team
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

    # Standalone trivia (quiet-day filler, no fixture involved)
    if (force_trivia or _standalone_trivia_due(conn, now)) and not (
        _has_upcoming_fixture_within_24h(conn, now)
    ):
        slot_key = now.strftime("%Y-%m-%d-%H")
        existing_slot = conn.execute(
            sa.select(posts.c.id).where(posts.c.slot_key == slot_key)
        ).first()
        if not existing_slot:
            recent_keys = _recent_trivia_keys(conn, now)
            picked = pick_standalone_trivia(df, recent_keys, conn)
            if picked:
                content_key, fmt, segments = picked
                post_id = None
                try:
                    with conn.begin_nested():
                        post_id = conn.execute(
                            posts.insert().values(
                                fixture_id=None,
                                post_type="standalone_trivia",
                                state="scheduled",
                                attempts=0,
                                slot_key=slot_key,
                            )
                        ).inserted_primary_key[0]
                except sa.exc.IntegrityError:
                    logger.info(
                        "standalone trivia slot %s already claimed; skipping", slot_key
                    )
                if post_id is not None:
                    post_row = conn.execute(
                        sa.select(posts).where(posts.c.id == post_id)
                    ).one()
                    tweets_sent = _post_standalone(
                        conn, poster, post_row, fmt, segments, now
                    )
                    if tweets_sent > 0:
                        conn.execute(
                            trivia_log.insert().values(
                                content_key=content_key, posted_at=now
                            )
                        )
                        conn.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    from .config import get_settings
    from .db import ensure_schema, get_engine
    from .fixtures_provider import CricApiProvider
    from .poster import Poster
    from .predict import load_artifact

    settings = get_settings()
    engine = get_engine(settings.database_url)
    artifact = load_artifact(
        Path(__file__).resolve().parent / "artifacts" / "model.pkl"
    )
    provider = CricApiProvider(settings.cricket_api_base, settings.cricket_api_key)
    poster = Poster(settings)
    with engine.connect() as conn:
        ensure_schema(conn)
        conn.commit()
        tick(
            conn,
            provider,
            artifact,
            poster,
            datetime.now(timezone.utc),
            force_trivia=settings.force_trivia,
        )
        conn.commit()


if __name__ == "__main__":
    main()
