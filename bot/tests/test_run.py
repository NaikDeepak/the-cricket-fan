from datetime import date, datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.db import fixtures, posts, predictions, team_matches
from bot.fixtures_provider import Fixture, Result
from bot.predict import load_artifact
from bot.run import _home_team_at_venue, tick
from bot.tests.test_predict import _artifact

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning"
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)


class FakeProvider:
    def __init__(self, fixtures_list, results_list):
        self._f, self._r = fixtures_list, results_list

    def fetch(self, conn):
        return self._f, self._r


class SpyPoster:
    def __init__(self, ok=True, thread_sent=None):
        self.sent, self.ok = [], ok
        self.threads = []
        # thread_sent=None -> full success; an int -> that many segments posted
        self.thread_sent = thread_sent

    def send(self, text):
        self.sent.append(text)
        return self.ok

    def send_thread(self, segments):
        self.threads.append(segments)
        if self.thread_sent is None:
            return True, len(segments)
        return self.thread_sent == len(segments), self.thread_sent


def _fixture(match_id="m1", hours_from_now=2.5):
    return Fixture(
        provider_match_id=match_id,
        team_a="Chennai Super Kings",
        team_b="Mumbai Indians",
        venue="Wankhede Stadium, Mumbai",
        league="IPL",
        start_time=NOW + timedelta(hours=hours_from_now),
    )


@pytest.fixture
def art(tmp_path):
    return load_artifact(_artifact(tmp_path))


@pytest.fixture
def conn(engine):
    with engine.connect() as c:
        seed_aliases(c)
        # minimal history so features/trivia have data
        for i in range(6):
            c.execute(
                team_matches.insert().values(
                    team="Chennai Super Kings",
                    opponent="Mumbai Indians",
                    date=date(2026, 6, 1 + i),
                    season="2026",
                    league="IPL",
                    venue="Wankhede Stadium, Mumbai",
                    won=i % 2 == 0,
                    dls=False,
                    runs_scored=160.0,
                    overs_faced=20.0,
                    runs_conceded=155.0,
                    overs_bowled=20.0,
                    home=False,
                )
            )
            c.execute(
                team_matches.insert().values(
                    team="Mumbai Indians",
                    opponent="Chennai Super Kings",
                    date=date(2026, 6, 1 + i),
                    season="2026",
                    league="IPL",
                    venue="Wankhede Stadium, Mumbai",
                    won=i % 2 == 1,
                    dls=False,
                    runs_scored=155.0,
                    overs_faced=20.0,
                    runs_conceded=160.0,
                    overs_bowled=20.0,
                    home=True,
                )
            )
        yield c


def _post_states(conn, match_id="m1"):
    fid = conn.execute(
        sa.select(fixtures.c.id).where(fixtures.c.provider_match_id == match_id)
    ).scalar_one()
    rows = conn.execute(
        sa.select(posts.c.post_type, posts.c.state).where(posts.c.fixture_id == fid)
    ).all()
    return {r.post_type: r.state for r in rows}


def test_home_team_at_venue_infers_from_history():
    import pandas as pd

    df = pd.DataFrame(
        [
            {
                "team": "Mumbai Indians",
                "venue": "Wankhede Stadium, Mumbai",
                "home": True,
            },
            {
                "team": "Chennai Super Kings",
                "venue": "Wankhede Stadium, Mumbai",
                "home": False,
            },
        ]
    )
    assert (
        _home_team_at_venue(
            df, "Wankhede Stadium, Mumbai", "Chennai Super Kings", "Mumbai Indians"
        )
        == "Mumbai Indians"
    )


def test_home_team_at_venue_neutral_when_no_history():
    import pandas as pd

    df = pd.DataFrame(columns=["team", "venue", "home"])
    assert _home_team_at_venue(df, "Some New Stadium", "Team A", "Team B") is None


def test_prediction_posted_inside_window(conn, art):
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=2.5)], []), art, poster, NOW)
    states = _post_states(conn)
    assert states["prediction"] == "posted"
    assert states.get("trivia", "scheduled") == "scheduled"  # T-1h not reached
    assert len(poster.sent) == 1 and "%" in poster.sent[0]
    assert (
        conn.execute(sa.select(sa.func.count()).select_from(predictions)).scalar_one()
        == 1
    )


def test_upsert_fixtures_syncs_reschedule(conn, art):
    """Cricket fixtures get rescheduled (rain, ground changes). A tracked
    fixture whose venue/start_time changes upstream must not be stuck with
    stale values forever."""
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=5)], []), art, poster, NOW)

    rescheduled = _fixture(hours_from_now=2.5)
    rescheduled = Fixture(
        provider_match_id=rescheduled.provider_match_id,
        team_a=rescheduled.team_a,
        team_b=rescheduled.team_b,
        venue="Eden Gardens, Kolkata",
        league=rescheduled.league,
        start_time=rescheduled.start_time,
    )
    tick(conn, FakeProvider([rescheduled], []), art, poster, NOW + timedelta(minutes=5))

    row = conn.execute(
        sa.select(fixtures.c.venue, fixtures.c.start_time).where(
            fixtures.c.provider_match_id == "m1"
        )
    ).one()
    assert row.venue == "Eden Gardens, Kolkata"
    got = (
        row.start_time.replace(tzinfo=timezone.utc)
        if not row.start_time.tzinfo
        else row.start_time
    )
    assert got == rescheduled.start_time


def test_posted_state_survives_later_failure_in_same_tick(conn, art, monkeypatch):
    """A tweet already sent must not un-send itself if a later step in the same
    tick raises. The posts.state="posted" write has to be durable independent
    of the rest of the tick's transaction (see bot/run.py:_try_post commit)."""
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=2.5)], []), art, poster, NOW)
    assert _post_states(conn)["prediction"] == "posted"

    import bot.run as run_mod

    def boom(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(run_mod, "trivia_post", boom)
    with pytest.raises(RuntimeError):
        # Same fixture as tick #1 (unchanged start_time == NOW+2.5h); only
        # `now` advances, so trivia (not due at NOW) becomes due here.
        tick(
            conn,
            FakeProvider([_fixture(hours_from_now=2.5)], []),
            art,
            poster,
            NOW + timedelta(hours=2),
        )
    conn.rollback()
    assert _post_states(conn)["prediction"] == "posted"


def test_idempotent_second_tick_no_duplicate(conn, art):
    poster = SpyPoster()
    provider = FakeProvider([_fixture(hours_from_now=2.5)], [])
    tick(conn, provider, art, poster, NOW)
    tick(conn, provider, art, poster, NOW + timedelta(minutes=5))
    assert len(poster.sent) == 1


def test_trivia_posted_inside_one_hour(conn, art):
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=0.5)], []), art, poster, NOW)
    states = _post_states(conn)
    assert states["prediction"] == "posted" and states["trivia"] == "posted"


def test_late_tick_guard_abandons_prediction(conn, art):
    from bot.db import trivia_log

    conn.execute(trivia_log.insert().values(content_key="k", posted_at=NOW))
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=-0.5)], []), art, poster, NOW)
    states = _post_states(conn)
    assert states["prediction"] == "abandoned"
    assert poster.sent == []


def test_failed_post_retries_then_abandons(conn, art):
    bad = SpyPoster(ok=False)
    provider = FakeProvider([_fixture(hours_from_now=2.5)], [])
    for i in range(4):
        tick(conn, provider, art, bad, NOW + timedelta(minutes=i))
    states = _post_states(conn)
    assert states["prediction"] == "abandoned"
    assert len(bad.sent) == 3  # MAX_ATTEMPTS


def test_result_flow_correct_and_record(conn, art):
    from bot.db import trivia_log

    conn.execute(
        trivia_log.insert().values(content_key="k", posted_at=NOW + timedelta(hours=2))
    )
    poster = SpyPoster()
    provider = FakeProvider([_fixture(hours_from_now=2.5)], [])
    tick(conn, provider, art, poster, NOW)
    prob = conn.execute(sa.select(predictions.c.prob_team_a)).scalar_one()
    winner = "Chennai Super Kings" if prob >= 0.5 else "Mumbai Indians"
    done = FakeProvider([], [Result("m1", winner=winner, no_result=False)])
    tick(conn, done, art, poster, NOW + timedelta(hours=6))
    states = _post_states(conn)
    assert states["result"] == "posted"
    assert states["post_match_news"] == "posted"

    assert any("1/1" in msg for msg in poster.sent)
    assert "#TheCricketFan" in poster.sent[-1]



def test_abandoned_match_voids_prediction(conn, art):
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=2.5)], []), art, poster, NOW)
    void = FakeProvider([], [Result("m1", winner=None, no_result=True)])
    tick(conn, void, art, poster, NOW + timedelta(hours=6))
    assert conn.execute(sa.select(predictions.c.outcome)).scalar_one() == "void"
    assert _post_states(conn).get("result", "scheduled") != "posted"


def test_standalone_trivia_posts_when_no_fixture_and_no_recent_post(conn, art):
    poster = SpyPoster()
    now = datetime(
        2026, 7, 19, 8, 0, tzinfo=timezone.utc
    )  # any hour; never posted before
    tick(conn, FakeProvider([], []), art, poster, now)
    assert len(poster.sent) == 1
    row = conn.execute(
        sa.select(posts.c.post_type, posts.c.slot_key, posts.c.state)
    ).one()
    assert row.post_type == "standalone_trivia"
    assert row.slot_key == "2026-07-19-08"
    assert row.state == "posted"


def test_standalone_trivia_skipped_before_gap_elapses(conn, art):
    """Windowed gate, not exact-hour: scheduled ticks drift under GH Actions
    load, so a lone required hour would silently starve this path for days."""
    from bot.db import trivia_log

    conn.execute(
        trivia_log.insert().values(
            content_key="h2h:a:b",
            posted_at=datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc),
        )
    )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 9, 0, tzinfo=timezone.utc)  # only 1h since last post
    tick(conn, FakeProvider([], []), art, poster, now)
    assert poster.sent == []


def test_standalone_trivia_force_bypasses_cooldown(conn, art):
    """Manual workflow_dispatch (BOT_FORCE_TRIVIA=1) must be able to post
    on-demand even mid-cooldown -- e.g. to backfill after an outage."""
    from bot.db import trivia_log

    conn.execute(
        trivia_log.insert().values(
            content_key="h2h:a:b",
            posted_at=datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc),
        )
    )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 9, 0, tzinfo=timezone.utc)  # only 1h since last post
    tick(conn, FakeProvider([], []), art, poster, now, force_trivia=True)
    assert len(poster.sent) == 1


def test_standalone_trivia_force_still_skipped_when_fixture_within_24h(conn, art):
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 9, 0, tzinfo=timezone.utc)
    tick(
        conn,
        FakeProvider([_fixture(hours_from_now=5)], []),
        art,
        poster,
        now,
        force_trivia=True,
    )
    count = conn.execute(
        sa.select(sa.func.count())
        .select_from(posts)
        .where(posts.c.post_type == "standalone_trivia")
    ).scalar_one()
    assert count == 0


def test_standalone_trivia_skipped_when_fixture_within_24h(conn, art):
    """_post_states() is scoped to one fixture's posts via a fixture_id join,
    so it can never see standalone rows (fixture_id is always NULL for
    those) -- query the posts table directly for this check."""
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([_fixture(hours_from_now=5)], []), art, poster, now)
    count = conn.execute(
        sa.select(sa.func.count())
        .select_from(posts)
        .where(posts.c.post_type == "standalone_trivia")
    ).scalar_one()
    assert count == 0


def test_standalone_trivia_idempotent_within_same_slot(conn, art):
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    tick(conn, FakeProvider([], []), art, poster, now + timedelta(minutes=5))
    assert len(poster.sent) == 1


def test_standalone_trivia_logs_content_key_on_success(conn, art):
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    valid_keys = {c[0] for c in build_candidates(_load_team_matches(conn))}
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    keys = conn.execute(sa.select(trivia_log.c.content_key)).scalars().all()
    assert len(keys) == 1
    assert keys[0] in valid_keys


def test_standalone_trivia_not_logged_on_send_failure(conn, art):
    from bot.db import trivia_log

    bad = SpyPoster(ok=False)
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, bad, now)
    count = conn.execute(
        sa.select(sa.func.count()).select_from(trivia_log)
    ).scalar_one()
    assert count == 0


def test_standalone_trivia_respects_30_day_dedup(conn, art):
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    all_keys = {c[0] for c in build_candidates(_load_team_matches(conn))}
    assert (
        len(all_keys) >= 2
    )  # fixture must offer >1 candidate for this test to prove anything
    kept, *excluded = sorted(
        all_keys
    )  # deterministic: keep exactly one candidate available
    for key in excluded:
        conn.execute(
            trivia_log.insert().values(
                content_key=key,
                posted_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
            )
        )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    keys = (
        conn.execute(
            sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at == now)
        )
        .scalars()
        .all()
    )
    assert keys == [kept]  # the only non-excluded candidate must be the one picked


def _seed_thread(conn):
    from datetime import datetime, timezone

    from bot.db import content_bank

    conn.execute(
        content_bank.insert().values(
            category="story",
            format="thread",
            segments_json='["Bodyline 1/3", "Bodyline 2/3", "Bodyline 3/3"]',
            content_key="story:bodyline",
            source="wikipedia:Bodyline",
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
    )


def test_standalone_thread_posts_all_segments_and_counts_tweets(conn, art):
    _seed_thread(conn)
    # exclude every Cricsheet key so the thread is the only pick
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    for key in {c[0] for c in build_candidates(_load_team_matches(conn))}:
        conn.execute(
            trivia_log.insert().values(
                content_key=key, posted_at=datetime(2026, 7, 18, tzinfo=timezone.utc)
            )
        )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    assert poster.threads == [["Bodyline 1/3", "Bodyline 2/3", "Bodyline 3/3"]]
    row = conn.execute(
        sa.select(posts.c.state, posts.c.tweet_count, posts.c.text).where(
            posts.c.post_type == "standalone_trivia"
        )
    ).one()
    assert row.state == "posted"
    assert row.tweet_count == 3
    assert row.text == "Bodyline 1/3"  # first segment stored for the summary path
    keys = (
        conn.execute(
            sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at == now)
        )
        .scalars()
        .all()
    )
    assert keys == ["story:bodyline"]


def test_standalone_thread_partial_failure_records_partial_state(conn, art):
    _seed_thread(conn)
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    for key in {c[0] for c in build_candidates(_load_team_matches(conn))}:
        conn.execute(
            trivia_log.insert().values(
                content_key=key, posted_at=datetime(2026, 7, 18, tzinfo=timezone.utc)
            )
        )
    poster = SpyPoster(thread_sent=1)  # tweet 1 posts, tweet 2 fails
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    row = conn.execute(
        sa.select(posts.c.state, posts.c.tweet_count, posts.c.posted_at).where(
            posts.c.post_type == "standalone_trivia"
        )
    ).one()
    assert row.state == "partial"
    assert row.tweet_count == 1
    assert row.posted_at is not None  # partial's live tweet must count toward quota
    # partially-public content is logged so it is not reposted
    keys = (
        conn.execute(
            sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at == now)
        )
        .scalars()
        .all()
    )
    assert keys == ["story:bodyline"]


def test_standalone_four_segment_thread_blocked_near_quota_cutoff(conn, art):
    """A 4-tweet thread at month count 449 would push the total to 452 -- past
    the 450 standalone cutoff. The quota preflight projects the LAST tweet's
    count (449 + 4 - 1 = 452) and skips the whole thread; a bare count check
    (449 < 450) would wrongly let it post and overshoot."""
    from bot.db import content_bank, trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    conn.execute(
        content_bank.insert().values(
            category="story",
            format="thread",
            segments_json='["s1", "s2", "s3", "s4"]',
            content_key="story:fourpart",
            source="wikipedia:X",
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
    )
    for key in {c[0] for c in build_candidates(_load_team_matches(conn))}:
        conn.execute(
            trivia_log.insert().values(
                content_key=key, posted_at=datetime(2026, 7, 18, tzinfo=timezone.utc)
            )
        )
    # One posted row carrying 449 tweets this month -> month_post_count == 449.
    conn.execute(
        posts.insert().values(
            post_type="standalone_trivia",
            state="posted",
            tweet_count=449,
            posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
        )
    )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    assert poster.threads == []  # projected 452 >= 450 -> thread skipped whole
    assert poster.sent == []
    logged = (
        conn.execute(
            sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at == now)
        )
        .scalars()
        .all()
    )
    assert logged == []  # nothing posted -> nothing logged
