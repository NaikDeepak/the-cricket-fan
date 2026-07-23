from datetime import datetime, timezone

from bot.db import content_events, drafts, predictions


def _mk_draft(conn, category="anecdote"):
    return conn.execute(
        drafts.insert().values(
            source="freeform",
            category=category,
            text="x",
            status="draft",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    ).inserted_primary_key[0]


def test_funnel_counts_distinct_drafts(client, conn):
    d1 = _mk_draft(conn)
    d2 = _mk_draft(conn)
    for d in (d1, d2):
        conn.execute(
            content_events.insert().values(
                draft_id=d,
                action="generated",
                created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
            )
        )
    # d1 copied 3 times -> counts once in the distinct funnel, 3 in raw totals
    for _ in range(3):
        conn.execute(
            content_events.insert().values(
                draft_id=d1,
                action="copied",
                created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
            )
        )
    conn.commit()
    a = client.get("/analytics").json()
    assert a["funnel"] == {"generated": 2, "copied": 1, "posted": 0}
    assert a["event_totals"]["copied"] == 3


def test_prediction_record_matches_season_record(client, conn):
    conn.execute(
        predictions.insert().values(
            fixture_id=1,
            prob_team_a=0.6,
            reasons_json="[]",
            features_json="{}",
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
            outcome="correct",
        )
    )
    conn.execute(
        predictions.insert().values(
            fixture_id=2,
            prob_team_a=0.6,
            reasons_json="[]",
            features_json="{}",
            created_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
            outcome="incorrect",
        )
    )
    conn.commit()
    a = client.get("/analytics").json()
    assert a["prediction_record"] == {"correct": 1, "total": 2}
