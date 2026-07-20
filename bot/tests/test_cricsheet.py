from pathlib import Path

from bot.cricsheet import parse_result

DATA = Path(__file__).parent / "data"


def test_normal_match_two_rows_winner_and_rates():
    rows = parse_result(DATA / "match_normal.json", league="IPL")
    assert len(rows) == 2
    by_team = {r.team: r for r in rows}
    csk = by_team["Chennai Super Kings"]
    rcb = by_team["Royal Challengers Bengaluru"]
    assert csk.won is True and rcb.won is False
    assert csk.opponent == "Royal Challengers Bengaluru"
    assert csk.league == "IPL" and csk.season == "2025"
    # CSK batted 6 legal-ish deliveries for 12 total runs (incl extras), 1.0 overs
    assert csk.runs_scored == 12
    assert csk.overs_faced == 1.0
    # RCB batted 3 deliveries for 3 runs
    assert rcb.runs_scored == 3
    assert abs(rcb.overs_faced - 0.5) < 1e-9
    # Conceded mirrors opponent
    assert rcb.runs_conceded == 12 and csk.runs_conceded == 3
    assert csk.dls is False


def test_eliminator_winner_counts_as_win():
    rows = parse_result(DATA / "match_eliminator.json", league="IPL")
    by_team = {r.team: r for r in rows}
    assert by_team["Royal Challengers Bengaluru"].won is True
    assert by_team["Chennai Super Kings"].won is False


def test_dls_flag_set():
    rows = parse_result(DATA / "match_dls.json", league="IPL")
    assert all(r.dls for r in rows)


def test_no_result_returns_empty():
    assert parse_result(DATA / "match_noresult.json", league="IPL") == []


def test_home_flag_city_in_team_name():
    rows = parse_result(DATA / "match_normal.json", league="IPL")
    by_team = {r.team: r for r in rows}
    assert by_team["Royal Challengers Bengaluru"].home is True
    assert by_team["Chennai Super Kings"].home is False


def test_home_flag_uses_explicit_lookup_when_city_not_in_team_name():
    rows = parse_result(DATA / "match_city_not_in_name.json", league="IPL")
    by_team = {r.team: r for r in rows}
    assert by_team["Punjab Kings"].home is True
    assert by_team["Rajasthan Royals"].home is False


def test_super_over_uses_main_innings_totals():
    rows = parse_result(DATA / "match_super_over.json", league="IPL")
    by_team = {r.team: r for r in rows}
    csk = by_team["Chennai Super Kings"]
    rcb = by_team["Royal Challengers Bengaluru"]
    # Verify main innings figures (12/1.0 for CSK, 3/0.5 for RCB)
    # not super-over figures (15/1.0 for CSK, 18/1.0 for RCB)
    assert csk.runs_scored == 12
    assert csk.overs_faced == 1.0
    assert rcb.runs_scored == 3
    assert abs(rcb.overs_faced - 0.5) < 1e-9
