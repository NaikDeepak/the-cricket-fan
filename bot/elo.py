"""Standard Elo baseline. The trained model must beat this on held-out data to ship."""

from collections import defaultdict

import pandas as pd

K = 20


class Elo:
    def __init__(self) -> None:
        self._r: dict[str, float] = defaultdict(lambda: 1500.0)

    def rating(self, team: str) -> float:
        return self._r[team]

    def expect(self, team_a: str, team_b: str) -> float:
        return 1.0 / (1.0 + 10 ** ((self._r[team_b] - self._r[team_a]) / 400.0))

    def update(self, team_a: str, team_b: str, a_won: bool) -> None:
        ea = self.expect(team_a, team_b)
        score = 1.0 if a_won else 0.0
        self._r[team_a] += K * (score - ea)
        self._r[team_b] += K * ((1.0 - score) - (1.0 - ea))


def build_from_matches(paired: pd.DataFrame) -> Elo:
    """Replays a paired-matches dataframe (bot.backtest.pair_matches's output
    shape: date/team_a/team_b/won_a, among other columns) chronologically
    into a fresh Elo, and returns it with final post-history ratings --
    ready for .expect() on a new, not-yet-played fixture.

    Used at live-serving time (composer/routers/predictions.py's run_model)
    to produce an Elo-baseline probability for leagues on the model's
    league_elo_override list (see bot/gating.py), without re-running the
    LightGBM model at all.
    """
    elo = Elo()
    if paired.empty:
        return elo
    ordered = paired.sort_values(by=["date", "team_a", "team_b"], kind="stable")
    for _, row in ordered.iterrows():
        elo.update(row["team_a"], row["team_b"], a_won=bool(row["won_a"]))
    return elo
