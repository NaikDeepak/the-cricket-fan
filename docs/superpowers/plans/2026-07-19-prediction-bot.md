# X Prediction Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated X (Twitter) bot posting T20 match win predictions (calibrated ML probability + top-3 readable reasons), data-driven trivia, and post-result accuracy updates, for all major T20 leagues + T20Is.

**Architecture:** Standalone top-level `bot/` Python package, independent of `backend/` (backend stays untouched). Offline: Cricsheet JSON → result-level parser → pandas team-match table → LightGBM + isotonic calibration → committed artifact. Online: GitHub Actions cron every 2h runs one idempotent tick — fetch fixtures/results from a free cricket API (alias-resolved to Cricsheet canonical names), build leakage-guarded features from a Neon Postgres aggregate table, predict, compose ≤280-char posts, post via X API v2, log accuracy.

**Tech Stack:** Python 3.12, SQLAlchemy Core (sync; SQLite in tests, Neon Postgres in prod), pandas, LightGBM, scikit-learn (isotonic calibration), shap, tweepy (X API v2), httpx, pytest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-19-prediction-bot-design.md`

## Global Constraints

- Bot never posts through unresolved team/venue names — unresolved entity = skip match + log (hard-fail rule).
- Feature builder must only read rows with `date` strictly before the target match date (leakage guard).
- All timing is window-based (cron is best-effort); a prediction is never posted at/after scheduled start (late-tick guard).
- Posts ≤ 280 chars. No betting language or links.
- Quota circuit breaker: month count ≥ 450 → drop trivia; ≥ 490 → results only. Priority: prediction > result > trivia.
- Ship gate: model must beat Elo baseline on held-out log-loss and Brier, else ship Elo.
- Neon holds only aggregates + bot state; raw Cricsheet JSON / ball-by-ball rows never enter Postgres.
- Ties resolved by super over (`outcome.eliminator`) = win; true tie / no-result = excluded from training, `void` in accuracy record.
- DLS matches (`outcome.method` contains "D/L" or "DLS"): innings excluded from run-rate/economy aggregates; result still counts for form.
- `BOT_DRY_RUN=1` prints posts instead of sending; used in CI and integration tests.
- Line length 99 (ruff, matches backend); bot code is synchronous (no asyncio).

## File Structure

```
bot/
├── __init__.py
├── config.py            # env-driven settings (dataclass, no pydantic dependency needed)
├── db.py                # SQLAlchemy Core metadata: team_matches, aliases, fixtures, predictions, posts
├── cricsheet.py         # result-level Cricsheet parser → TeamMatchRow pairs
├── aliases.py           # entity resolution, UnresolvedEntityError, seed data
├── features.py          # leakage-guarded feature builder (shared by train + inference)
├── elo.py               # Elo baseline model
├── train.py             # dataset build, time split, LightGBM+calibration, metrics gate, artifact
├── predict.py           # load artifact, predict_proba + top-3 SHAP reasons
├── fixtures_provider.py # CricAPI-style adapter → Fixture/Result, alias-resolved
├── compose.py           # post templates, SHAP name translation, data-driven trivia
├── poster.py            # tweepy X client, dry-run, circuit breaker
├── run.py               # cron tick orchestration
├── requirements.txt
├── artifacts/           # model.pkl + metrics.json (committed)
└── tests/
    ├── __init__.py
    ├── conftest.py      # sqlite engine + table fixtures
    ├── test_cricsheet.py
    ├── test_aliases.py
    ├── test_features.py
    ├── test_elo.py
    ├── test_train.py
    ├── test_predict.py
    ├── test_provider.py
    ├── test_compose.py
    ├── test_poster.py
    ├── test_run.py
    └── data/            # crafted Cricsheet + provider JSON fixtures
.github/workflows/
├── bot-run.yml          # cron every 2h
├── bot-retrain.yml      # manual dispatch
└── bot-ci.yml           # pytest on PR/push
```

Run bot tests from repo root: `python -m pytest bot/tests -v` (add `bot/` to path via `bot/tests/conftest.py` — tests import `bot.xxx`, repo root on `sys.path` automatically when run from root).

---

### Task 1: Package scaffold, config, DB schema

**Files:**
- Create: `bot/__init__.py` (empty), `bot/requirements.txt`, `bot/config.py`, `bot/db.py`
- Create: `bot/tests/__init__.py` (empty), `bot/tests/conftest.py`, `bot/tests/test_db.py`

**Interfaces:**
- Produces: `bot.config.Settings` dataclass + `get_settings()`; `bot.db.metadata`, tables `team_matches`, `aliases`, `fixtures`, `predictions`, `posts`; `bot.db.get_engine(url)`.

- [ ] **Step 1: Write requirements**

`bot/requirements.txt`:
```
sqlalchemy>=2.0.0
psycopg[binary]>=3.1.0
pandas>=2.2.0
numpy>=1.26.0
lightgbm>=4.3.0
scikit-learn>=1.4.0
shap>=0.45.0
joblib>=1.4.0
tweepy>=4.14.0
httpx>=0.27.0
python-dotenv>=1.0.0
pytest>=8.2.0
```

Install into backend venv (shared local dev env): `cd backend && source .venv/bin/activate && pip install -r ../bot/requirements.txt`

- [ ] **Step 2: Write failing test for config + schema**

`bot/tests/conftest.py`:
```python
import pytest
from sqlalchemy import create_engine

from bot.db import metadata


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:")
    metadata.create_all(eng)
    yield eng
    eng.dispose()
```

`bot/tests/test_db.py`:
```python
from sqlalchemy import inspect

from bot.config import Settings
from bot.db import metadata


def test_settings_reads_env(monkeypatch):
    monkeypatch.setenv("BOT_DATABASE_URL", "sqlite:///x.db")
    monkeypatch.setenv("BOT_DRY_RUN", "1")
    s = Settings.from_env()
    assert s.database_url == "sqlite:///x.db"
    assert s.dry_run is True


def test_all_tables_defined(engine):
    names = set(inspect(engine).get_table_names())
    assert {"team_matches", "aliases", "fixtures", "predictions", "posts"} <= names


def test_posts_unique_constraint(engine):
    import sqlalchemy as sa
    from bot.db import posts
    with engine.begin() as conn:
        conn.execute(posts.insert().values(fixture_id=1, post_type="prediction",
                                           state="scheduled", attempts=0))
        try:
            conn.execute(posts.insert().values(fixture_id=1, post_type="prediction",
                                               state="scheduled", attempts=0))
            assert False, "expected IntegrityError"
        except sa.exc.IntegrityError:
            pass
```

- [ ] **Step 3: Run tests, verify fail**

Run: `python -m pytest bot/tests/test_db.py -v`
Expected: FAIL / error — `ModuleNotFoundError: No module named 'bot.db'`

- [ ] **Step 4: Implement config + db**

`bot/config.py`:
```python
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    dry_run: bool
    cricket_api_key: str
    cricket_api_base: str
    x_api_key: str
    x_api_secret: str
    x_access_token: str
    x_access_token_secret: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.environ.get("BOT_DATABASE_URL", ""),
            dry_run=os.environ.get("BOT_DRY_RUN", "0") == "1",
            cricket_api_key=os.environ.get("CRICKET_API_KEY", ""),
            cricket_api_base=os.environ.get(
                "CRICKET_API_BASE", "https://api.cricapi.com/v1"
            ),
            x_api_key=os.environ.get("X_API_KEY", ""),
            x_api_secret=os.environ.get("X_API_SECRET", ""),
            x_access_token=os.environ.get("X_ACCESS_TOKEN", ""),
            x_access_token_secret=os.environ.get("X_ACCESS_TOKEN_SECRET", ""),
        )


def get_settings() -> Settings:
    return Settings.from_env()
```

`bot/db.py`:
```python
import sqlalchemy as sa

metadata = sa.MetaData()

# Aggregate feature store: two rows per completed match (one per team perspective).
team_matches = sa.Table(
    "team_matches", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("team", sa.String(64), nullable=False, index=True),
    sa.Column("opponent", sa.String(64), nullable=False),
    sa.Column("date", sa.Date, nullable=False, index=True),
    sa.Column("season", sa.String(16), nullable=False),
    sa.Column("league", sa.String(32), nullable=False),
    sa.Column("venue", sa.String(128), nullable=False),
    sa.Column("won", sa.Boolean, nullable=False),
    sa.Column("dls", sa.Boolean, nullable=False, default=False),
    sa.Column("runs_scored", sa.Float, nullable=True),
    sa.Column("overs_faced", sa.Float, nullable=True),
    sa.Column("runs_conceded", sa.Float, nullable=True),
    sa.Column("overs_bowled", sa.Float, nullable=True),
    sa.Column("home", sa.Boolean, nullable=False, default=False),
)

aliases = sa.Table(
    "aliases", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("kind", sa.String(8), nullable=False),  # 'team' | 'venue'
    sa.Column("alias", sa.String(128), nullable=False),
    sa.Column("canonical", sa.String(128), nullable=False),
    sa.UniqueConstraint("kind", "alias", name="uq_alias"),
)

fixtures = sa.Table(
    "fixtures", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("provider_match_id", sa.String(64), nullable=False, unique=True),
    sa.Column("team_a", sa.String(64), nullable=False),   # canonical
    sa.Column("team_b", sa.String(64), nullable=False),   # canonical
    sa.Column("venue", sa.String(128), nullable=False),   # canonical
    sa.Column("league", sa.String(32), nullable=False),
    sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
    sa.Column("status", sa.String(16), nullable=False, default="upcoming"),
    # 'upcoming' | 'completed' | 'void'
    sa.Column("winner", sa.String(64), nullable=True),
)

predictions = sa.Table(
    "predictions", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("fixture_id", sa.Integer, sa.ForeignKey("fixtures.id"), nullable=False,
              unique=True),
    sa.Column("prob_team_a", sa.Float, nullable=False),
    sa.Column("reasons_json", sa.Text, nullable=False),   # json list[str]
    sa.Column("features_json", sa.Text, nullable=False),  # json dict snapshot
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("outcome", sa.String(16), nullable=False, default="pending"),
    # 'pending' | 'correct' | 'incorrect' | 'void'
)

posts = sa.Table(
    "posts", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("fixture_id", sa.Integer, nullable=False),
    sa.Column("post_type", sa.String(16), nullable=False),
    # 'prediction' | 'trivia' | 'result'
    sa.Column("state", sa.String(16), nullable=False, default="scheduled"),
    # 'scheduled' | 'posted' | 'failed' | 'abandoned'
    sa.Column("attempts", sa.Integer, nullable=False, default=0),
    sa.Column("text", sa.Text, nullable=True),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
    sa.UniqueConstraint("fixture_id", "post_type", name="uq_post"),
)


def get_engine(url: str) -> sa.Engine:
    return sa.create_engine(url, pool_pre_ping=True)
```

- [ ] **Step 5: Run tests, verify pass**

Run: `python -m pytest bot/tests/test_db.py -v`
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add bot/
git commit -m "feat(bot): package scaffold, config, DB schema"
```

---

### Task 2: Result-level Cricsheet parser

**Files:**
- Create: `bot/cricsheet.py`, `bot/tests/test_cricsheet.py`, `bot/tests/data/match_normal.json`, `bot/tests/data/match_eliminator.json`, `bot/tests/data/match_dls.json`, `bot/tests/data/match_noresult.json`

**Interfaces:**
- Produces: `TeamMatchRow` dataclass (fields exactly matching `team_matches` columns minus `id`), `parse_result(filepath: Path, league: str) -> list[TeamMatchRow]` — returns 2 rows (one per team) or `[]` for no-result/true tie.

- [ ] **Step 1: Create crafted test JSON fixtures**

`bot/tests/data/match_normal.json` (minimal valid Cricsheet shape):
```json
{
  "info": {
    "dates": ["2025-04-10"],
    "season": "2025",
    "venue": "M Chinnaswamy Stadium, Bengaluru",
    "city": "Bengaluru",
    "teams": ["Royal Challengers Bengaluru", "Chennai Super Kings"],
    "outcome": {"winner": "Chennai Super Kings", "by": {"runs": 12}},
    "toss": {"winner": "Chennai Super Kings", "decision": "bat"}
  },
  "innings": [
    {"team": "Chennai Super Kings", "overs": [
      {"over": 0, "deliveries": [
        {"batter": "A", "bowler": "B", "runs": {"batter": 4, "extras": 0, "total": 4}},
        {"batter": "A", "bowler": "B", "runs": {"batter": 1, "extras": 0, "total": 1}},
        {"batter": "C", "bowler": "B", "runs": {"batter": 0, "extras": 0, "total": 0}},
        {"batter": "C", "bowler": "B", "runs": {"batter": 6, "extras": 0, "total": 6}},
        {"batter": "C", "bowler": "B", "runs": {"batter": 0, "extras": 0, "total": 0}},
        {"batter": "C", "bowler": "B", "runs": {"batter": 1, "extras": 0, "total": 1}}
      ]}
    ]},
    {"team": "Royal Challengers Bengaluru", "overs": [
      {"over": 0, "deliveries": [
        {"batter": "D", "bowler": "E", "runs": {"batter": 0, "extras": 0, "total": 0}},
        {"batter": "D", "bowler": "E", "runs": {"batter": 0, "extras": 1, "total": 1}},
        {"batter": "D", "bowler": "E", "runs": {"batter": 2, "extras": 0, "total": 2}}
      ]}
    ]}
  ]
}
```

`bot/tests/data/match_eliminator.json` — copy of match_normal.json with `"outcome"` replaced by:
```json
{"result": "tie", "eliminator": "Royal Challengers Bengaluru"}
```

`bot/tests/data/match_dls.json` — copy of match_normal.json with `"outcome"` replaced by:
```json
{"winner": "Chennai Super Kings", "by": {"runs": 5}, "method": "D/L"}
```

`bot/tests/data/match_noresult.json` — copy of match_normal.json with `"outcome"` replaced by:
```json
{"result": "no result"}
```

- [ ] **Step 2: Write failing tests**

`bot/tests/test_cricsheet.py`:
```python
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
```

- [ ] **Step 3: Run tests, verify fail**

Run: `python -m pytest bot/tests/test_cricsheet.py -v`
Expected: FAIL — `No module named 'bot.cricsheet'`

- [ ] **Step 4: Implement parser**

`bot/cricsheet.py`:
```python
"""Result-level Cricsheet parser. One match file -> two TeamMatchRow (or [] if no result)."""
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class TeamMatchRow:
    team: str
    opponent: str
    date: date
    season: str
    league: str
    venue: str
    won: bool
    dls: bool
    runs_scored: float | None
    overs_faced: float | None
    runs_conceded: float | None
    overs_bowled: float | None
    home: bool


def _innings_totals(data: dict) -> dict[str, tuple[float, float]]:
    """team -> (total runs incl extras, overs faced as decimal overs)."""
    totals: dict[str, tuple[float, float]] = {}
    for innings in data.get("innings", []):
        team = innings.get("team", "")
        runs = 0.0
        balls = 0
        for over in innings.get("overs", []):
            for d in over.get("deliveries", []):
                runs += d.get("runs", {}).get("total", 0)
                extras = d.get("extras", {})
                if "wides" not in extras and "noballs" not in extras:
                    balls += 1
        totals[team] = (runs, balls / 6.0)
    return totals


def parse_result(filepath: Path, league: str) -> list[TeamMatchRow]:
    with open(filepath) as f:
        data = json.load(f)
    info = data.get("info", {})
    outcome = info.get("outcome", {})
    teams = info.get("teams", [])
    if len(teams) != 2:
        return []

    winner = outcome.get("winner") or outcome.get("eliminator")
    if not winner:  # true tie or no result
        return []

    method = str(outcome.get("method", ""))
    dls = "D/L" in method or "DLS" in method
    venue = info.get("venue", "Unknown")
    city = info.get("city", "")
    season = str(info.get("season", ""))
    match_date = date.fromisoformat(info.get("dates", ["1970-01-01"])[0])
    totals = _innings_totals(data)

    rows = []
    for team in teams:
        opponent = next(t for t in teams if t != team)
        scored = totals.get(team)
        conceded = totals.get(opponent)
        rows.append(TeamMatchRow(
            team=team,
            opponent=opponent,
            date=match_date,
            season=season,
            league=league,
            venue=venue,
            won=(team == winner),
            dls=dls,
            runs_scored=scored[0] if scored else None,
            overs_faced=scored[1] if scored else None,
            runs_conceded=conceded[0] if conceded else None,
            overs_bowled=conceded[1] if conceded else None,
            home=bool(city) and city.lower() in team.lower(),
        ))
    return rows
```

- [ ] **Step 5: Run tests, verify pass**

Run: `python -m pytest bot/tests/test_cricsheet.py -v`
Expected: 5 PASS

- [ ] **Step 6: Commit**

```bash
git add bot/cricsheet.py bot/tests/test_cricsheet.py bot/tests/data/
git commit -m "feat(bot): result-level Cricsheet parser with eliminator/DLS/no-result handling"
```

---

### Task 3: Entity resolution (aliases)

**Files:**
- Create: `bot/aliases.py`, `bot/tests/test_aliases.py`

**Interfaces:**
- Consumes: `bot.db.aliases` table, engine fixture.
- Produces: `UnresolvedEntityError(Exception)`; `resolve(conn, kind: str, name: str) -> str` (exact match on canonical or alias, case-insensitive trim; raises `UnresolvedEntityError`); `seed_aliases(conn) -> None` idempotent starter set.

- [ ] **Step 1: Write failing tests**

`bot/tests/test_aliases.py`:
```python
import pytest

from bot.aliases import UnresolvedEntityError, resolve, seed_aliases
from bot.db import aliases


@pytest.fixture()
def conn(engine):
    with engine.begin() as c:
        yield c


def test_resolve_via_alias(conn):
    conn.execute(aliases.insert().values(
        kind="team", alias="royal challengers bangalore",
        canonical="Royal Challengers Bengaluru"))
    assert resolve(conn, "team", "Royal Challengers Bangalore") == \
        "Royal Challengers Bengaluru"


def test_resolve_canonical_passthrough(conn):
    conn.execute(aliases.insert().values(
        kind="team", alias="csk", canonical="Chennai Super Kings"))
    # canonical names resolve to themselves even without an explicit self-alias
    assert resolve(conn, "team", "Chennai Super Kings ") == "Chennai Super Kings"


def test_unresolved_raises(conn):
    with pytest.raises(UnresolvedEntityError):
        resolve(conn, "team", "Gotham Galacticos")


def test_seed_idempotent(conn):
    seed_aliases(conn)
    seed_aliases(conn)  # second run must not raise IntegrityError
    assert resolve(conn, "team", "RCB") == "Royal Challengers Bengaluru"
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_aliases.py -v`
Expected: FAIL — `No module named 'bot.aliases'`

- [ ] **Step 3: Implement**

`bot/aliases.py`:
```python
"""Entity resolution: live-API team/venue names -> canonical Cricsheet names.

Hard-fail rule: unresolved name raises UnresolvedEntityError; callers must skip
the match and log — never predict through unresolved entities.
"""
import sqlalchemy as sa

from .db import aliases


class UnresolvedEntityError(Exception):
    pass


def _norm(name: str) -> str:
    return " ".join(name.strip().lower().split())


def resolve(conn, kind: str, name: str) -> str:
    n = _norm(name)
    row = conn.execute(
        sa.select(aliases.c.canonical).where(
            aliases.c.kind == kind,
            sa.func.lower(aliases.c.alias) == n,
        )
    ).first()
    if row:
        return row.canonical
    # canonical passthrough: name already appears as a canonical value
    row = conn.execute(
        sa.select(aliases.c.canonical).where(
            aliases.c.kind == kind,
            sa.func.lower(aliases.c.canonical) == n,
        )
    ).first()
    if row:
        return row.canonical
    raise UnresolvedEntityError(f"{kind}: {name!r}")


SEED: list[tuple[str, str, str]] = [
    # (kind, alias, canonical) — extend as unresolved names surface in logs
    ("team", "rcb", "Royal Challengers Bengaluru"),
    ("team", "royal challengers bangalore", "Royal Challengers Bengaluru"),
    ("team", "csk", "Chennai Super Kings"),
    ("team", "mi", "Mumbai Indians"),
    ("team", "kkr", "Kolkata Knight Riders"),
    ("team", "srh", "Sunrisers Hyderabad"),
    ("team", "dc", "Delhi Capitals"),
    ("team", "pbks", "Punjab Kings"),
    ("team", "rr", "Rajasthan Royals"),
    ("team", "gt", "Gujarat Titans"),
    ("team", "lsg", "Lucknow Super Giants"),
    ("venue", "m.chinnaswamy stadium", "M Chinnaswamy Stadium, Bengaluru"),
]


def seed_aliases(conn) -> None:
    for kind, alias, canonical in SEED:
        exists = conn.execute(
            sa.select(aliases.c.id).where(
                aliases.c.kind == kind, aliases.c.alias == alias)
        ).first()
        if not exists:
            conn.execute(aliases.insert().values(
                kind=kind, alias=alias, canonical=canonical))
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_aliases.py -v`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/aliases.py bot/tests/test_aliases.py
git commit -m "feat(bot): entity resolution with hard-fail on unresolved names"
```

---

### Task 4: Feature builder (leakage-guarded)

**Files:**
- Create: `bot/features.py`, `bot/tests/test_features.py`

**Interfaces:**
- Consumes: pandas DataFrame with `team_matches` columns (`team, opponent, date, season, league, venue, won, dls, runs_scored, overs_faced, runs_conceded, overs_bowled, home`).
- Produces: `FEATURE_NAMES: list[str]` (fixed order); `build_features(df, team_a, team_b, venue, match_date, home_team=None) -> dict[str, float]` with keys exactly `FEATURE_NAMES`. Constants `RECENCY_DECAY = 0.9`, `SEASON_DECAY = 0.5`.

- [ ] **Step 1: Write failing tests**

`bot/tests/test_features.py`:
```python
from datetime import date

import pandas as pd
import pytest

from bot.features import FEATURE_NAMES, build_features


def _row(team, opp, d, won, season="2025", venue="V", dls=False,
         rs=160.0, of=20.0, rc=150.0, ob=20.0, home=False):
    return dict(team=team, opponent=opp, date=d, season=season, league="IPL",
                venue=venue, won=won, dls=dls, runs_scored=rs, overs_faced=of,
                runs_conceded=rc, overs_bowled=ob, home=home)


@pytest.fixture()
def df():
    rows = []
    # Team A: 4 wins then 1 loss in 2025; strong batting
    for i, won in enumerate([True, True, True, True, False]):
        rows.append(_row("A", "X", date(2025, 4, 1 + i), won, rs=180.0))
    # Team B: 1 win, 4 losses in 2025; weak batting
    for i, won in enumerate([True, False, False, False, False]):
        rows.append(_row("B", "Y", date(2025, 4, 1 + i), won, rs=140.0))
    # Head-to-head: A beat B twice in 2025 (rs=180 keeps A's innings uniform for rr test)
    rows.append(_row("A", "B", date(2025, 4, 10), True, rs=180.0))
    rows.append(_row("B", "A", date(2025, 4, 10), False))
    rows.append(_row("A", "B", date(2025, 4, 12), True, rs=180.0))
    rows.append(_row("B", "A", date(2025, 4, 12), False))
    # Venue history at "V": A won 2 of 2 there
    rows.append(_row("A", "Z", date(2025, 4, 15), True, venue="V", rs=180.0))
    rows.append(_row("A", "Z", date(2025, 4, 16), True, venue="V", rs=180.0))
    # DLS match with absurd run rate must NOT poison rr feature
    rows.append(_row("A", "Z", date(2025, 4, 17), True, dls=True, rs=60.0, of=5.0))
    # Future match (after prediction date) must be invisible
    rows.append(_row("B", "Z", date(2025, 6, 1), True))
    return pd.DataFrame(rows)


def test_leakage_guard_only_past_rows(df):
    f_may = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # B's 2025-06-01 win excluded: form counts only the 1W/4L + 2 h2h losses
    f_july = build_features(df, "A", "B", "V", date(2025, 7, 1))
    assert f_may["form10_b"] < f_july["form10_b"]  # june win visible only in july


def test_row_on_match_date_excluded(df):
    f = build_features(df, "A", "B", "V", date(2025, 4, 10))
    f_after = build_features(df, "A", "B", "V", date(2025, 4, 11))
    assert f["h2h_a_rate"] == 0.5  # no meetings yet -> neutral prior
    assert f_after["h2h_a_rate"] > 0.5


def test_form_favors_team_a(df):
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["form5_a"] > f["form5_b"]
    assert set(f.keys()) == set(FEATURE_NAMES)


def test_dls_excluded_from_run_rate(df):
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # A's non-DLS innings are all 180 in 20 overs = 9.0 rr; DLS 60/5=12 excluded
    assert f["bat_rr_a"] == pytest.approx(9.0)


def test_season_decay_downweights_last_season():
    old = [_row("A", "X", date(2024, 5, 1), True, season="2024") for _ in range(10)]
    new = [_row("A", "X", date(2025, 4, 1), False, season="2025")]
    df = pd.DataFrame(old + new)
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    # without season decay this would be ~0.80; with it the recent loss dominates
    assert f["form5_a"] < 0.65


def test_no_history_neutral_defaults():
    df = pd.DataFrame(columns=["team", "opponent", "date", "season", "league",
                               "venue", "won", "dls", "runs_scored", "overs_faced",
                               "runs_conceded", "overs_bowled", "home"])
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["form5_a"] == 0.5 and f["h2h_a_rate"] == 0.5
    assert f["bat_rr_a"] == pytest.approx(7.8)  # global T20 prior
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_features.py -v`
Expected: FAIL — `No module named 'bot.features'`

- [ ] **Step 3: Implement**

`bot/features.py`:
```python
"""Leakage-guarded pre-match feature builder, shared by training and inference.

All aggregates read rows with date STRICTLY BEFORE the target match date.
Weights: RECENCY_DECAY^k over match recency, times SEASON_DECAY^(seasons back)
to downweight prior-season form (squad churn).
"""
from datetime import date

import numpy as np
import pandas as pd

RECENCY_DECAY = 0.9
SEASON_DECAY = 0.5
GLOBAL_RR_PRIOR = 7.8   # long-run T20 run rate, used when no history
NEUTRAL = 0.5

FEATURE_NAMES = [
    "form5_a", "form5_b", "form10_a", "form10_b",
    "h2h_a_rate",
    "venue_a_rate", "venue_b_rate",
    "bat_rr_a", "bat_rr_b", "bowl_econ_a", "bowl_econ_b",
    "home_a", "home_b",
]


def _season_rank(season: str) -> int:
    digits = "".join(c for c in str(season) if c.isdigit())[:4]
    return int(digits) if len(digits) == 4 else 0


def _weights(sub: pd.DataFrame, target_season: int) -> np.ndarray:
    n = len(sub)
    recency = RECENCY_DECAY ** np.arange(n - 1, -1, -1)  # newest row -> weight 1
    seasons_back = np.clip(target_season - sub["season"].map(_season_rank), 0, 20)
    return recency * (SEASON_DECAY ** seasons_back.to_numpy())


def _weighted_rate(sub: pd.DataFrame, target_season: int, last: int | None) -> float:
    if sub.empty:
        return NEUTRAL
    sub = sub.sort_values("date")
    if last is not None:
        sub = sub.tail(last)
    w = _weights(sub, target_season)
    if w.sum() == 0:
        return NEUTRAL
    return float(np.average(sub["won"].astype(float), weights=w))


def _run_rate(sub: pd.DataFrame, runs_col: str, overs_col: str) -> float:
    sub = sub[~sub["dls"]].dropna(subset=[runs_col, overs_col])
    sub = sub[sub[overs_col] > 0].sort_values("date").tail(10)
    if sub.empty:
        return GLOBAL_RR_PRIOR
    return float(sub[runs_col].sum() / sub[overs_col].sum())


def build_features(df: pd.DataFrame, team_a: str, team_b: str, venue: str,
                   match_date: date, home_team: str | None = None) -> dict[str, float]:
    past = df[pd.to_datetime(df["date"]).dt.date < match_date] if len(df) else df
    season = match_date.year
    a = past[past["team"] == team_a] if len(past) else past
    b = past[past["team"] == team_b] if len(past) else past
    h2h = a[a["opponent"] == team_b] if len(a) else a
    return {
        "form5_a": _weighted_rate(a, season, 5),
        "form5_b": _weighted_rate(b, season, 5),
        "form10_a": _weighted_rate(a, season, 10),
        "form10_b": _weighted_rate(b, season, 10),
        "h2h_a_rate": _weighted_rate(h2h, season, None),
        "venue_a_rate": _weighted_rate(a[a["venue"] == venue] if len(a) else a,
                                       season, None),
        "venue_b_rate": _weighted_rate(b[b["venue"] == venue] if len(b) else b,
                                       season, None),
        "bat_rr_a": _run_rate(a, "runs_scored", "overs_faced") if len(a)
        else GLOBAL_RR_PRIOR,
        "bat_rr_b": _run_rate(b, "runs_scored", "overs_faced") if len(b)
        else GLOBAL_RR_PRIOR,
        "bowl_econ_a": _run_rate(a, "runs_conceded", "overs_bowled") if len(a)
        else GLOBAL_RR_PRIOR,
        "bowl_econ_b": _run_rate(b, "runs_conceded", "overs_bowled") if len(b)
        else GLOBAL_RR_PRIOR,
        "home_a": 1.0 if home_team == team_a else 0.0,
        "home_b": 1.0 if home_team == team_b else 0.0,
    }
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_features.py -v`
Expected: 7 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/features.py bot/tests/test_features.py
git commit -m "feat(bot): leakage-guarded feature builder with season decay + DLS exclusion"
```

---

### Task 5: Elo baseline

**Files:**
- Create: `bot/elo.py`, `bot/tests/test_elo.py`

**Interfaces:**
- Consumes: chronologically sorted iterable of `(team_a, team_b, a_won: bool)`.
- Produces: `class Elo` with `rating(team) -> float` (default 1500), `expect(team_a, team_b) -> float` (P(team_a wins)), `update(team_a, team_b, a_won)`; `K = 20`.

- [ ] **Step 1: Write failing tests**

`bot/tests/test_elo.py`:
```python
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
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_elo.py -v`
Expected: FAIL — `No module named 'bot.elo'`

- [ ] **Step 3: Implement**

`bot/elo.py`:
```python
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
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_elo.py -v`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/elo.py bot/tests/test_elo.py
git commit -m "feat(bot): Elo baseline model"
```

---

### Task 6: Training pipeline + metrics gate

**Files:**
- Create: `bot/train.py`, `bot/tests/test_train.py`

**Interfaces:**
- Consumes: `parse_result` (Task 2), `build_features`/`FEATURE_NAMES` (Task 4), `Elo` (Task 5).
- Produces: `build_team_matches(cricsheet_dir: Path, league_map: dict[str, str]) -> pd.DataFrame`; `build_dataset(df) -> tuple[pd.DataFrame X, pd.Series y, pd.Series dates]` (one sample per match, label = team_a won, team_a = alphabetically first team for determinism); `train_and_evaluate(X, y, dates, out_dir: Path) -> dict` writing `model.pkl` (joblib: dict with `model`, `calibrator`, `feature_names`) and `metrics.json` (keys: `model` {accuracy, log_loss, brier}, `elo` {log_loss, brier, accuracy}, `always_home_accuracy`, `gate_passed: bool`, `n_train`, `n_test`, `test_period`); CLI `python -m bot.train --cricsheet-dir DIR --out bot/artifacts`.
- Split rule: train = matches with year ≤ (max_year − 2), validation (calibration fit) = year == max_year − 1, test = year == max_year.

- [ ] **Step 1: Write failing tests (synthetic data, no real Cricsheet download)**

`bot/tests/test_train.py`:
```python
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from bot.train import build_dataset, build_team_matches, train_and_evaluate

TEAMS = ["T0", "T1", "T2", "T3", "T4", "T5"]


def synthetic_team_matches(n_matches=600, seed=7) -> pd.DataFrame:
    """Skill-ordered synthetic league: lower-index teams win more often."""
    rng = np.random.default_rng(seed)
    rows = []
    start = date(2021, 3, 1)
    for i in range(n_matches):
        a, b = rng.choice(len(TEAMS), size=2, replace=False)
        d = start + timedelta(days=i * 2)
        p_a = 1 / (1 + np.exp(-(b - a) * 0.55))
        a_won = rng.random() < p_a
        for team_i, opp_i, won in [(a, b, a_won), (b, a, not a_won)]:
            rows.append(dict(
                team=TEAMS[team_i], opponent=TEAMS[opp_i], date=d,
                season=str(d.year), league="SYN", venue=f"V{team_i % 3}",
                won=bool(won), dls=False,
                runs_scored=150.0 + (5 - team_i) * 6 + rng.normal(0, 8),
                overs_faced=20.0, runs_conceded=150.0 + (5 - opp_i) * 6,
                overs_bowled=20.0, home=False))
    return pd.DataFrame(rows)


def test_build_team_matches_reads_dir():
    data_dir = Path(__file__).parent / "data"
    df = build_team_matches(data_dir, league_map={"match_normal": "IPL"})
    # only files present in league_map are ingested
    assert set(df["league"]) == {"IPL"}
    assert len(df) == 2


def test_build_dataset_shapes_and_no_leakage_column():
    df = synthetic_team_matches(200)
    X, y, dates = build_dataset(df)
    assert len(X) == len(y) == len(dates) == 100  # one sample per match
    assert "won" not in X.columns


def test_train_writes_artifact_and_metrics(tmp_path):
    df = synthetic_team_matches(600)
    X, y, dates = build_dataset(df)
    metrics = train_and_evaluate(X, y, dates, out_dir=tmp_path)
    assert (tmp_path / "model.pkl").exists()
    saved = json.loads((tmp_path / "metrics.json").read_text())
    for key in ["model", "elo", "always_home_accuracy", "gate_passed",
                "n_train", "n_test", "test_period"]:
        assert key in saved
    assert 0.0 < metrics["model"]["log_loss"] < 1.5
    # synthetic league is learnable: model should beat coin flip clearly
    assert metrics["model"]["accuracy"] > 0.55
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_train.py -v`
Expected: FAIL — `No module named 'bot.train'`

- [ ] **Step 3: Implement**

`bot/train.py`:
```python
"""Offline training: Cricsheet dir -> team_matches df -> features -> LightGBM
+ isotonic calibration -> artifacts (model.pkl, metrics.json) with baseline gate.
"""
import argparse
import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

from .cricsheet import parse_result
from .elo import Elo
from .features import FEATURE_NAMES, build_features


def build_team_matches(cricsheet_dir: Path, league_map: dict[str, str]) -> pd.DataFrame:
    """league_map: file-stem (or stem prefix before first '_') -> league label.
    Files whose stem is not mapped are skipped."""
    rows = []
    for f in sorted(cricsheet_dir.glob("*.json")):
        league = league_map.get(f.stem) or league_map.get(f.stem.split("_")[0])
        if not league:
            continue
        for r in parse_result(f, league=league):
            rows.append(r.__dict__)
    return pd.DataFrame(rows)


def build_dataset(df: pd.DataFrame):
    """One sample per match. team_a = alphabetically-first team (deterministic)."""
    matches = df.copy()
    matches["pair"] = matches.apply(
        lambda r: tuple(sorted([r["team"], r["opponent"]])), axis=1)
    matches = matches.drop_duplicates(subset=["date", "pair"])
    feats, labels, dts = [], [], []
    for _, m in matches.iterrows():
        team_a, team_b = m["pair"]
        won_a = m["won"] if m["team"] == team_a else not m["won"]
        home_team = None
        if m["home"]:
            home_team = m["team"]
        f = build_features(df, team_a, team_b, m["venue"], m["date"],
                           home_team=home_team)
        feats.append(f)
        labels.append(1 if won_a else 0)
        dts.append(m["date"])
    X = pd.DataFrame(feats, columns=FEATURE_NAMES)
    return X, pd.Series(labels, name="y"), pd.Series(dts, name="date")


def _year(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s).dt.year


def train_and_evaluate(X: pd.DataFrame, y: pd.Series, dates: pd.Series,
                       out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    years = _year(dates)
    max_year = int(years.max())
    tr = years <= max_year - 2
    va = years == max_year - 1
    te = years == max_year

    model = lgb.LGBMClassifier(
        n_estimators=300, learning_rate=0.05, num_leaves=15,
        min_child_samples=20, random_state=42, verbose=-1)
    model.fit(X[tr], y[tr])

    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(model.predict_proba(X[va])[:, 1], y[va])

    p_test = np.clip(calibrator.predict(model.predict_proba(X[te])[:, 1]),
                     0.01, 0.99)
    y_test = y[te].to_numpy()

    # Elo baseline replayed chronologically over train+val, scored on test
    order = dates.sort_values().index
    elo = Elo()
    elo_probs = {}
    for idx in order:
        # reconstruct the pair from features is impossible; store via X index order
        pass
    # NOTE: Elo needs team names — build_dataset callers keep them via closure below.
    metrics = {
        "model": {
            "accuracy": float(accuracy_score(y_test, p_test > 0.5)),
            "log_loss": float(log_loss(y_test, p_test)),
            "brier": float(brier_score_loss(y_test, p_test)),
        },
        "n_train": int(tr.sum()), "n_test": int(te.sum()),
        "test_period": str(max_year),
    }
    joblib.dump({"model": model, "calibrator": calibrator,
                 "feature_names": FEATURE_NAMES}, out_dir / "model.pkl")
    return metrics
```

**Correction to the above (Elo replay needs team names):** `build_dataset` must also return the pair — final signature:

```python
def build_dataset(df):
    ...
    pairs.append((team_a, team_b))
    ...
    meta = pd.DataFrame({"date": dts, "team_a": [p[0] for p in pairs],
                         "team_b": [p[1] for p in pairs]})
    return X, pd.Series(labels, name="y"), meta
```

and `train_and_evaluate(X, y, meta, out_dir)` uses `meta["date"]` for splits and replays Elo:

```python
def train_and_evaluate(X, y, meta, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    years = _year(meta["date"])
    max_year = int(years.max())
    tr = years <= max_year - 2
    va = years == max_year - 1
    te = years == max_year

    model = lgb.LGBMClassifier(
        n_estimators=300, learning_rate=0.05, num_leaves=15,
        min_child_samples=20, random_state=42, verbose=-1)
    model.fit(X[tr], y[tr])

    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(model.predict_proba(X[va])[:, 1], y[va])
    p_test = np.clip(calibrator.predict(model.predict_proba(X[te])[:, 1]),
                     0.01, 0.99)
    y_test = y[te].to_numpy()

    elo = Elo()
    elo_p = np.zeros(len(meta))
    order = meta["date"].sort_values(kind="stable").index
    for idx in order:
        a, b = meta.loc[idx, "team_a"], meta.loc[idx, "team_b"]
        elo_p[meta.index.get_loc(idx)] = elo.expect(a, b)
        elo.update(a, b, a_won=bool(y.loc[idx]))
    elo_test = np.clip(elo_p[te.to_numpy()], 0.01, 0.99)

    home_pred = (X.loc[te, "home_a"] >= X.loc[te, "home_b"]).astype(int)

    metrics = {
        "model": {
            "accuracy": float(accuracy_score(y_test, p_test > 0.5)),
            "log_loss": float(log_loss(y_test, p_test)),
            "brier": float(brier_score_loss(y_test, p_test)),
        },
        "elo": {
            "accuracy": float(accuracy_score(y_test, elo_test > 0.5)),
            "log_loss": float(log_loss(y_test, elo_test)),
            "brier": float(brier_score_loss(y_test, elo_test)),
        },
        "always_home_accuracy": float(accuracy_score(y_test, home_pred)),
        "n_train": int(tr.sum()), "n_test": int(te.sum()),
        "test_period": str(max_year),
    }
    metrics["gate_passed"] = bool(
        metrics["model"]["log_loss"] < metrics["elo"]["log_loss"]
        and metrics["model"]["brier"] < metrics["elo"]["brier"])
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    joblib.dump({"model": model, "calibrator": calibrator,
                 "feature_names": FEATURE_NAMES}, out_dir / "model.pkl")
    return metrics


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cricsheet-dir", type=Path, required=True)
    ap.add_argument("--league-map", type=Path, required=True,
                    help="JSON file: file-stem/prefix -> league label")
    ap.add_argument("--out", type=Path, default=Path("bot/artifacts"))
    args = ap.parse_args()
    league_map = json.loads(args.league_map.read_text())
    df = build_team_matches(args.cricsheet_dir, league_map)
    X, y, meta = build_dataset(df)
    metrics = train_and_evaluate(X, y, meta, args.out)
    print(json.dumps(metrics, indent=2))
    if not metrics["gate_passed"]:
        raise SystemExit("GATE FAILED: model does not beat Elo baseline. Do not ship.")


if __name__ == "__main__":
    main()
```

Write the final version directly (single `train.py`, `build_dataset` returning `(X, y, meta)`); update `test_train.py`'s third test to unpack `meta` and pass it to `train_and_evaluate`.

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_train.py -v`
Expected: 3 PASS (LightGBM on 600 synthetic matches runs in seconds)

- [ ] **Step 5: Commit**

```bash
git add bot/train.py bot/tests/test_train.py
git commit -m "feat(bot): training pipeline with time split, calibration, Elo gate"
```

---

### Task 7: Inference (predict + SHAP reasons)

**Files:**
- Create: `bot/predict.py`, `bot/tests/test_predict.py`

**Interfaces:**
- Consumes: artifact dict from Task 6 (`model`, `calibrator`, `feature_names`), `build_features` (Task 4).
- Produces: `load_artifact(path: Path) -> dict`; `predict(artifact, features: dict) -> tuple[float, list[str]]` — calibrated P(team_a wins) clipped to [0.02, 0.98] and top-3 feature names by |SHAP| (raw names; translation happens in compose).

- [ ] **Step 1: Write failing tests**

`bot/tests/test_predict.py`:
```python
from pathlib import Path

from bot.predict import load_artifact, predict
from bot.tests.test_train import synthetic_team_matches
from bot.train import build_dataset, train_and_evaluate


def _artifact(tmp_path) -> Path:
    df = synthetic_team_matches(600)
    X, y, meta = build_dataset(df)
    train_and_evaluate(X, y, meta, out_dir=tmp_path)
    return tmp_path / "model.pkl"


def test_predict_prob_and_reasons(tmp_path):
    art = load_artifact(_artifact(tmp_path))
    strong_a = {n: 0.5 for n in art["feature_names"]}
    strong_a.update({"form5_a": 0.95, "form10_a": 0.9, "form5_b": 0.1,
                     "form10_b": 0.15, "bat_rr_a": 9.5, "bat_rr_b": 6.5})
    prob, reasons = predict(art, strong_a)
    assert 0.02 <= prob <= 0.98
    assert prob > 0.5
    assert len(reasons) == 3
    assert all(r in art["feature_names"] for r in reasons)


def test_predict_clips_extremes(tmp_path):
    art = load_artifact(_artifact(tmp_path))
    f = {n: 0.5 for n in art["feature_names"]}
    prob, _ = predict(art, f)
    assert 0.02 <= prob <= 0.98
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_predict.py -v`
Expected: FAIL — `No module named 'bot.predict'`

- [ ] **Step 3: Implement**

`bot/predict.py`:
```python
"""Load committed artifact; produce calibrated probability + top-3 SHAP reasons."""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap


def load_artifact(path: Path) -> dict:
    # Security: joblib.load executes pickled code. Safe here because the artifact
    # is produced by our own retrain workflow and committed to this repo — it is
    # never loaded from user input or fetched over the network. Do not point this
    # at untrusted files.
    art = joblib.load(path)
    art["explainer"] = shap.TreeExplainer(art["model"])
    return art


def predict(artifact: dict, features: dict) -> tuple[float, list[str]]:
    names = artifact["feature_names"]
    X = pd.DataFrame([[features[n] for n in names]], columns=names)
    raw = artifact["model"].predict_proba(X)[:, 1]
    prob = float(np.clip(artifact["calibrator"].predict(raw), 0.02, 0.98)[0])
    sv = artifact["explainer"].shap_values(X)
    vals = sv[1][0] if isinstance(sv, list) else np.asarray(sv)[0]
    top = np.argsort(-np.abs(vals))[:3]
    return prob, [names[i] for i in top]
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_predict.py -v`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/predict.py bot/tests/test_predict.py
git commit -m "feat(bot): inference with calibrated probability and SHAP top-3 reasons"
```

---

### Task 8: Fixtures provider (CricAPI adapter)

**Files:**
- Create: `bot/fixtures_provider.py`, `bot/tests/test_provider.py`, `bot/tests/data/provider_matches.json`

**Interfaces:**
- Consumes: `resolve` / `UnresolvedEntityError` (Task 3).
- Produces: `Fixture` dataclass (`provider_match_id, team_a, team_b, venue, league, start_time: datetime(UTC)`); `Result` dataclass (`provider_match_id, winner: str | None, no_result: bool`); `class CricApiProvider(base_url, api_key, client: httpx.Client | None)` with `fetch(conn) -> tuple[list[Fixture], list[Result]]` — alias-resolves names, skips + logs unresolved matches, only returns T20-type matches.

- [ ] **Step 1: Create recorded provider fixture**

`bot/tests/data/provider_matches.json` (CricAPI `currentMatches` response shape):
```json
{
  "status": "success",
  "data": [
    {
      "id": "up-1",
      "name": "Royal Challengers Bangalore vs Chennai Super Kings",
      "matchType": "t20",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-20T14:00:00",
      "teams": ["Royal Challengers Bangalore", "Chennai Super Kings"],
      "series": "Indian Premier League",
      "matchStarted": false,
      "matchEnded": false
    },
    {
      "id": "done-1",
      "name": "Mumbai Indians vs Kolkata Knight Riders",
      "matchType": "t20",
      "status": "Mumbai Indians won by 5 wkts",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-18T14:00:00",
      "teams": ["Mumbai Indians", "Kolkata Knight Riders"],
      "series": "Indian Premier League",
      "matchStarted": true,
      "matchEnded": true,
      "matchWinner": "Mumbai Indians"
    },
    {
      "id": "nr-1",
      "name": "Delhi Capitals vs Punjab Kings",
      "matchType": "t20",
      "status": "Match abandoned due to rain",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-18T10:00:00",
      "teams": ["Delhi Capitals", "Punjab Kings"],
      "series": "Indian Premier League",
      "matchStarted": true,
      "matchEnded": true
    },
    {
      "id": "unknown-1",
      "name": "Gotham Galacticos vs Chennai Super Kings",
      "matchType": "t20",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-21T14:00:00",
      "teams": ["Gotham Galacticos", "Chennai Super Kings"],
      "series": "Indian Premier League",
      "matchStarted": false,
      "matchEnded": false
    },
    {
      "id": "odi-1",
      "name": "India vs Australia",
      "matchType": "odi",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-22T09:00:00",
      "teams": ["India", "Australia"],
      "series": "ODI Series",
      "matchStarted": false,
      "matchEnded": false
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

`bot/tests/test_provider.py`:
```python
import json
from datetime import timezone
from pathlib import Path

import httpx
import pytest

from bot.aliases import seed_aliases
from bot.fixtures_provider import CricApiProvider

DATA = json.loads((Path(__file__).parent / "data" / "provider_matches.json").read_text())


@pytest.fixture()
def provider():
    def handler(request):
        return httpx.Response(200, json=DATA)
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return CricApiProvider("https://api.example.com/v1", "k", client=client)


@pytest.fixture()
def conn(engine):
    with engine.begin() as c:
        seed_aliases(c)
        yield c


def test_fetch_resolves_and_splits(provider, conn):
    fixtures, results = provider.fetch(conn)
    ids = {f.provider_match_id for f in fixtures}
    assert ids == {"up-1"}                      # unknown-1 skipped, odi-1 filtered
    up = fixtures[0]
    assert up.team_a == "Royal Challengers Bengaluru"   # alias-resolved + sorted
    assert up.team_b == "Chennai Super Kings"
    assert up.venue == "M Chinnaswamy Stadium, Bengaluru"
    assert up.start_time.tzinfo == timezone.utc

    by_id = {r.provider_match_id: r for r in results}
    assert by_id["done-1"].winner == "Mumbai Indians"
    assert by_id["nr-1"].no_result is True and by_id["nr-1"].winner is None


def test_unresolved_team_skipped_not_raised(provider, conn):
    fixtures, _ = provider.fetch(conn)   # must not raise despite Gotham Galacticos
    assert all(f.provider_match_id != "unknown-1" for f in fixtures)
```

- [ ] **Step 3: Run, verify fail**

Run: `python -m pytest bot/tests/test_provider.py -v`
Expected: FAIL — `No module named 'bot.fixtures_provider'`

- [ ] **Step 4: Implement**

`bot/fixtures_provider.py`:
```python
"""Swappable adapter over a free cricket API (CricAPI currentMatches shape).

Hard-fail rule applied here: unresolved team/venue -> match skipped + logged.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from .aliases import UnresolvedEntityError, resolve

logger = logging.getLogger(__name__)

ABANDONED_MARKERS = ("abandoned", "no result")


@dataclass(frozen=True)
class Fixture:
    provider_match_id: str
    team_a: str
    team_b: str
    venue: str
    league: str
    start_time: datetime


@dataclass(frozen=True)
class Result:
    provider_match_id: str
    winner: str | None
    no_result: bool


class CricApiProvider:
    def __init__(self, base_url: str, api_key: str,
                 client: httpx.Client | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=20)

    def fetch(self, conn) -> tuple[list[Fixture], list[Result]]:
        resp = self.client.get(f"{self.base_url}/currentMatches",
                               params={"apikey": self.api_key, "offset": 0})
        resp.raise_for_status()
        payload = resp.json()
        fixtures: list[Fixture] = []
        results: list[Result] = []
        for m in payload.get("data", []):
            if m.get("matchType", "").lower() != "t20":
                continue
            try:
                teams = sorted(resolve(conn, "team", t) for t in m.get("teams", []))
                venue = resolve(conn, "venue", m.get("venue", ""))
            except UnresolvedEntityError as e:
                logger.warning("skipping match %s: unresolved %s", m.get("id"), e)
                continue
            if len(teams) != 2:
                continue
            if not m.get("matchEnded"):
                fixtures.append(Fixture(
                    provider_match_id=str(m["id"]),
                    team_a=teams[0], team_b=teams[1], venue=venue,
                    league=m.get("series", "T20"),
                    start_time=datetime.fromisoformat(
                        m["dateTimeGMT"]).replace(tzinfo=timezone.utc),
                ))
            else:
                status = m.get("status", "").lower()
                no_result = any(k in status for k in ABANDONED_MARKERS)
                winner_raw = m.get("matchWinner")
                winner = None
                if winner_raw and not no_result:
                    try:
                        winner = resolve(conn, "team", winner_raw)
                    except UnresolvedEntityError:
                        no_result = True   # can't attribute -> treat as void
                elif not no_result:
                    no_result = True       # ended without winner info -> void
                results.append(Result(
                    provider_match_id=str(m["id"]),
                    winner=winner, no_result=no_result))
        return fixtures, results
```

- [ ] **Step 5: Run, verify pass**

Run: `python -m pytest bot/tests/test_provider.py -v`
Expected: 2 PASS

- [ ] **Step 6: Commit**

```bash
git add bot/fixtures_provider.py bot/tests/test_provider.py bot/tests/data/provider_matches.json
git commit -m "feat(bot): CricAPI fixtures adapter with alias resolution and skip-on-unresolved"
```

---

### Task 9: Compose (templates, SHAP translation, data-driven trivia)

**Files:**
- Create: `bot/compose.py`, `bot/tests/test_compose.py`

**Interfaces:**
- Consumes: `FEATURE_NAMES` (Task 4); team_matches DataFrame for trivia.
- Produces: `FEATURE_PHRASES: dict[str, str]`; `prediction_post(team_a, team_b, prob_a, reasons: list[str], league) -> str`; `trivia_post(df, team_a, team_b, venue) -> str`; `result_post(team_a, team_b, prob_a, winner, season_correct, season_total) -> str`. All ≤280 chars, no betting words.

- [ ] **Step 1: Write failing tests**

`bot/tests/test_compose.py`:
```python
from datetime import date

import pandas as pd

from bot.compose import (FEATURE_PHRASES, prediction_post, result_post,
                         trivia_post)
from bot.features import FEATURE_NAMES

BANNED = ["bet", "odds", "stake", "wager", "gamble"]


def _tm(team, opp, won, venue="Wankhede Stadium, Mumbai", d=date(2025, 4, 1)):
    return dict(team=team, opponent=opp, date=d, season="2025", league="IPL",
                venue=venue, won=won, dls=False, runs_scored=160.0,
                overs_faced=20.0, runs_conceded=150.0, overs_bowled=20.0,
                home=False)


def test_every_feature_has_phrase():
    assert set(FEATURE_PHRASES) == set(FEATURE_NAMES)


def test_prediction_post_length_and_content():
    text = prediction_post("Chennai Super Kings", "Mumbai Indians", 0.64,
                           ["form5_a", "bat_rr_a", "h2h_a_rate"], "IPL")
    assert len(text) <= 280
    assert "64%" in text and "Chennai Super Kings" in text
    assert all(b not in text.lower() for b in BANNED)


def test_prediction_post_unknown_feature_falls_back():
    text = prediction_post("A", "B", 0.55, ["mystery_feature"], "IPL")
    assert len(text) <= 280   # falls back to generic phrase, no KeyError


def test_trivia_h2h_when_enough_meetings():
    rows = [_tm("A", "B", True), _tm("A", "B", True), _tm("A", "B", False),
            _tm("B", "A", False), _tm("B", "A", False), _tm("B", "A", True)]
    text = trivia_post(pd.DataFrame(rows), "A", "B", "Somewhere")
    assert "2" in text and len(text) <= 280   # A leads 2-1


def test_trivia_falls_back_to_venue_then_generic():
    venue_rows = [_tm("C", "D", True) for _ in range(6)]
    text = trivia_post(pd.DataFrame(venue_rows), "A", "B",
                       "Wankhede Stadium, Mumbai")
    assert len(text) <= 280
    empty = trivia_post(pd.DataFrame([], columns=list(_tm("x", "y", True))),
                        "A", "B", "Nowhere")
    assert len(empty) <= 280 and "A" in empty


def test_result_post_correct_and_wrong():
    right = result_post("A", "B", 0.64, "A", season_correct=23, season_total=31)
    wrong = result_post("A", "B", 0.64, "B", season_correct=23, season_total=31)
    assert "23/31" in right and len(right) <= 280
    assert "23/31" in wrong and len(wrong) <= 280
    assert right != wrong
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_compose.py -v`
Expected: FAIL — `No module named 'bot.compose'`

- [ ] **Step 3: Implement**

`bot/compose.py`:
```python
"""Post text composition. Everything <=280 chars, statistical language only."""
import logging
from datetime import date

import pandas as pd

logger = logging.getLogger(__name__)

FEATURE_PHRASES: dict[str, str] = {
    "form5_a": "recent form (last 5)",
    "form5_b": "opponent's recent form",
    "form10_a": "sustained form (last 10)",
    "form10_b": "opponent's sustained form",
    "h2h_a_rate": "head-to-head record",
    "venue_a_rate": "record at this venue",
    "venue_b_rate": "opponent's record at this venue",
    "bat_rr_a": "batting run-rate trend",
    "bat_rr_b": "opponent's batting run-rate",
    "bowl_econ_a": "bowling economy trend",
    "bowl_econ_b": "opponent's bowling economy",
    "home_a": "home advantage",
    "home_b": "opponent's home advantage",
}
GENERIC_PHRASE = "overall statistical edge"


def _phrase(feature: str) -> str:
    if feature not in FEATURE_PHRASES:
        logger.warning("no phrase for feature %s; using generic", feature)
        return GENERIC_PHRASE
    return FEATURE_PHRASES[feature]


def _truncate(text: str) -> str:
    return text if len(text) <= 280 else text[:277] + "..."


def prediction_post(team_a: str, team_b: str, prob_a: float,
                    reasons: list[str], league: str) -> str:
    fav, other, p = (team_a, team_b, prob_a) if prob_a >= 0.5 else \
        (team_b, team_a, 1 - prob_a)
    why = ", ".join(dict.fromkeys(_phrase(r) for r in reasons))
    text = (f"🔮 {league}: {fav} {round(p * 100)}% to beat {other}.\n"
            f"Why: {why}.\n"
            f"Model pick, publicly tracked. #Cricket")
    return _truncate(text)


def trivia_post(df: pd.DataFrame, team_a: str, team_b: str, venue: str) -> str:
    if len(df):
        h2h = df[(df["team"] == team_a) & (df["opponent"] == team_b)]
        if len(h2h) >= 3:
            wins_a = int(h2h["won"].sum())
            text = (f"📊 {team_a} vs {team_b}: {team_a} lead {wins_a}-"
                    f"{len(h2h) - wins_a} in their last {len(h2h)} meetings.\n"
                    f"Today's chapter starts soon. #Cricket")
            return _truncate(text)
        at_venue = df[df["venue"] == venue]
        if len(at_venue) >= 5:
            win_rate = at_venue["won"].mean()
            first = venue.split(",")[0]
            text = (f"📊 {first}: teams batting here have won "
                    f"{round(win_rate * 100)}% of recent matches.\n"
                    f"{team_a} vs {team_b} today. #Cricket")
            return _truncate(text)
    return _truncate(f"📊 {team_a} vs {team_b} today. "
                     f"Two lineups, one result. Numbers at stumps. #Cricket")


def result_post(team_a: str, team_b: str, prob_a: float, winner: str,
                season_correct: int, season_total: int) -> str:
    fav = team_a if prob_a >= 0.5 else team_b
    p = max(prob_a, 1 - prob_a)
    hit = winner == fav
    mark = "✅" if hit else "❌"
    verdict = "Called it" if hit else "Missed"
    text = (f"{mark} {verdict}: {fav} {round(p * 100)}% — {winner} won.\n"
            f"Season record: {season_correct}/{season_total}. "
            f"Every pick tracked, hits and misses. #Cricket")
    return _truncate(text)
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_compose.py -v`
Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/compose.py bot/tests/test_compose.py
git commit -m "feat(bot): post composer with SHAP phrase translation and data-driven trivia"
```

---

### Task 10: Poster (X client, dry-run, circuit breaker)

**Files:**
- Create: `bot/poster.py`, `bot/tests/test_poster.py`

**Interfaces:**
- Consumes: `posts` table (Task 1), `Settings` (Task 1).
- Produces: `TRIVIA_CUTOFF = 450`, `RESULTS_ONLY_CUTOFF = 490`; `month_post_count(conn, now: datetime) -> int`; `allowed(post_type: str, count: int) -> bool`; `class Poster(settings)` with `send(text: str) -> bool` (dry-run prints `DRY RUN POST:\n<text>` and returns True; live mode calls tweepy `Client.create_tweet(text=...)`, returns False on exception).

- [ ] **Step 1: Write failing tests**

`bot/tests/test_poster.py`:
```python
from datetime import datetime, timezone

from bot.config import Settings
from bot.db import posts
from bot.poster import (RESULTS_ONLY_CUTOFF, TRIVIA_CUTOFF, Poster, allowed,
                        month_post_count)


def _settings(dry=True):
    return Settings(database_url="", dry_run=dry, cricket_api_key="",
                    cricket_api_base="", x_api_key="", x_api_secret="",
                    x_access_token="", x_access_token_secret="")


def test_month_count_only_current_month(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(posts.insert().values(fixture_id=1, post_type="prediction",
                     state="posted", attempts=1,
                     posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc)))
        conn.execute(posts.insert().values(fixture_id=2, post_type="prediction",
                     state="posted", attempts=1,
                     posted_at=datetime(2026, 6, 30, tzinfo=timezone.utc)))
        conn.execute(posts.insert().values(fixture_id=3, post_type="prediction",
                     state="failed", attempts=1, posted_at=None))
        assert month_post_count(conn, now) == 1


def test_circuit_breaker_thresholds():
    assert allowed("trivia", TRIVIA_CUTOFF - 1) is True
    assert allowed("trivia", TRIVIA_CUTOFF) is False
    assert allowed("prediction", TRIVIA_CUTOFF) is True
    assert allowed("prediction", RESULTS_ONLY_CUTOFF) is False
    assert allowed("result", RESULTS_ONLY_CUTOFF) is True


def test_dry_run_prints_and_succeeds(capsys):
    p = Poster(_settings(dry=True))
    assert p.send("hello") is True
    assert "DRY RUN POST:" in capsys.readouterr().out
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_poster.py -v`
Expected: FAIL — `No module named 'bot.poster'`

- [ ] **Step 3: Implement**

`bot/poster.py`:
```python
"""X API v2 posting with dry-run and monthly quota circuit breaker.

Priority when near quota: prediction > result > trivia.
"""
import logging
from datetime import datetime

import sqlalchemy as sa

from .config import Settings
from .db import posts

logger = logging.getLogger(__name__)

TRIVIA_CUTOFF = 450        # at/above: stop trivia
RESULTS_ONLY_CUTOFF = 490  # at/above: results only


def month_post_count(conn, now: datetime) -> int:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return conn.execute(
        sa.select(sa.func.count()).select_from(posts).where(
            posts.c.state == "posted", posts.c.posted_at >= start)
    ).scalar_one()


def allowed(post_type: str, count: int) -> bool:
    if count >= RESULTS_ONLY_CUTOFF:
        return post_type == "result"
    if count >= TRIVIA_CUTOFF:
        return post_type != "trivia"
    return True


class Poster:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None

    def _x_client(self):
        if self._client is None:
            import tweepy
            self._client = tweepy.Client(
                consumer_key=self.settings.x_api_key,
                consumer_secret=self.settings.x_api_secret,
                access_token=self.settings.x_access_token,
                access_token_secret=self.settings.x_access_token_secret,
            )
        return self._client

    def send(self, text: str) -> bool:
        if self.settings.dry_run:
            print(f"DRY RUN POST:\n{text}\n")
            return True
        try:
            self._x_client().create_tweet(text=text)
            return True
        except Exception:
            logger.exception("X post failed")
            return False
```

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_poster.py -v`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add bot/poster.py bot/tests/test_poster.py
git commit -m "feat(bot): X poster with dry-run and quota circuit breaker"
```

---

### Task 11: Tick orchestration (run.py)

**Files:**
- Create: `bot/run.py`, `bot/tests/test_run.py`

**Interfaces:**
- Consumes: everything above — exact call chain in code below.
- Produces: `PREDICTION_WINDOW_H = 3`, `TRIVIA_WINDOW_H = 1`, `MAX_ATTEMPTS = 3`; `tick(conn, provider, artifact, poster, now: datetime) -> None`; CLI `python -m bot.run` builds real deps from `Settings.from_env()`, loads `bot/artifacts/model.pkl`, runs one tick.

- [ ] **Step 1: Write failing integration tests**

`bot/tests/test_run.py`:
```python
import json
from datetime import date, datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.db import fixtures, posts, predictions, team_matches
from bot.fixtures_provider import Fixture, Result
from bot.run import tick
from bot.tests.test_predict import _artifact
from bot.predict import load_artifact

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
```

- [ ] **Step 2: Run, verify fail**

Run: `python -m pytest bot/tests/test_run.py -v`
Expected: FAIL — `No module named 'bot.run'`

- [ ] **Step 3: Implement**

`bot/run.py`:
```python
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
from .db import fixtures, posts, predictions, team_matches
from .features import build_features
from .poster import allowed, month_post_count
from .predict import predict

logger = logging.getLogger(__name__)

PREDICTION_WINDOW_H = 3
TRIVIA_WINDOW_H = 1
MAX_ATTEMPTS = 3


def _load_team_matches(conn) -> pd.DataFrame:
    rows = conn.execute(sa.select(team_matches)).mappings().all()
    return pd.DataFrame([dict(r) for r in rows])


def _upsert_fixtures(conn, fixture_list) -> None:
    for f in fixture_list:
        exists = conn.execute(sa.select(fixtures.c.id).where(
            fixtures.c.provider_match_id == f.provider_match_id)).first()
        if exists:
            continue
        fid = conn.execute(fixtures.insert().values(
            provider_match_id=f.provider_match_id, team_a=f.team_a,
            team_b=f.team_b, venue=f.venue, league=f.league,
            start_time=f.start_time, status="upcoming")).inserted_primary_key[0]
        for post_type in ("prediction", "trivia"):
            conn.execute(posts.insert().values(
                fixture_id=fid, post_type=post_type, state="scheduled",
                attempts=0))


def _try_post(conn, poster, post_row, text: str, now: datetime) -> None:
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning("quota breaker: skipping %s (month count %d)",
                       post_row.post_type, count)
        return
    ok = poster.send(text)
    attempts = post_row.attempts + 1
    if ok:
        conn.execute(posts.update().where(posts.c.id == post_row.id).values(
            state="posted", attempts=attempts, text=text, posted_at=now))
    elif attempts >= MAX_ATTEMPTS:
        conn.execute(posts.update().where(posts.c.id == post_row.id).values(
            state="abandoned", attempts=attempts))
        logger.error("abandoning %s post after %d attempts",
                     post_row.post_type, attempts)
    else:
        conn.execute(posts.update().where(posts.c.id == post_row.id).values(
            state="failed", attempts=attempts))


def _due(conn, post_type: str, window_h: float, now: datetime):
    """Scheduled/failed posts of type whose fixture starts within window (not started)."""
    rows = conn.execute(
        sa.select(posts, fixtures.c.team_a, fixtures.c.team_b, fixtures.c.venue,
                  fixtures.c.league, fixtures.c.start_time, fixtures.c.id.label("fid"))
        .join(fixtures, fixtures.c.id == posts.c.fixture_id)
        .where(posts.c.post_type == post_type,
               posts.c.state.in_(["scheduled", "failed"]),
               fixtures.c.status == "upcoming")
    ).all()
    due, late = [], []
    for r in rows:
        start = r.start_time if r.start_time.tzinfo else \
            r.start_time.replace(tzinfo=timezone.utc)
        if start <= now:
            late.append(r)
        elif start - now <= timedelta(hours=window_h):
            due.append(r)
    return due, late


def _season_record(conn) -> tuple[int, int]:
    total = conn.execute(sa.select(sa.func.count()).select_from(predictions)
                         .where(predictions.c.outcome.in_(
                             ["correct", "incorrect"]))).scalar_one()
    correct = conn.execute(sa.select(sa.func.count()).select_from(predictions)
                           .where(predictions.c.outcome == "correct")).scalar_one()
    return correct, total


def tick(conn, provider, artifact, poster, now: datetime) -> None:
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
        feats = build_features(df, r.team_a, r.team_b, r.venue,
                               now.date(), home_team=None)
        prob, reasons = predict(artifact, feats)
        conn.execute(sa.dialects and sa.text("") if False else sa.select(1))
        existing = conn.execute(sa.select(predictions.c.id).where(
            predictions.c.fixture_id == r.fid)).first()
        if not existing:
            conn.execute(predictions.insert().values(
                fixture_id=r.fid, prob_team_a=prob,
                reasons_json=json.dumps(reasons),
                features_json=json.dumps(feats), created_at=now,
                outcome="pending"))
        text = prediction_post(r.team_a, r.team_b, prob, reasons, r.league)
        _try_post(conn, poster, r, text, now)
    for r in late:  # late-tick guard: never post at/after start
        conn.execute(posts.update().where(posts.c.id == r.id).values(
            state="abandoned"))
        logger.warning("late-tick guard: abandoned %s for fixture %d",
                       r.post_type, r.fid)

    # Trivia window
    due, late = _due(conn, "trivia", TRIVIA_WINDOW_H, now)
    for r in due:
        text = trivia_post(df, r.team_a, r.team_b, r.venue)
        _try_post(conn, poster, r, text, now)
    for r in late:
        conn.execute(posts.update().where(posts.c.id == r.id).values(
            state="abandoned"))

    # Results
    for res in result_list:
        frow = conn.execute(sa.select(fixtures).where(
            fixtures.c.provider_match_id == res.provider_match_id)).first()
        if not frow or frow.status != "upcoming":
            continue
        pred = conn.execute(sa.select(predictions).where(
            predictions.c.fixture_id == frow.id)).first()
        if res.no_result or res.winner is None:
            conn.execute(fixtures.update().where(fixtures.c.id == frow.id)
                         .values(status="void"))
            if pred:
                conn.execute(predictions.update().where(
                    predictions.c.id == pred.id).values(outcome="void"))
            continue
        conn.execute(fixtures.update().where(fixtures.c.id == frow.id).values(
            status="completed", winner=res.winner))
        if not pred:
            continue  # never predicted (e.g. discovered too late) -> no result post
        predicted_a = pred.prob_team_a >= 0.5
        actual_a = res.winner == frow.team_a
        outcome = "correct" if predicted_a == actual_a else "incorrect"
        conn.execute(predictions.update().where(
            predictions.c.id == pred.id).values(outcome=outcome))
        existing = conn.execute(sa.select(posts.c.id).where(
            posts.c.fixture_id == frow.id,
            posts.c.post_type == "result")).first()
        if not existing:
            conn.execute(posts.insert().values(
                fixture_id=frow.id, post_type="result", state="scheduled",
                attempts=0))
        prow = conn.execute(sa.select(posts).where(
            posts.c.fixture_id == frow.id, posts.c.post_type == "result",
            posts.c.state.in_(["scheduled", "failed"]))).first()
        if prow:
            correct, total = _season_record(conn)
            text = result_post(frow.team_a, frow.team_b, pred.prob_team_a,
                               res.winner, correct, total)
            _try_post(conn, poster, prow, text, now)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    from .config import get_settings
    from .db import get_engine
    from .fixtures_provider import CricApiProvider
    from .poster import Poster
    from .predict import load_artifact

    settings = get_settings()
    engine = get_engine(settings.database_url)
    artifact = load_artifact(Path("bot/artifacts/model.pkl"))
    provider = CricApiProvider(settings.cricket_api_base, settings.cricket_api_key)
    poster = Poster(settings)
    with engine.begin() as conn:
        tick(conn, provider, artifact, poster, datetime.now(timezone.utc))


if __name__ == "__main__":
    main()
```

Delete the stray `conn.execute(sa.dialects ...)` placeholder line when writing the file — it must not appear (artifact of plan editing; the real code has no such line).

- [ ] **Step 4: Run, verify pass**

Run: `python -m pytest bot/tests/test_run.py -v`
Expected: 7 PASS

- [ ] **Step 5: Run full bot suite**

Run: `python -m pytest bot/tests -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add bot/run.py bot/tests/test_run.py
git commit -m "feat(bot): idempotent tick orchestration with windows, retries, accuracy log"
```

---

### Task 12: Data ingest script + GitHub Actions workflows

**Files:**
- Create: `bot/ingest.py`, `.github/workflows/bot-ci.yml`, `.github/workflows/bot-run.yml`, `.github/workflows/bot-retrain.yml`, `bot/README.md`

**Interfaces:**
- Consumes: `build_team_matches` (Task 6), `seed_aliases` (Task 3), `metadata` (Task 1).
- Produces: CLI `python -m bot.ingest --cricsheet-dir DIR --league-map FILE --database-url URL` — creates tables, seeds aliases, replaces `team_matches` content.

- [ ] **Step 1: Write ingest script**

`bot/ingest.py`:
```python
"""Refresh the Neon feature store: create tables, seed aliases, reload team_matches.

Raw Cricsheet JSON stays local to the runner — only aggregates enter Postgres
(Neon 500MB free-tier budget).
"""
import argparse
import json
from pathlib import Path

import sqlalchemy as sa

from .aliases import seed_aliases
from .db import get_engine, metadata, team_matches
from .train import build_team_matches


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cricsheet-dir", type=Path, required=True)
    ap.add_argument("--league-map", type=Path, required=True)
    ap.add_argument("--database-url", required=True)
    args = ap.parse_args()

    df = build_team_matches(args.cricsheet_dir,
                            json.loads(args.league_map.read_text()))
    engine = get_engine(args.database_url)
    metadata.create_all(engine)
    with engine.begin() as conn:
        seed_aliases(conn)
        conn.execute(sa.delete(team_matches))
        conn.execute(team_matches.insert(),
                     df.to_dict(orient="records"))
    print(f"loaded {len(df)} team-match rows")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write CI workflow**

`.github/workflows/bot-ci.yml`:
```yaml
name: bot-ci
on:
  push:
    paths: ["bot/**", ".github/workflows/bot-*.yml"]
  pull_request:
    paths: ["bot/**"]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r bot/requirements.txt
      - run: python -m pytest bot/tests -v
        env:
          BOT_DRY_RUN: "1"
```

- [ ] **Step 3: Write cron workflow**

`.github/workflows/bot-run.yml`:
```yaml
name: bot-run
on:
  schedule:
    - cron: "0 */2 * * *"   # best-effort; tick logic is window-based
  workflow_dispatch:
    inputs:
      dry_run:
        description: "1 = dry run"
        default: "0"
jobs:
  tick:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r bot/requirements.txt
      - run: python -m bot.run
        env:
          BOT_DATABASE_URL: ${{ secrets.BOT_DATABASE_URL }}
          BOT_DRY_RUN: ${{ github.event.inputs.dry_run || '0' }}
          CRICKET_API_KEY: ${{ secrets.CRICKET_API_KEY }}
          X_API_KEY: ${{ secrets.X_API_KEY }}
          X_API_SECRET: ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_TOKEN_SECRET: ${{ secrets.X_ACCESS_TOKEN_SECRET }}
```

- [ ] **Step 4: Write retrain workflow**

`.github/workflows/bot-retrain.yml`:
```yaml
name: bot-retrain
on: workflow_dispatch
jobs:
  retrain:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r bot/requirements.txt
      - name: Download Cricsheet T20 archives
        run: |
          mkdir -p /tmp/cricsheet
          for comp in ipl bbl psl sat cpl hnd t20s; do
            curl -fsSL "https://cricsheet.org/downloads/${comp}_json.zip" \
              -o "/tmp/${comp}.zip" || continue
            unzip -oq "/tmp/${comp}.zip" -d "/tmp/cricsheet/${comp}"
            for f in /tmp/cricsheet/${comp}/*.json; do
              mv "$f" "/tmp/cricsheet/${comp}_$(basename "$f")"
            done
          done
      - name: Build league map
        run: |
          cat > /tmp/league_map.json <<'EOF'
          {"ipl": "IPL", "bbl": "BBL", "psl": "PSL", "sat": "SA20",
           "cpl": "CPL", "hnd": "The Hundred", "t20s": "T20I"}
          EOF
      - name: Refresh feature store
        run: python -m bot.ingest --cricsheet-dir /tmp/cricsheet \
               --league-map /tmp/league_map.json \
               --database-url "$BOT_DATABASE_URL"
        env:
          BOT_DATABASE_URL: ${{ secrets.BOT_DATABASE_URL }}
      - name: Train
        run: python -m bot.train --cricsheet-dir /tmp/cricsheet \
               --league-map /tmp/league_map.json --out bot/artifacts
      - name: Commit artifact
        run: |
          git config user.name "bot-retrain"
          git config user.email "actions@github.com"
          git add bot/artifacts/
          git commit -m "chore(bot): retrain model artifact" || echo "no changes"
          git push
```

Note: `build_team_matches` maps by file-stem prefix before `_` — the download step renames files to `ipl_<id>.json` etc. so prefixes match the league map. Cricsheet zip names (`ipl`, `bbl`, `psl`, `sat`, `cpl`, `hnd`, `t20s`) verified against cricsheet.org/downloads at implementation time; adjust any that 404 (the `|| continue` keeps the job alive).

- [ ] **Step 5: Write bot README**

`bot/README.md`:
```markdown
# The Cricket Fan — X Prediction Bot

Automated X account: T20 win predictions (calibrated LightGBM + SHAP reasons),
data-driven trivia, public accuracy record. See
`docs/superpowers/specs/2026-07-19-prediction-bot-design.md`.

## Setup (one-time)

1. Neon free-tier Postgres → set `BOT_DATABASE_URL` (postgresql+psycopg://...).
2. CricAPI key (free tier) → `CRICKET_API_KEY`.
3. X developer app (free tier, OAuth1 user context, write) → 4 X_* secrets.
4. Add all six as GitHub Actions secrets.
5. Run the `bot-retrain` workflow once: fills Neon + commits `bot/artifacts/`.
6. `bot-run` cron then posts automatically. Test first with
   `workflow_dispatch` + `dry_run=1`.

## Local dev

pip install -r bot/requirements.txt
python -m pytest bot/tests -v
BOT_DRY_RUN=1 BOT_DATABASE_URL=sqlite:///bot.db python -m bot.run

## Ship gate

`bot/artifacts/metrics.json` → `gate_passed` must be true (model beats Elo on
held-out log-loss + Brier). `python -m bot.train` exits non-zero otherwise.
```

- [ ] **Step 6: Verify workflows parse and full suite passes**

Run: `python -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/bot-*.yml')]; print('ok')"`
Expected: `ok`
Run: `python -m pytest bot/tests -v`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add bot/ingest.py bot/README.md .github/workflows/
git commit -m "feat(bot): ingest script, CI, cron and retrain workflows"
```

---

### Task 13: Full verification + backend regression

**Files:** none new.

- [ ] **Step 1: Full bot suite**

Run: `python -m pytest bot/tests -v`
Expected: all PASS

- [ ] **Step 2: Backend suite untouched and green**

Run: `cd backend && source .venv/bin/activate && python -m pytest && cd ..`
Expected: all PASS (backend files untouched — verify with `git status backend/`)

- [ ] **Step 3: Lint**

Run: `cd backend && source .venv/bin/activate && ruff check ../bot/ && ruff format --check ../bot/ && cd ..`
Expected: clean (fix any findings)

- [ ] **Step 4: End-to-end dry run against SQLite**

Run:
```bash
BOT_DRY_RUN=1 BOT_DATABASE_URL=sqlite:////tmp/bot-e2e.db python - <<'EOF'
from bot.db import get_engine, metadata
eng = get_engine("sqlite:////tmp/bot-e2e.db")
metadata.create_all(eng)
print("tables ok")
EOF
```
Expected: `tables ok` (full live e2e happens via workflow_dispatch dry_run=1 after secrets exist — manual user step)

- [ ] **Step 5: Commit any fixes, final commit**

```bash
git add -A bot/ && git commit -m "chore(bot): lint fixes and final verification" || echo "clean"
```

---

## Self-Review Notes

- **Spec coverage:** entity resolution (T3, T8), leakage guard (T4), season decay (T4), eliminator/DLS/no-result (T2), Elo gate (T6), SHAP reasons (T7) + translation (T9), window timing + late-tick guard + retries + void (T11), circuit breaker (T10, enforced in T11 `_try_post`), Neon aggregates-only (T12 ingest), dry-run (T10, CI), secrets (T12), all spec test requirements mapped (leakage T4, templates/state machine/provider parsing T8-T11, backtest gate T6, integration dry-run T11, backend green T13).
- **Known deferred item:** `home_team` is passed as `None` at inference (T11) — provider data lacks reliable home info; `home` flag still works in training data. Acceptable v1 simplification; noted for the alias/venue-based home inference as a later improvement.
- **Type consistency check:** `build_dataset` returns `(X, y, meta)` everywhere (T6 final form, T7, T11 tests import the final form). `Fixture`/`Result` fields match between T8 and T11. `posts.state` values consistent: scheduled/posted/failed/abandoned.
