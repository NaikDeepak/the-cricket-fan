"""Standard Elo baseline. The trained model must beat this on held-out data to ship."""
from collections import defaultdict

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
