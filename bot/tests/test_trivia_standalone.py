from datetime import date

import pandas as pd

from bot.trivia_standalone import build_candidates, pick_standalone_trivia


def _texts(df):
    """content_key -> first segment text, for the widened tuple shape."""
    return {key: segs[0] for key, _fmt, segs in build_candidates(df)}


def _row(
    team,
    opp,
    d,
    won,
    season="2026",
    venue="Wankhede Stadium, Mumbai",
    dls=False,
    rs=160.0,
    of=20.0,
    rc=150.0,
    ob=20.0,
    home=False,
    batted_first=True,
    pp_rs=None,
    pp_of=None,
    death_rc=None,
    death_ob=None,
):
    return dict(
        team=team,
        opponent=opp,
        date=d,
        season=season,
        league="IPL",
        venue=venue,
        won=won,
        dls=dls,
        runs_scored=rs,
        overs_faced=of,
        runs_conceded=rc,
        overs_bowled=ob,
        home=home,
        batted_first=batted_first,
        pp_runs_scored=pp_rs if pp_rs is not None else rs * 0.3,
        pp_overs_faced=pp_of if pp_of is not None else min(of, 6.0),
        death_runs_conceded=death_rc if death_rc is not None else rc * 0.3,
        death_overs_bowled=death_ob if death_ob is not None else min(ob, 5.0),
    )


def test_build_candidates_empty_df_returns_empty_list():
    assert build_candidates(pd.DataFrame()) == []


def test_h2h_candidate_needs_at_least_three_meetings():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1), True),
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 2), True),
    ]
    keys = {c[0] for c in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("h2h:") for k in keys)


def test_h2h_candidate_key_is_alphabetically_sorted_regardless_of_row_order():
    rows = [
        _row("Mumbai Indians", "Chennai Super Kings", date(2026, 4, 1), True),
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1), False),
        _row("Mumbai Indians", "Chennai Super Kings", date(2026, 4, 2), True),
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 2), False),
        _row("Mumbai Indians", "Chennai Super Kings", date(2026, 4, 3), True),
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 3), False),
    ]
    candidates = build_candidates(pd.DataFrame(rows))
    h2h_keys = [c[0] for c in candidates if c[0].startswith("h2h:")]
    assert h2h_keys == ["h2h:Chennai Super Kings:Mumbai Indians"]


def test_venue_candidate_needs_at_least_five_home_matches():
    rows = [
        _row("A", "B", date(2026, 4, 1 + i), i % 2 == 0, home=True) for i in range(4)
    ]
    keys = {c[0] for c in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("venue:") for k in keys)


def test_record_candidates_exclude_dls_matches():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, dls=True, rs=250.0, rc=100.0),
        _row("A", "B", date(2026, 4, 2), True, rs=180.0, rc=150.0),
    ]
    texts = _texts(pd.DataFrame(rows))
    total_text = texts.get("record:highest_total:2026", "")
    assert "250" not in total_text


def test_best_chase_candidate_requires_batted_second_and_won():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, batted_first=True, rs=190.0),
        _row("A", "B", date(2026, 4, 2), True, batted_first=False, rs=175.0),
        _row("A", "B", date(2026, 4, 3), False, batted_first=False, rs=120.0),
    ]
    texts = _texts(pd.DataFrame(rows))
    assert "175" in texts["record:best_chase:2026"]


def test_pp_tempo_candidate_needs_minimum_overs_faced():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, pp_rs=60.0, pp_of=2.0),  # too few overs
    ]
    keys = {c[0] for c in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("record:best_pp_tempo") for k in keys)


def test_death_economy_candidate_needs_minimum_overs_bowled():
    rows = [
        _row(
            "A", "B", date(2026, 4, 1), True, death_rc=5.0, death_ob=1.0
        ),  # too few overs
    ]
    keys = {c[0] for c in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("record:best_death_economy") for k in keys)


def test_all_candidate_texts_fit_tweet_length():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1 + i), i % 2 == 0)
        for i in range(6)
    ]
    for _key, _fmt, segs in build_candidates(pd.DataFrame(rows)):
        assert len(segs[0]) <= 280


def test_pick_excludes_recent_keys():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1 + i), i % 2 == 0)
        for i in range(6)
    ]
    df = pd.DataFrame(rows)
    all_keys = {c[0] for c in build_candidates(df)}
    recent = all_keys - {"h2h:Chennai Super Kings:Mumbai Indians"}
    import random

    picked = pick_standalone_trivia(df, recent, rng=random.Random(0))
    assert picked is not None
    assert picked[0] == "h2h:Chennai Super Kings:Mumbai Indians"


def test_pick_falls_back_to_repeat_when_all_candidates_excluded():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1 + i), i % 2 == 0)
        for i in range(6)
    ]
    df = pd.DataFrame(rows)
    all_keys = {c[0] for c in build_candidates(df)}
    import random

    picked = pick_standalone_trivia(df, all_keys, rng=random.Random(0))
    assert picked is not None  # falls back to allowing a repeat, never None here


def test_pick_returns_none_when_no_candidates_at_all():
    import random

    assert pick_standalone_trivia(pd.DataFrame(), set(), rng=random.Random(0)) is None


def _seed_content_bank(conn):
    from datetime import datetime, timezone

    from bot.db import content_bank

    conn.execute(
        content_bank.insert().values(
            category="wiki_record",
            format="single",
            segments_json='["\\ud83c\\udfcf 800 Test wickets \\u2014 Muralitharan. #Cricket"]',
            content_key="wiki_record:test:most-wickets",
            source="wikipedia:List_of_Test_cricket_records",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )
    conn.execute(
        content_bank.insert().values(
            category="story",
            format="thread",
            segments_json='["Bodyline, part 1", "part 2", "part 3"]',
            content_key="story:bodyline",
            source="wikipedia:Bodyline",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )


def test_content_bank_candidates_returns_parsed_tuples(engine):
    from bot.trivia_standalone import _content_bank_candidates

    with engine.begin() as conn:
        _seed_content_bank(conn)
        cands = _content_bank_candidates(conn)
    by_key = {c[0]: c for c in cands}
    assert by_key["story:bodyline"][1] == "thread"
    assert by_key["story:bodyline"][2] == ["Bodyline, part 1", "part 2", "part 3"]
    assert by_key["wiki_record:test:most-wickets"][1] == "single"
    assert len(by_key["wiki_record:test:most-wickets"][2]) == 1


def test_pick_merges_content_bank_pool(engine):
    import random

    from bot.trivia_standalone import pick_standalone_trivia

    with engine.begin() as conn:
        _seed_content_bank(conn)
        # empty df -> only content_bank candidates remain
        picked = pick_standalone_trivia(
            pd.DataFrame(), set(), conn=conn, rng=random.Random(0)
        )
    assert picked is not None
    assert picked[0] in ("wiki_record:test:most-wickets", "story:bodyline")


def test_pick_excludes_recent_content_bank_keys(engine):
    import random

    from bot.trivia_standalone import pick_standalone_trivia

    with engine.begin() as conn:
        _seed_content_bank(conn)
        picked = pick_standalone_trivia(
            pd.DataFrame(),
            {"story:bodyline"},
            conn=conn,
            rng=random.Random(0),
        )
    assert picked[0] == "wiki_record:test:most-wickets"


def test_pick_without_conn_ignores_content_bank(engine):
    import random

    from bot.trivia_standalone import pick_standalone_trivia

    # df empty AND no conn -> no candidates at all
    assert pick_standalone_trivia(pd.DataFrame(), set(), rng=random.Random(0)) is None
