# Standalone Trivia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On days with no upcoming T20 fixture in the next 24h, post 2-3 standalone cricket-trivia tweets at fixed daily UTC hours, using only the team-level data already in `team_matches`.

**Architecture:** A new pure-function module (`bot/trivia_standalone.py`) builds a pool of candidate facts (random head-to-head/venue stats, plus season records/extremes) from the existing `team_matches` DataFrame, each tagged with a `content_key`. `bot/run.py`'s `tick()` gets one new block: at a fixed trigger hour, if no fixture starts in the next 24h and this calendar slot hasn't posted yet, pick one candidate excluding facts posted in the last 30 days, and post it through the existing `_try_post()`/quota-breaker machinery so monthly cost accounting stays unified.

**Tech Stack:** Python 3.12, SQLAlchemy 2.0 (sync), pandas, pytest (SQLite in-memory for tests, Neon Postgres in production).

## Global Constraints

- Line length 99 chars (ruff enforced, `ruff check` / `ruff format` must pass on every file touched).
- No new dependencies.
- `bot/tests/conftest.py`'s `engine` fixture is SQLite in-memory (`sqlite:///:memory:`) — any schema code that runs during a test must not depend on Postgres-only DDL executing (guard by `conn.dialect.name == "postgresql"`).
- All post text must stay `<=280` chars (`compose._truncate` enforces this; reuse it, don't reimplement).
- Every new/changed function needs a failing test written first (TDD), then the minimal implementation, per this repo's existing test style (see `bot/tests/*.py`).
- Money: standalone posts go through the same `_try_post()`/`allowed()` quota breaker as every other post type — no separate cost-control path.

---

### Task 1: Schema — nullable `fixture_id`, `slot_key`, `trivia_log`, `ensure_schema()`

**Files:**
- Modify: `bot/db.py` (full file currently 92 lines)
- Modify: `bot/ingest.py:1-45`
- Test: `bot/tests/test_db.py`

**Interfaces:**
- Produces: `bot.db.trivia_log` (`sa.Table`, columns `id`, `content_key: str`, `posted_at: datetime`), `bot.db.ensure_schema(conn: sa.Connection) -> None`.
- Consumes: `bot.db.metadata` (existing), `bot.db.posts` (existing, modified in place).

- [ ] **Step 1: Write the failing tests**

Append to `bot/tests/test_db.py`:

```python
def test_posts_fixture_id_nullable_for_standalone(engine):
    from bot.db import posts

    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=None,
                post_type="standalone_trivia",
                state="scheduled",
                attempts=0,
                slot_key="2026-07-22-08",
            )
        )


def test_posts_slot_key_unique(engine):
    import sqlalchemy as sa
    from bot.db import posts

    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                fixture_id=None,
                post_type="standalone_trivia",
                state="scheduled",
                attempts=0,
                slot_key="2026-07-22-08",
            )
        )
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                posts.insert().values(
                    fixture_id=None,
                    post_type="standalone_trivia",
                    state="scheduled",
                    attempts=0,
                    slot_key="2026-07-22-08",
                )
            )


def test_trivia_log_table_roundtrip(engine):
    from datetime import datetime, timezone

    import sqlalchemy as sa
    from bot.db import trivia_log

    with engine.begin() as conn:
        conn.execute(
            trivia_log.insert().values(
                content_key="h2h:CSK:MI",
                posted_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
            )
        )
        got = conn.execute(sa.select(trivia_log.c.content_key)).scalar_one()
        assert got == "h2h:CSK:MI"


def test_ensure_schema_idempotent_on_sqlite(engine):
    """ensure_schema() must not run Postgres-only DDL (ALTER COLUMN ... DROP
    NOT NULL) against the sqlite test engine — that syntax doesn't exist in
    sqlite and would raise OperationalError."""
    from bot.db import ensure_schema

    with engine.begin() as conn:
        ensure_schema(conn)
        ensure_schema(conn)  # second call must also be a no-op, not an error
```

`test_db.py` already imports `sqlalchemy as sa` inside individual test functions rather than at module scope — add `import sqlalchemy as sa` at the top of the new roundtrip test (or reuse the existing per-test local import style already in the file). Also add `import pytest` at module top if not already present (check the existing file first — `test_settings_reads_env` already imports `pytest` at module scope, so it's already there).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_db.py -v`
Expected: FAIL — `ImportError: cannot import name 'trivia_log'` / `ensure_schema` and `IntegrityError` not raised (no `slot_key` column yet).

- [ ] **Step 3: Modify `bot/db.py`**

Add `slot_key` to `posts` and make `fixture_id` nullable (edit the existing `posts` table definition in place):

```python
posts = sa.Table(
    "posts",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("fixture_id", sa.Integer, nullable=True),
    sa.Column("post_type", sa.String(16), nullable=False),
    # 'prediction' | 'trivia' | 'result' | 'standalone_trivia'
    sa.Column("state", sa.String(16), nullable=False, default="scheduled"),
    # 'scheduled' | 'posted' | 'failed' | 'abandoned'
    sa.Column("attempts", sa.Integer, nullable=False, default=0),
    sa.Column("text", sa.Text, nullable=True),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("slot_key", sa.String(32), nullable=True, unique=True),
    sa.UniqueConstraint("fixture_id", "post_type", name="uq_post"),
)
```

Add a new table after `posts`:

```python
trivia_log = sa.Table(
    "trivia_log",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("content_key", sa.String(128), nullable=False, index=True),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False, index=True),
)
```

Add `ensure_schema` at the end of the file (after `get_engine`):

```python
def ensure_schema(conn: sa.Connection) -> None:
    """Idempotent, safe to call every tick. New tables (e.g. trivia_log) are
    created via create_all on any dialect. The already-existing `posts`
    table on the live Neon DB needs explicit migration DDL to pick up
    `slot_key` and the relaxed `fixture_id` constraint -- create_all() does
    not alter existing tables. That DDL is Postgres-only syntax
    (ALTER COLUMN ... DROP NOT NULL doesn't exist in SQLite), so it's
    guarded by dialect: the test suite's sqlite engine must skip it.
    """
    metadata.create_all(conn)
    if conn.dialect.name == "postgresql":
        conn.execute(sa.text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_key VARCHAR(32)"))
        conn.execute(sa.text("ALTER TABLE posts ALTER COLUMN fixture_id DROP NOT NULL"))
        conn.execute(
            sa.text("CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_slot_key ON posts(slot_key)")
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_db.py -v`
Expected: PASS (all tests including the 4 new ones)

- [ ] **Step 5: Wire `ensure_schema` into `ingest.py`**

In `bot/ingest.py`, change the import on line 14 from:

```python
from .db import get_engine, metadata, team_matches
```

to:

```python
from .db import ensure_schema, get_engine, team_matches
```

And change line 35 from:

```python
        metadata.create_all(conn)
```

to:

```python
        ensure_schema(conn)
```

- [ ] **Step 6: Run the full bot test suite to confirm no regressions**

Run: `cd bot && source .venv/bin/activate && python -m pytest -q`
Expected: all tests pass (same count as before plus the 4 new ones)

- [ ] **Step 7: Lint**

Run: `cd bot && source .venv/bin/activate && ruff check . && ruff format --check .`
Expected: `All checks passed!`

- [ ] **Step 8: Commit**

```bash
git add bot/db.py bot/ingest.py bot/tests/test_db.py
git commit -m "feat(bot): add trivia_log table and nullable posts.fixture_id for standalone trivia"
```

---

### Task 2: Quota breaker + `_try_post` success signal

**Files:**
- Modify: `bot/poster.py`
- Test: `bot/tests/test_poster.py`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `bot.poster.allowed(post_type: str, count: int) -> bool` (extended), `bot.poster._try_post` is in `bot/run.py` — this task only touches `allowed()`; `_try_post`'s return-type change happens in Task 4 alongside its only caller changes, to keep this task's diff focused on one file.

- [ ] **Step 1: Write the failing test**

Add to `bot/tests/test_poster.py` (next to `test_circuit_breaker_thresholds`):

```python
def test_circuit_breaker_treats_standalone_trivia_like_trivia():
    assert allowed("standalone_trivia", TRIVIA_CUTOFF - 1) is True
    assert allowed("standalone_trivia", TRIVIA_CUTOFF) is False
    assert allowed("standalone_trivia", RESULTS_ONLY_CUTOFF) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_poster.py::test_circuit_breaker_treats_standalone_trivia_like_trivia -v`
Expected: FAIL — `allowed("standalone_trivia", TRIVIA_CUTOFF)` currently returns `True` (only `"trivia"` is excluded).

- [ ] **Step 3: Modify `allowed()` in `bot/poster.py`**

Change:

```python
def allowed(post_type: str, count: int) -> bool:
    if count >= RESULTS_ONLY_CUTOFF:
        return post_type == "result"
    if count >= TRIVIA_CUTOFF:
        return post_type != "trivia"
    return True
```

to:

```python
def allowed(post_type: str, count: int) -> bool:
    if count >= RESULTS_ONLY_CUTOFF:
        return post_type == "result"
    if count >= TRIVIA_CUTOFF:
        return post_type not in ("trivia", "standalone_trivia")
    return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_poster.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Lint**

Run: `cd bot && source .venv/bin/activate && ruff check poster.py tests/test_poster.py`
Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add bot/poster.py bot/tests/test_poster.py
git commit -m "feat(bot): drop standalone_trivia under the same quota-breaker tier as trivia"
```

---

### Task 3: `bot/trivia_standalone.py` — candidate facts + picker

**Files:**
- Create: `bot/trivia_standalone.py`
- Test: `bot/tests/test_trivia_standalone.py`

**Interfaces:**
- Consumes: `bot.compose._truncate(text: str) -> str` (existing).
- Produces: `bot.trivia_standalone.build_candidates(df: pd.DataFrame) -> list[tuple[str, str]]` (list of `(content_key, text)`), `bot.trivia_standalone.pick_standalone_trivia(df: pd.DataFrame, recent_keys: set[str], rng: random.Random | None = None) -> tuple[str, str] | None`. Task 4 imports `pick_standalone_trivia` only.

- [ ] **Step 1: Write the failing tests**

Create `bot/tests/test_trivia_standalone.py`:

```python
from datetime import date

import pandas as pd
import pytest

from bot.trivia_standalone import build_candidates, pick_standalone_trivia


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
    keys = {k for k, _ in build_candidates(pd.DataFrame(rows))}
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
    h2h_keys = [k for k, _ in candidates if k.startswith("h2h:")]
    assert h2h_keys == ["h2h:Chennai Super Kings:Mumbai Indians"]


def test_venue_candidate_needs_at_least_five_home_matches():
    rows = [
        _row("A", "B", date(2026, 4, 1 + i), i % 2 == 0, home=True)
        for i in range(4)
    ]
    keys = {k for k, _ in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("venue:") for k in keys)


def test_record_candidates_exclude_dls_matches():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, dls=True, rs=250.0, rc=100.0),
        _row("A", "B", date(2026, 4, 2), True, rs=180.0, rc=150.0),
    ]
    texts = dict(build_candidates(pd.DataFrame(rows)))
    total_text = texts.get("record:highest_total:2026", "")
    assert "250" not in total_text


def test_best_chase_candidate_requires_batted_second_and_won():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, batted_first=True, rs=190.0),
        _row("A", "B", date(2026, 4, 2), True, batted_first=False, rs=175.0),
        _row("A", "B", date(2026, 4, 3), False, batted_first=False, rs=120.0),
    ]
    texts = dict(build_candidates(pd.DataFrame(rows)))
    assert "175" in texts["record:best_chase:2026"]


def test_pp_tempo_candidate_needs_minimum_overs_faced():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, pp_rs=60.0, pp_of=2.0),  # too few overs
    ]
    keys = {k for k, _ in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("record:best_pp_tempo") for k in keys)


def test_death_economy_candidate_needs_minimum_overs_bowled():
    rows = [
        _row("A", "B", date(2026, 4, 1), True, death_rc=5.0, death_ob=1.0),  # too few overs
    ]
    keys = {k for k, _ in build_candidates(pd.DataFrame(rows))}
    assert not any(k.startswith("record:best_death_economy") for k in keys)


def test_all_candidate_texts_fit_tweet_length():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1 + i), i % 2 == 0)
        for i in range(6)
    ]
    for _key, text in build_candidates(pd.DataFrame(rows)):
        assert len(text) <= 280


def test_pick_excludes_recent_keys():
    rows = [
        _row("Chennai Super Kings", "Mumbai Indians", date(2026, 4, 1 + i), i % 2 == 0)
        for i in range(6)
    ]
    df = pd.DataFrame(rows)
    all_keys = {k for k, _ in build_candidates(df)}
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
    all_keys = {k for k, _ in build_candidates(df)}
    import random

    picked = pick_standalone_trivia(df, all_keys, rng=random.Random(0))
    assert picked is not None  # falls back to allowing a repeat, never None here


def test_pick_returns_none_when_no_candidates_at_all():
    import random

    assert pick_standalone_trivia(pd.DataFrame(), set(), rng=random.Random(0)) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_trivia_standalone.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'bot.trivia_standalone'`

- [ ] **Step 3: Write `bot/trivia_standalone.py`**

```python
"""Standalone trivia facts for days with no upcoming fixture.

Each candidate carries a content_key identifying the underlying fact, so
run.py can exclude facts already posted in the last 30 days (see
db.trivia_log). Two styles, mirroring compose.trivia_post's existing
H2H/venue shape plus a season records/extremes pool.
"""

import random

import pandas as pd

from .compose import _truncate

MIN_H2H_MEETINGS = 3
MIN_VENUE_HOME_MATCHES = 5
MIN_PP_OVERS = 5.0  # powerplay is 6 overs; require most of it faced
MIN_DEATH_OVERS = 4.0  # require a meaningful chunk of death bowling


def _h2h_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    counts = df.groupby(["team", "opponent"]).size()
    out: list[tuple[str, str]] = []
    for (team, opponent), n in counts.items():
        if n < MIN_H2H_MEETINGS or team >= opponent:
            continue  # emit one direction per pair; team < opponent sorts the key
        h2h = df[(df["team"] == team) & (df["opponent"] == opponent)]
        wins = int(h2h["won"].sum())
        content_key = f"h2h:{team}:{opponent}"
        text = _truncate(
            f"📊 {team} vs {opponent}: {team} lead {wins}-{len(h2h) - wins} "
            f"in their last {len(h2h)} meetings. #Cricket"
        )
        out.append((content_key, text))
    return out


def _venue_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    out: list[tuple[str, str]] = []
    for venue, group in df.groupby("venue"):
        home_rows = group[group["home"]]
        if len(home_rows) < MIN_VENUE_HOME_MATCHES:
            continue
        win_rate = home_rows["won"].mean()
        first = venue.split(",")[0]
        content_key = f"venue:{venue}"
        text = _truncate(
            f"📊 {first}: home teams have won {round(win_rate * 100)}% "
            f"of recent matches here. #Cricket"
        )
        out.append((content_key, text))
    return out


def _record_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    if not len(df):
        return []
    latest_season = df["season"].max()
    season_df = df[(df["season"] == latest_season) & (~df["dls"])]
    out: list[tuple[str, str]] = []

    scored = season_df.dropna(subset=["runs_scored", "runs_conceded"])
    if len(scored):
        margins = (scored["runs_scored"] - scored["runs_conceded"]).abs()
        row = scored.loc[margins.idxmax()]
        margin = abs(row["runs_scored"] - row["runs_conceded"])
        content_key = f"record:win_margin:{latest_season}"
        text = _truncate(
            f"📊 Biggest scoring gap this season: {row['team']} "
            f"{round(row['runs_scored'])} vs {row['opponent']} "
            f"{round(row['runs_conceded'])} ({round(margin)}-run gap). #Cricket"
        )
        out.append((content_key, text))

    totals = season_df.dropna(subset=["runs_scored"])
    if len(totals):
        row = totals.loc[totals["runs_scored"].idxmax()]
        content_key = f"record:highest_total:{latest_season}"
        text = _truncate(
            f"📊 Highest total this season: {row['team']} "
            f"{round(row['runs_scored'])} vs {row['opponent']} at "
            f"{row['venue'].split(',')[0]}. #Cricket"
        )
        out.append((content_key, text))

    chases = season_df[~season_df["batted_first"] & season_df["won"]]
    chases = chases.dropna(subset=["runs_scored"])
    if len(chases):
        row = chases.loc[chases["runs_scored"].idxmax()]
        content_key = f"record:best_chase:{latest_season}"
        text = _truncate(
            f"📊 Best chase this season: {row['team']} ran down "
            f"{round(row['runs_scored'])} vs {row['opponent']} at "
            f"{row['venue'].split(',')[0]}. #Cricket"
        )
        out.append((content_key, text))

    pp = season_df.dropna(subset=["pp_runs_scored", "pp_overs_faced"])
    pp = pp[pp["pp_overs_faced"] >= MIN_PP_OVERS]
    if len(pp):
        rate = pp["pp_runs_scored"] / pp["pp_overs_faced"]
        row = pp.loc[rate.idxmax()]
        best_rate = rate.loc[rate.idxmax()]
        content_key = f"record:best_pp_tempo:{latest_season}"
        text = _truncate(
            f"📊 Fastest powerplay this season: {row['team']} at "
            f"{round(best_rate, 1)} runs/over vs {row['opponent']}. #Cricket"
        )
        out.append((content_key, text))

    death = season_df.dropna(subset=["death_runs_conceded", "death_overs_bowled"])
    death = death[death["death_overs_bowled"] >= MIN_DEATH_OVERS]
    if len(death):
        rate = death["death_runs_conceded"] / death["death_overs_bowled"]
        row = death.loc[rate.idxmin()]
        best_rate = rate.loc[rate.idxmin()]
        content_key = f"record:best_death_economy:{latest_season}"
        text = _truncate(
            f"📊 Best death-overs economy this season: {row['team']} conceded "
            f"{round(best_rate, 1)} runs/over vs {row['opponent']}. #Cricket"
        )
        out.append((content_key, text))

    return out


def build_candidates(df: pd.DataFrame) -> list[tuple[str, str]]:
    return _h2h_candidates(df) + _venue_candidates(df) + _record_candidates(df)


def pick_standalone_trivia(
    df: pd.DataFrame, recent_keys: set[str], rng: random.Random | None = None
) -> tuple[str, str] | None:
    rng = rng or random.Random()
    candidates = build_candidates(df)
    if not candidates:
        return None
    pool = [c for c in candidates if c[0] not in recent_keys]
    if not pool:
        pool = candidates  # every candidate excluded -- repeat beats silence
    return rng.choice(pool)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_trivia_standalone.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Lint**

Run: `cd bot && source .venv/bin/activate && ruff check trivia_standalone.py tests/test_trivia_standalone.py && ruff format --check trivia_standalone.py tests/test_trivia_standalone.py`
Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add bot/trivia_standalone.py bot/tests/test_trivia_standalone.py
git commit -m "feat(bot): standalone trivia candidate facts (H2H/venue/records) and picker"
```

---

### Task 4: Wire standalone trivia into `run.py`'s `tick()`

**Files:**
- Modify: `bot/run.py`
- Test: `bot/tests/test_run.py`

**Interfaces:**
- Consumes: `bot.trivia_standalone.pick_standalone_trivia` (Task 3), `bot.db.trivia_log` (Task 1), `bot.poster.allowed` (Task 2, already wired through `_try_post`).
- Produces: `bot.run.STANDALONE_TRIVIA_HOURS: set[int]`, `bot.run._try_post(...) -> bool` (changed from `-> None`), `bot.run._has_upcoming_fixture_within_24h(conn, now) -> bool`, `bot.run._recent_trivia_keys(conn, now) -> set[str]`.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_run.py`. The shared `conn` fixture's 12 `team_matches`
rows (6 Chennai Super Kings, 6 Mumbai Indians, all at Wankhede Stadium) don't
just satisfy the H2H threshold — tracing them through `build_candidates()`
also satisfies the venue-win-rate threshold (6 Mumbai Indians rows have
`home=True`, >= `MIN_VENUE_HOME_MATCHES`), and the win-margin/highest-total/
best-chase record thresholds (the fixture never sets `batted_first`, which
defaults to `False`, so every `won=True` row counts as a "chase"). So this
fixture yields 5 candidates, not 1 — tests below use `build_candidates()`
directly to compute the real candidate set rather than hardcoding which one
gets picked, since which single one is chosen is genuinely random:

```python
def test_standalone_trivia_posts_when_no_fixture_and_trigger_hour(conn, art):
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)  # 08:00 UTC trigger hour
    tick(conn, FakeProvider([], []), art, poster, now)
    assert len(poster.sent) == 1
    row = conn.execute(
        sa.select(posts.c.post_type, posts.c.slot_key, posts.c.state)
    ).one()
    assert row.post_type == "standalone_trivia"
    assert row.slot_key == "2026-07-19-08"
    assert row.state == "posted"


def test_standalone_trivia_skipped_outside_trigger_hours(conn, art):
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 9, 0, tzinfo=timezone.utc)  # not in {8, 14, 20}
    tick(conn, FakeProvider([], []), art, poster, now)
    assert poster.sent == []


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

    valid_keys = {k for k, _ in build_candidates(_load_team_matches(conn))}
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
    count = conn.execute(sa.select(sa.func.count()).select_from(trivia_log)).scalar_one()
    assert count == 0


def test_standalone_trivia_respects_30_day_dedup(conn, art):
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    all_keys = {k for k, _ in build_candidates(_load_team_matches(conn))}
    assert len(all_keys) >= 2  # fixture must offer >1 candidate for this test to prove anything
    kept, *excluded = sorted(all_keys)  # deterministic: keep exactly one candidate available
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
    keys = conn.execute(
        sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at == now)
    ).scalars().all()
    assert keys == [kept]  # the only non-excluded candidate must be the one picked
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_run.py -k standalone -v`
Expected: FAIL — `tick()` never creates a `standalone_trivia` post yet, so e.g. `test_standalone_trivia_posts_when_no_fixture_and_trigger_hour`'s `sa.select(...).one()` raises `sqlalchemy.exc.NoResultFound` (the `posts` table is empty since `FakeProvider([], [])` supplies no fixtures).

- [ ] **Step 3: Modify `bot/run.py`**

Change the import line near the top from:

```python
from .db import fixtures, posts, predictions, team_matches
```

to:

```python
from .db import fixtures, posts, predictions, team_matches, trivia_log
```

Add the new import for the picker, next to the other same-package imports:

```python
from .trivia_standalone import pick_standalone_trivia
```

Add two new module-level constants next to the existing ones:

```python
STANDALONE_TRIVIA_HOURS = {8, 14, 20}
TRIVIA_LOG_LOOKBACK_DAYS = 30
```

Change `_try_post`'s signature and return values (it currently returns `None` implicitly everywhere; make every path return a `bool` indicating whether the post reached `state="posted"`):

```python
def _try_post(conn, poster, post_row, text: str, now: datetime) -> bool:
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning(
            "quota breaker: skipping %s (month count %d)", post_row.post_type, count
        )
        return False
    ok = poster.send(text)
    attempts = post_row.attempts + 1
    if ok:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="posted", attempts=attempts, text=text, posted_at=now)
        )
        posted = True
    elif attempts >= MAX_ATTEMPTS:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="abandoned", attempts=attempts)
        )
        logger.error(
            "abandoning %s post after %d attempts", post_row.post_type, attempts
        )
        posted = False
    else:
        conn.execute(
            posts.update()
            .where(posts.c.id == post_row.id)
            .values(state="failed", attempts=attempts)
        )
        posted = False
    # Commit immediately: poster.send() is an irreversible external side effect.
    # If a later step in this tick raises, only this state update must survive
    # the rollback -- otherwise the next tick would resend an already-posted tweet.
    conn.commit()
    return posted
```

Add two new helper functions near `_due()` (same style: fetch rows, normalize tz in Python rather than pushing the comparison into SQL, matching how `_due()` already handles naive vs. aware `start_time` values):

```python
def _has_upcoming_fixture_within_24h(conn, now: datetime) -> bool:
    rows = conn.execute(
        sa.select(fixtures.c.start_time).where(fixtures.c.status == "upcoming")
    ).all()
    for r in rows:
        start = (
            r.start_time
            if r.start_time.tzinfo
            else r.start_time.replace(tzinfo=timezone.utc)
        )
        if now <= start <= now + timedelta(hours=24):
            return True
    return False


def _recent_trivia_keys(conn, now: datetime) -> set[str]:
    cutoff = now - timedelta(days=TRIVIA_LOG_LOOKBACK_DAYS)
    rows = conn.execute(
        sa.select(trivia_log.c.content_key).where(trivia_log.c.posted_at >= cutoff)
    ).all()
    return {r.content_key for r in rows}
```

Add the standalone-trivia block inside `tick()`, immediately after the existing "Results" `for res in result_list:` loop (i.e. at the end of the function body, before the function ends):

```python
    # Standalone trivia (quiet-day filler, no fixture involved)
    if now.hour in STANDALONE_TRIVIA_HOURS and not _has_upcoming_fixture_within_24h(
        conn, now
    ):
        slot_key = now.strftime("%Y-%m-%d-%H")
        existing_slot = conn.execute(
            sa.select(posts.c.id).where(posts.c.slot_key == slot_key)
        ).first()
        if not existing_slot:
            recent_keys = _recent_trivia_keys(conn, now)
            picked = pick_standalone_trivia(df, recent_keys)
            if picked:
                content_key, text = picked
                post_id = conn.execute(
                    posts.insert().values(
                        fixture_id=None,
                        post_type="standalone_trivia",
                        state="scheduled",
                        attempts=0,
                        slot_key=slot_key,
                    )
                ).inserted_primary_key[0]
                post_row = conn.execute(
                    sa.select(posts).where(posts.c.id == post_id)
                ).one()
                posted = _try_post(conn, poster, post_row, text, now)
                if posted:
                    conn.execute(
                        trivia_log.insert().values(
                            content_key=content_key, posted_at=now
                        )
                    )
                    conn.commit()
```

`df` here is the same `team_matches` DataFrame already loaded earlier in `tick()` via `df = _load_team_matches(conn)` — no new load needed.

Finally, wire `ensure_schema` into `main()`. Change:

```python
    settings = get_settings()
    engine = get_engine(settings.database_url)
    artifact = load_artifact(Path(__file__).resolve().parent / "artifacts" / "model.pkl")
    provider = CricApiProvider(settings.cricket_api_base, settings.cricket_api_key)
    poster = Poster(settings)
    with engine.connect() as conn:
        tick(conn, provider, artifact, poster, datetime.now(timezone.utc))
        conn.commit()
```

to:

```python
    settings = get_settings()
    engine = get_engine(settings.database_url)
    artifact = load_artifact(Path(__file__).resolve().parent / "artifacts" / "model.pkl")
    provider = CricApiProvider(settings.cricket_api_base, settings.cricket_api_key)
    poster = Poster(settings)
    with engine.connect() as conn:
        ensure_schema(conn)
        conn.commit()
        tick(conn, provider, artifact, poster, datetime.now(timezone.utc))
        conn.commit()
```

and change the `from .db import get_engine` line inside `main()` to `from .db import ensure_schema, get_engine`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bot && source .venv/bin/activate && python -m pytest tests/test_run.py -v`
Expected: PASS (all tests, including the 7 new standalone-trivia ones)

- [ ] **Step 5: Run the full bot test suite**

Run: `cd bot && source .venv/bin/activate && python -m pytest -q`
Expected: all tests pass

- [ ] **Step 6: Lint**

Run: `cd bot && source .venv/bin/activate && ruff check . && ruff format --check .`
Expected: `All checks passed!`

- [ ] **Step 7: Commit**

```bash
git add bot/run.py bot/tests/test_run.py
git commit -m "feat(bot): post standalone trivia at fixed hours when no fixture is upcoming"
```

---

## After implementation

The schema change (`slot_key`, nullable `fixture_id`, `trivia_log`) needs to reach the live Neon DB before `bot-run`'s cron can use it. `ensure_schema()` runs automatically at the top of every `run.main()` invocation, so the very next scheduled tick (within 2h of merge) applies it — no manual `bot-retrain` run is required, unlike the initial setup. Confirm by checking the next `bot-run` Actions run's logs, or by watching for a `standalone_trivia` row in `posts` after the next trigger-hour tick with no live match.
