import pandas as pd
import pytest

from bot.elo import Elo, build_from_matches


def test_default_rating_and_even_expectation():
    e = Elo()
    assert e.rating("A") == 1500
    assert e.expect("A", "B") == pytest.approx(0.5)


def test_update_moves_ratings():
    e = Elo()
    e.update("A", "B", a_won=True)
    assert e.rating("A") == pytest.approx(1510)
    assert e.rating("B") == pytest.approx(1490)
    assert e.expect("A", "B") > 0.5


def test_expectation_bounded():
    e = Elo()
    for _ in range(200):
        e.update("A", "B", a_won=True)
    assert 0.5 < e.expect("A", "B") < 1.0


def test_build_from_matches_replays_chronologically():
    # A wins twice, B wins once, in this exact date order.
    paired = pd.DataFrame(
        [
            {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": True},
            {"date": "2024-01-03", "team_a": "A", "team_b": "B", "won_a": False},
            {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": True},
        ]
    )
    elo = build_from_matches(paired)
    assert isinstance(elo, Elo)
    # A won 2 of 3 -> A should be rated above B.
    assert elo.expect("A", "B") > 0.5


def test_build_from_matches_matches_manual_chronological_replay():
    paired = pd.DataFrame(
        [
            {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": True},
            {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": False},
        ]
    )
    result = build_from_matches(paired)

    manual = Elo()
    manual.update("A", "B", a_won=False)  # 2024-01-01 first
    manual.update("A", "B", a_won=True)  # then 2024-01-02
    assert result.rating("A") == manual.rating("A")
    assert result.rating("B") == manual.rating("B")


def test_build_from_matches_ignores_input_row_order():
    rows = [
        {"date": "2024-01-01", "team_a": "A", "team_b": "B", "won_a": True},
        {"date": "2024-01-02", "team_a": "A", "team_b": "B", "won_a": False},
        {"date": "2024-01-03", "team_a": "A", "team_b": "B", "won_a": True},
    ]
    forward = build_from_matches(pd.DataFrame(rows))
    shuffled = build_from_matches(pd.DataFrame(rows[::-1]))
    assert forward.rating("A") == shuffled.rating("A")
    assert forward.rating("B") == shuffled.rating("B")


def test_build_from_matches_empty_input_returns_default_elo():
    elo = build_from_matches(
        pd.DataFrame(columns=["date", "team_a", "team_b", "won_a"])
    )
    assert elo.expect("X", "Y") == 0.5
