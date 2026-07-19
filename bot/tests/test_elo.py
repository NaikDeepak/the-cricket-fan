import pytest

from bot.elo import Elo


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
