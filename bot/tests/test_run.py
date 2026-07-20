from datetime import date, datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.db import fixtures, posts, predictions, team_matches
from bot.fixtures_provider import Fixture, Result
from bot.predict import load_artifact
from bot.run import tick
from bot.tests.test_predict import _artifact

pytestmark = pytest.mark.filterwarnings(
    "ignore:LightGBM binary classifier.*:UserWarning")

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)


class FakeProvider:
    def __init__(self, fixtures_list, results_list):
        self._f, self._r = fixtures_list, results_list

    def fetch(self, conn):
        return self._f, self._r


class SpyPoster:
    def __init__(self, ok=True):
        self.sent, self.ok = [], ok

    def send(self, text):
        self.sent.append(text)
        return self.ok


def _fixture(match_id="m1", hours_from_now=2.5):
    return Fixture(provider_match_id=match_id, team_a="Chennai Super Kings",
                   team_b="Mumbai Indians", venue="Wankhede Stadium, Mumbai",
                   league="IPL", start_time=NOW + timedelta(hours=hours_from_now))


@pytest.fixture()
def art(tmp_path):
    return load_artifact(_artifact(tmp_path))


@pytest.fixture()
def conn(engine):
    with engine.begin() as c:
        seed_aliases(c)
        # minimal history so features/trivia have data
        for i in range(6):
            c.execute(team_matches.insert().values(
                team="Chennai Super Kings", opponent="Mumbai Indians",
                date=date(2026, 6, 1 + i), season="2026", league="IPL",
                venue="Wankhede Stadium, Mumbai", won=i % 2 == 0, dls=False,
                runs_scored=160.0, overs_faced=20.0, runs_conceded=155.0,
                overs_bowled=20.0, home=False))
            c.execute(team_matches.insert().values(
                team="Mumbai Indians", opponent="Chennai Super Kings",
                date=date(2026, 6, 1 + i), season="2026", league="IPL",
                venue="Wankhede Stadium, Mumbai", won=i % 2 == 1, dls=False,
                runs_scored=155.0, overs_faced=20.0, runs_conceded=160.0,
                overs_bowled=20.0, home=True))
        yield c


def _post_states(conn, match_id="m1"):
    fid = conn.execute(sa.select(fixtures.c.id).where(
        fixtures.c.provider_match_id == match_id)).scalar_one()
    rows = conn.execute(sa.select(posts.c.post_type, posts.c.state).where(
        posts.c.fixture_id == fid)).all()
    return {r.post_type: r.state for r in rows}


def test_prediction_posted_inside_window(conn, art):
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=2.5)], []), art, poster, NOW)
    states = _post_states(conn)
    assert states["prediction"] == "posted"
    assert states.get("trivia", "scheduled") == "scheduled"  # T-1h not reached
    assert len(poster.sent) == 1 and "%" in poster.sent[0]
    assert conn.execute(sa.select(sa.func.count()).select_from(
        predictions)).scalar_one() == 1


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
    assert len(bad.sent) == 3   # MAX_ATTEMPTS


def test_result_flow_correct_and_record(conn, art):
    poster = SpyPoster()
    provider = FakeProvider([_fixture(hours_from_now=2.5)], [])
    tick(conn, provider, art, poster, NOW)
    prob = conn.execute(sa.select(predictions.c.prob_team_a)).scalar_one()
    winner = "Chennai Super Kings" if prob >= 0.5 else "Mumbai Indians"
    done = FakeProvider([], [Result("m1", winner=winner, no_result=False)])
    tick(conn, done, art, poster, NOW + timedelta(hours=6))
    assert conn.execute(sa.select(predictions.c.outcome)).scalar_one() == "correct"
    states = _post_states(conn)
    assert states["result"] == "posted"
    assert "1/1" in poster.sent[-1]


def test_abandoned_match_voids_prediction(conn, art):
    poster = SpyPoster()
    tick(conn, FakeProvider([_fixture(hours_from_now=2.5)], []), art, poster, NOW)
    void = FakeProvider([], [Result("m1", winner=None, no_result=True)])
    tick(conn, void, art, poster, NOW + timedelta(hours=6))
    assert conn.execute(sa.select(predictions.c.outcome)).scalar_one() == "void"
    assert _post_states(conn).get("result", "scheduled") != "posted"
