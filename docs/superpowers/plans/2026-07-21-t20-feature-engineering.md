# T20 Feature Engineering: Venue Context + Phase Splits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add venue-scoring-context and team phase-split (powerplay/death-overs) features to the prediction model, and empirically verify each actually improves held-out 2026 accuracy/calibration before keeping it — the same way the `elo_expect_a` experiment was verified and then reverted after it showed no gain.

**Architecture:** Extend the existing Cricsheet parser (`bot/cricsheet.py`) to capture two more pieces of already-present-but-discarded ball-by-ball information (which team batted first, phase-bucketed runs/overs), thread them through the `team_matches` DB table (`bot/db.py`), and add derived features in `bot/features.py` using the same leakage-guarded, "only strictly-prior rows" pattern every existing feature already follows.

**Tech Stack:** Python 3.12, pandas, SQLAlchemy Core, pytest, LightGBM (via `bot/train.py`, unchanged).

## Global Constraints

- Ruff line length 99 chars; run `ruff format bot/ bot/tests/` and `ruff check bot/ bot/tests/` before each commit (project standard).
- TDD: write the failing test before the implementation for every code step (project standard, `superpowers:test-driven-development`).
- **No feature may depend on data unavailable at post time.** `PREDICTION_WINDOW_H = 3` (`bot/run.py:23`) means predictions post 1-3h before a match, cron is `0 */2 * * *` (every 2h, best-effort). Toss (~30min pre-match) and playing-XI/lineups (announced around toss, and CricAPI free tier's `currentMatches` payload has no squad array at all — only a `hasSquad: bool` flag behind a separate endpoint) are both **not available** at post time. This plan only adds features derivable from **historical Cricsheet aggregates**, which have no such timing constraint.
- Weather/dew is explicitly **out of scope for this plan** — deferred pending a venue→lat/lon lookup table and empirical justification that it's worth the added external dependency (see prior review: expected effect is small, mechanism is live-match not pre-match).
- `bot/ingest.py` fully deletes and re-inserts `team_matches` on every run (`conn.execute(sa.delete(team_matches))`) — it is a rebuildable cache table, not source of truth. Adding columns requires a one-time `DROP TABLE` before `create_all` (SQLAlchemy's `create_all` does not `ALTER TABLE` existing tables) — this is safe given the existing full-rebuild pattern, not a data-loss risk.
- Every new numeric feature must have a defined neutral/fallback value for the zero-history case, matching the existing convention (`NEUTRAL = 0.5` for rates, `GLOBAL_RR_PRIOR = 7.8` for run rates) — see `bot/tests/test_features.py::test_no_history_neutral_defaults`.

---

## Task 1: Cricsheet parser + DB schema — capture `batted_first` and phase-split totals

**Files:**
- Modify: `bot/cricsheet.py` (replace `_innings_totals` with `_innings_stats`, extend `TeamMatchRow`, extend `parse_result`)
- Modify: `bot/db.py:6-23` (add 5 columns to `team_matches`)
- Modify: `bot/ingest.py` (drop-then-recreate `team_matches` before `create_all`)
- Test: `bot/tests/test_cricsheet.py`
- Test: `bot/tests/test_db.py`

**Interfaces:**
- Consumes: nothing new (pure extension of existing Cricsheet JSON parsing).
- Produces: `TeamMatchRow` gains `batted_first: bool`, `pp_runs_scored: float | None`, `pp_overs_faced: float | None`, `death_runs_conceded: float | None`, `death_overs_bowled: float | None`. `team_matches` DB table gains matching columns. Task 2 and Task 3 read these columns from the `df` argument passed into `build_features`.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_cricsheet.py` (needs new imports `json` and `pytest` alongside the existing `from pathlib import Path`):

```python
import json

import pytest

from bot.cricsheet import parse_result

DATA = Path(__file__).parent / "data"


def test_batted_first_flag():
    rows = parse_result(DATA / "match_normal.json", league="IPL")
    by_team = {r.team: r for r in rows}
    # match_normal.json's innings[0].team is Chennai Super Kings
    assert by_team["Chennai Super Kings"].batted_first is True
    assert by_team["Royal Challengers Bengaluru"].batted_first is False


def test_phase_splits_powerplay_and_death(tmp_path):
    def over(idx, runs_per_ball):
        return {
            "over": idx,
            "deliveries": [
                {
                    "batter": "X",
                    "bowler": "Y",
                    "runs": {"batter": runs_per_ball, "extras": 0, "total": runs_per_ball},
                }
                for _ in range(6)
            ],
        }

    # Team A bats first: 8 runs/ball overs 0-5 (powerplay), 1 run/ball overs 6-14,
    # 10 runs/ball overs 15-19 (death).
    team_a_overs = (
        [over(i, 8) for i in range(6)]
        + [over(i, 1) for i in range(6, 15)]
        + [over(i, 10) for i in range(15, 20)]
    )
    # Team B bowls the above, then bats a flat 2 runs/ball (irrelevant to A's phase stats).
    team_b_overs = [over(i, 2) for i in range(20)]

    match = {
        "info": {
            "dates": ["2025-04-10"],
            "season": "2025",
            "venue": "V",
            "city": "City",
            "teams": ["Team A", "Team B"],
            "outcome": {"winner": "Team A"},
        },
        "innings": [
            {"team": "Team A", "overs": team_a_overs},
            {"team": "Team B", "overs": team_b_overs},
        ],
    }
    path = tmp_path / "match_phase.json"
    path.write_text(json.dumps(match))

    rows = parse_result(path, league="IPL")
    by_team = {r.team: r for r in rows}
    a = by_team["Team A"]
    b = by_team["Team B"]

    # A's own batting, powerplay: 6 overs * 6 balls * 8 runs = 288 runs / 6.0 overs.
    assert a.pp_runs_scored == 288
    assert a.pp_overs_faced == pytest.approx(6.0)
    # B's bowling, death overs (bowling to A): 5 overs * 6 balls * 10 runs = 300 / 5.0 overs.
    assert b.death_runs_conceded == 300
    assert b.death_overs_bowled == pytest.approx(5.0)
    assert a.batted_first is True
    assert b.batted_first is False
```

Add to `bot/tests/test_db.py`:

```python
def test_team_matches_has_phase_columns():
    from bot.db import team_matches

    cols = {c.name for c in team_matches.columns}
    assert {
        "batted_first",
        "pp_runs_scored",
        "pp_overs_faced",
        "death_runs_conceded",
        "death_overs_bowled",
    } <= cols
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_cricsheet.py bot/tests/test_db.py -v`
Expected: `test_batted_first_flag`, `test_phase_splits_powerplay_and_death`, `test_team_matches_has_phase_columns` all FAIL (`AttributeError: 'TeamMatchRow' object has no attribute 'batted_first'` / column not found).

- [ ] **Step 3: Extend `TeamMatchRow` and replace `_innings_totals` with `_innings_stats`**

In `bot/cricsheet.py`, replace the `TeamMatchRow` dataclass:

```python
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
    batted_first: bool
    pp_runs_scored: float | None
    pp_overs_faced: float | None
    death_runs_conceded: float | None
    death_overs_bowled: float | None
```

Replace `_innings_totals` with `_innings_stats`:

```python
def _innings_stats(data: dict) -> dict[str, dict[str, float]]:
    """team -> {runs, balls, pp_runs, pp_balls, death_runs, death_balls}.
    Powerplay = Cricsheet overs 0-5 (0-indexed); death = overs 15-19."""
    stats: dict[str, dict[str, float]] = {}
    for innings in data.get("innings", []):
        team = innings.get("team", "")
        if team in stats:
            continue
        runs = balls = pp_runs = pp_balls = death_runs = death_balls = 0.0
        for over in innings.get("overs", []):
            over_num = over.get("over", 0)
            is_pp = over_num < 6
            is_death = over_num >= 15
            for d in over.get("deliveries", []):
                total = d.get("runs", {}).get("total", 0)
                extras = d.get("extras", {})
                legal = "wides" not in extras and "noballs" not in extras
                runs += total
                if legal:
                    balls += 1
                if is_pp:
                    pp_runs += total
                    if legal:
                        pp_balls += 1
                if is_death:
                    death_runs += total
                    if legal:
                        death_balls += 1
        stats[team] = {
            "runs": runs,
            "balls": balls,
            "pp_runs": pp_runs,
            "pp_balls": pp_balls,
            "death_runs": death_runs,
            "death_balls": death_balls,
        }
    return stats
```

Update `parse_result` (only the body after `match_date = ...` changes):

```python
    match_date = date.fromisoformat(dates[0])
    stats = _innings_stats(data)
    innings_list = data.get("innings", [])
    first_batting_team = innings_list[0]["team"] if innings_list else None

    rows = []
    for team in teams:
        opponent = next(t for t in teams if t != team)
        scored = stats.get(team)
        conceded = stats.get(opponent)
        rows.append(
            TeamMatchRow(
                team=team,
                opponent=opponent,
                date=match_date,
                season=season,
                league=league,
                venue=venue,
                won=(team == winner),
                dls=dls,
                runs_scored=scored["runs"] if scored else None,
                overs_faced=scored["balls"] / 6.0 if scored else None,
                runs_conceded=conceded["runs"] if conceded else None,
                overs_bowled=conceded["balls"] / 6.0 if conceded else None,
                home=_is_home(team, city),
                batted_first=(team == first_batting_team),
                pp_runs_scored=scored["pp_runs"] if scored else None,
                pp_overs_faced=scored["pp_balls"] / 6.0 if scored else None,
                death_runs_conceded=conceded["death_runs"] if conceded else None,
                death_overs_bowled=conceded["death_balls"] / 6.0 if conceded else None,
            )
        )
    return rows
```

- [ ] **Step 4: Extend the DB schema**

In `bot/db.py`, in the `team_matches` table definition, after the existing `home` column:

```python
    sa.Column("home", sa.Boolean, nullable=False, default=False),
    sa.Column("batted_first", sa.Boolean, nullable=False, default=False),
    sa.Column("pp_runs_scored", sa.Float, nullable=True),
    sa.Column("pp_overs_faced", sa.Float, nullable=True),
    sa.Column("death_runs_conceded", sa.Float, nullable=True),
    sa.Column("death_overs_bowled", sa.Float, nullable=True),
)
```

- [ ] **Step 5: Handle the one-time schema migration in `ingest.py`**

In `bot/ingest.py`, in `main()`:

```python
    df = build_team_matches(args.cricsheet_dir, json.loads(args.league_map.read_text()))
    engine = get_engine(args.database_url)
    # Schema change: team_matches is a fully rebuildable cache (deleted + reinserted
    # below on every run), so a one-time drop is safe and picks up new columns that
    # create_all() alone would not add to an already-existing table.
    team_matches.drop(engine, checkfirst=True)
    metadata.create_all(engine)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_cricsheet.py bot/tests/test_db.py bot/tests/test_train.py -v`
Expected: all PASS (existing `test_normal_match_two_rows_winner_and_rates` etc. still pass unchanged since `_innings_stats`'s `runs`/`balls` computation is identical to the old `_innings_totals`).

- [ ] **Step 7: Full suite + lint, then commit**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests -q && ruff check bot/ bot/tests/ && ruff format --check bot/ bot/tests/`
Expected: all pass, no formatting diffs.

```bash
git add bot/cricsheet.py bot/db.py bot/ingest.py bot/tests/test_cricsheet.py bot/tests/test_db.py
git commit -m "feat(bot): capture batted_first and phase-split totals from Cricsheet"
```

---

## Task 2: Venue scoring-context features

**Files:**
- Modify: `bot/features.py`
- Modify: `bot/compose.py:9-23` (`FEATURE_PHRASES`)
- Test: `bot/tests/test_features.py`

**Interfaces:**
- Consumes: `batted_first`, `runs_scored`, `dls`, `venue`, `won` columns on the `df` passed into `build_features` (produced by Task 1).
- Produces: two new `FEATURE_NAMES` entries, `venue_avg_1st_innings` and `venue_chase_win_rate`, both venue-level (not team-specific — same value regardless of team_a/team_b ordering).

- [ ] **Step 1: Update the shared test fixture to carry the new columns**

In `bot/tests/test_features.py`, replace the `_row` helper (existing call sites are unaffected — all new params have defaults):

```python
def _row(
    team,
    opp,
    d,
    won,
    season="2025",
    venue="V",
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
```

Update `test_no_history_neutral_defaults`'s empty-df column list and assertions:

```python
def test_no_history_neutral_defaults():
    df = pd.DataFrame(
        columns=[
            "team",
            "opponent",
            "date",
            "season",
            "league",
            "venue",
            "won",
            "dls",
            "runs_scored",
            "overs_faced",
            "runs_conceded",
            "overs_bowled",
            "home",
            "batted_first",
            "pp_runs_scored",
            "pp_overs_faced",
            "death_runs_conceded",
            "death_overs_bowled",
        ]
    )
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["form5_a"] == 0.5 and f["h2h_a_rate"] == 0.5
    assert f["bat_rr_a"] == pytest.approx(7.8)  # global T20 prior
    assert f["venue_chase_win_rate"] == 0.5
    assert f["venue_avg_1st_innings"] == pytest.approx(156.0)  # 7.8 rr * 20 overs
```

Add a new dedicated test (self-contained, doesn't touch the shared `df` fixture so existing numeric assertions elsewhere stay valid):

```python
def test_venue_avg_first_innings_and_chase_rate():
    rows = [
        _row("P", "Q", date(2025, 1, 1), True, venue="Chinnaswamy", rs=180.0, batted_first=True),
        _row("Q", "P", date(2025, 1, 1), False, venue="Chinnaswamy", batted_first=False),
        _row("R", "S", date(2025, 1, 5), False, venue="Chinnaswamy", rs=200.0, batted_first=True),
        _row("S", "R", date(2025, 1, 5), True, venue="Chinnaswamy", batted_first=False),
    ]
    df = pd.DataFrame(rows)
    f = build_features(df, "A", "B", "Chinnaswamy", date(2025, 2, 1))
    # avg of the two batted-first innings: (180 + 200) / 2 = 190
    assert f["venue_avg_1st_innings"] == pytest.approx(190.0)
    # both batted-first==False rows WON (chased successfully) -> chase win rate 1.0
    assert f["venue_chase_win_rate"] == pytest.approx(1.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_features.py -v`
Expected: `test_venue_avg_first_innings_and_chase_rate` FAILS with `KeyError: 'venue_avg_1st_innings'`; other tests may also fail/error since `_row` now returns dict keys `build_features` doesn't yet consume (harmless extra columns, should not break existing tests — if any existing test breaks here, it indicates `build_features` chokes on an unrecognized column, which it must not; verify by re-reading `build_features` — it only reads columns it explicitly names, so extra columns are inert until Step 3 wires them in).

- [ ] **Step 3: Implement `venue_avg_1st_innings` and `venue_chase_win_rate`**

In `bot/features.py`, add to `FEATURE_NAMES` (after `venue_b_rate`):

```python
    "venue_a_rate",
    "venue_b_rate",
    "venue_avg_1st_innings",
    "venue_chase_win_rate",
```

Add a helper after `_run_rate`:

```python
def _venue_avg_first_innings(past: pd.DataFrame, venue: str) -> float:
    sub = past[(past["venue"] == venue) & past["batted_first"] & ~past["dls"]]
    sub = sub.dropna(subset=["runs_scored"])
    if sub.empty:
        return GLOBAL_RR_PRIOR * 20
    return float(sub["runs_scored"].mean())
```

In `build_features`, add to the returned dict (after `venue_b_rate`):

```python
        "venue_avg_1st_innings": _venue_avg_first_innings(past, venue),
        "venue_chase_win_rate": _weighted_rate(
            past[(past["venue"] == venue) & ~past["batted_first"]] if len(past) else past,
            season,
            None,
        ),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_features.py -v`
Expected: all PASS.

- [ ] **Step 5: Add compose.py phrases and run the full suite**

In `bot/compose.py`, in `FEATURE_PHRASES` (after `venue_b_rate`... actually insert after the `bowl_econ_b` block to match `FEATURE_NAMES` order, exact position doesn't matter — dict membership is what's tested):

```python
    "venue_a_rate": "record at this venue",
    "venue_b_rate": "opponent's record at this venue",
    "venue_avg_1st_innings": "venue's typical first-innings total",
    "venue_chase_win_rate": "venue's chase-success rate",
```

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests -q && ruff check bot/ bot/tests/ && ruff format --check bot/ bot/tests/`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add bot/features.py bot/compose.py bot/tests/test_features.py
git commit -m "feat(bot): add venue scoring-context features (avg 1st innings, chase win rate)"
```

---

## Task 3: Team phase-split features (powerplay batting tempo, death-overs economy)

**Files:**
- Modify: `bot/features.py`
- Modify: `bot/compose.py:9-23`
- Test: `bot/tests/test_features.py`

**Interfaces:**
- Consumes: `pp_runs_scored`, `pp_overs_faced`, `death_runs_conceded`, `death_overs_bowled` columns (produced by Task 1), and the existing `_run_rate` helper (no changes needed to `_run_rate` itself — it already takes column names as parameters).
- Produces: four new `FEATURE_NAMES` entries — `bat_pp_rr_a`, `bat_pp_rr_b`, `bowl_death_econ_a`, `bowl_death_econ_b`.

- [ ] **Step 1: Write the failing test**

Add to `bot/tests/test_features.py`:

```python
def test_phase_rates_distinct_from_whole_innings_rate():
    rows = [
        _row(
            "A",
            "X",
            date(2025, 4, 1),
            True,
            rs=160.0,
            of=20.0,  # whole-innings rr = 8.0
            pp_rs=60.0,
            pp_of=6.0,  # powerplay rr = 10.0 -- distinct from whole-innings
            rc=150.0,
            ob=20.0,
            death_rc=40.0,
            death_ob=5.0,  # death econ = 8.0
        )
    ]
    df = pd.DataFrame(rows)
    f = build_features(df, "A", "B", "V", date(2025, 5, 1))
    assert f["bat_pp_rr_a"] == pytest.approx(10.0)
    assert f["bowl_death_econ_a"] == pytest.approx(8.0)
    assert f["bat_pp_rr_a"] != pytest.approx(f["bat_rr_a"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_features.py::test_phase_rates_distinct_from_whole_innings_rate -v`
Expected: FAIL with `KeyError: 'bat_pp_rr_a'`.

- [ ] **Step 3: Implement the phase-rate features**

In `bot/features.py`, add to `FEATURE_NAMES` (after `bowl_econ_b`):

```python
    "bowl_econ_a",
    "bowl_econ_b",
    "bat_pp_rr_a",
    "bat_pp_rr_b",
    "bowl_death_econ_a",
    "bowl_death_econ_b",
```

In `build_features`, add to the returned dict (after the existing `bowl_econ_b` entry, reusing `_run_rate` exactly as the existing whole-innings features do):

```python
        "bat_pp_rr_a": _run_rate(a, "pp_runs_scored", "pp_overs_faced")
        if len(a)
        else GLOBAL_RR_PRIOR,
        "bat_pp_rr_b": _run_rate(b, "pp_runs_scored", "pp_overs_faced")
        if len(b)
        else GLOBAL_RR_PRIOR,
        "bowl_death_econ_a": _run_rate(a, "death_runs_conceded", "death_overs_bowled")
        if len(a)
        else GLOBAL_RR_PRIOR,
        "bowl_death_econ_b": _run_rate(b, "death_runs_conceded", "death_overs_bowled")
        if len(b)
        else GLOBAL_RR_PRIOR,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests/test_features.py -v`
Expected: all PASS.

- [ ] **Step 5: Add compose.py phrases and run the full suite**

In `bot/compose.py`, in `FEATURE_PHRASES`:

```python
    "bowl_econ_a": "bowling economy trend",
    "bowl_econ_b": "opponent's bowling economy",
    "bat_pp_rr_a": "powerplay batting tempo",
    "bat_pp_rr_b": "opponent's powerplay batting tempo",
    "bowl_death_econ_a": "death-overs bowling economy",
    "bowl_death_econ_b": "opponent's death-overs bowling economy",
```

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests -q && ruff check bot/ bot/tests/ && ruff format --check bot/ bot/tests/`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add bot/features.py bot/compose.py bot/tests/test_features.py
git commit -m "feat(bot): add powerplay batting tempo and death-overs economy features"
```

---

## Task 4: Re-ingest, retrain, and measure against baseline

**Files:**
- None modified — this task runs the pipeline and makes a keep/revert decision based on the result.

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: a decision, recorded as either an updated `bot/artifacts/` (if the new features win) or a revert of Tasks 2-3's feature code (if they don't — Task 1's schema work is harmless either way and can stay regardless of outcome, since unused columns cost nothing).

- [ ] **Step 1: Re-ingest into Neon with the new schema**

Run (uses the already-downloaded `/tmp/cricsheet` corpus and `/tmp/league_map.json` from the prior session):

```bash
set -a && source .env.local && set +a && source bot/.venv/bin/activate
python -m bot.ingest --cricsheet-dir /tmp/cricsheet --league-map /tmp/league_map.json --database-url "$BOT_DATABASE_URL"
```

Expected output: `loaded 17012 team-match rows` (row count unchanged — same matches, more columns per row).

- [ ] **Step 2: Retrain with the new features**

Run:

```bash
source bot/.venv/bin/activate
python -m bot.train --cricsheet-dir /tmp/cricsheet --league-map /tmp/league_map.json --out /tmp/artifacts_phase2
```

Expected: JSON metrics printed to stdout, `gate_passed: true` (must still beat the Elo baseline — this is a floor, not the bar we're actually evaluating against here).

- [ ] **Step 3: Compare against the current committed baseline**

Baseline (`bot/artifacts/metrics.json`, current committed model — 13 features, no venue/phase additions):

```json
{
  "model": {
    "accuracy": 0.6469816272965879,
    "log_loss": 0.6120703971475474,
    "brier": 0.21294593311355814
  }
}
```

Read `/tmp/artifacts_phase2/metrics.json` and compare `model.log_loss` and `model.brier` (the two metrics the ship gate itself uses — accuracy alone is a noisier signal, as the `elo_expect_a` experiment showed: identical accuracy digit, but log_loss/brier revealed the real regression).

- [ ] **Step 4: Apply the decision rule**

**If both `log_loss` and `brier` improve (lower) versus baseline:** the new features are a net win. Promote the artifact and keep the code:

```bash
cp /tmp/artifacts_phase2/metrics.json /tmp/artifacts_phase2/model.pkl bot/artifacts/
git add bot/artifacts/metrics.json bot/artifacts/model.pkl
git commit -m "chore(bot): retrain with venue-context and phase-split features"
```

**If neither improves, or the result is mixed (one better, one worse) with no clear win:** revert Task 2 and Task 3's feature code (keep Task 1's schema — it's inert cost if unused, and available for a future attempt), matching exactly how the `elo_expect_a` experiment was handled:

```bash
git log --oneline -5  # confirm the exact commits from Task 2 and Task 3
git revert --no-edit <task-3-commit-sha> <task-2-commit-sha>
source bot/.venv/bin/activate && python -m pytest bot/tests -q
```

Either way, report the actual before/after numbers — do not round up a marginal or mixed result into "it helped."

- [ ] **Step 5: Final full-suite confirmation**

Run: `source bot/.venv/bin/activate && python -m pytest bot/tests -q`
Expected: all tests pass regardless of which branch of Step 4 was taken.

---

## Self-Review Notes

- **Spec coverage:** venue avg 1st/2nd innings score → Task 2 (`venue_avg_1st_innings`; "2nd innings" collapses into `venue_chase_win_rate`, since a 2nd-innings *average score* isn't well-defined for successful chases that end early — chase-success-rate is the standard proxy and is what the original review recommended). Powerplay/death phase splits → Task 3. Toss → explicitly dropped (Global Constraints) with reasoning. Player-level matchups/depth, dew/weather, boundary dimensions → explicitly out of scope per the prior review, not silently dropped.
- **Placeholder scan:** none — every step has complete code, exact commands, and expected output.
- **Type consistency:** `TeamMatchRow` fields (Task 1) match the columns Task 2/3 read (`batted_first`, `pp_runs_scored`, `pp_overs_faced`, `death_runs_conceded`, `death_overs_bowled`) match the DB columns (Task 1) match the `_row()` test helper (Task 2). `FEATURE_NAMES` insertions match the keys added to `build_features`'s return dict match the `FEATURE_PHRASES` keys added to `compose.py` — verified name-by-name while drafting each task.
