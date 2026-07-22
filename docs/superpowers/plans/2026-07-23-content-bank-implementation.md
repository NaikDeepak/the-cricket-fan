# Content Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, independent standalone-trivia content source — a `content_bank` table of Wikipedia-sourced historical records plus hand-authored anecdotes/stories (single tweets and 2–4 tweet threads) — without touching the existing Cricsheet-derived path.

**Architecture:** New `content_bank` table seeded once by a local two-phase script (`--draft` fetches Wikipedia records + writes a review file; `--commit` inserts the reviewed file). Its rows flow into `pick_standalone_trivia` alongside Cricsheet candidates through the same 30-day `trivia_log` dedup. Candidate tuples widen from `(content_key, text)` to `(content_key, format, segments)`. `Poster` gains `send_thread` for multi-tweet posts; `posts` gains a `tweet_count` column so the monthly spend cap counts tweets, not rows.

**Tech Stack:** Python 3.12, SQLAlchemy 2.0 (core `Table`/`MetaData`, sync `Engine`/`Connection`), pandas (`read_html`), requests (MediaWiki API), tweepy (X posting), pytest (SQLite in-memory).

## Global Constraints

- Line length 99 chars; `ruff check bot/ && ruff format bot/` must pass.
- Sync SQLAlchemy core only — this `bot/` package uses `sa.Engine`/`sa.Connection`, **not** async ORM (the async ORM rule in CLAUDE.md is the parked web app, not the bot).
- No new runtime LLM path; no `GEMINI_API_KEY`. Anecdote/story prose is hand-authored during the seed review, never generated per-tick.
- All post text ≤ 280 chars per segment; statistical / own-phrasing language, no verbatim Wikipedia prose.
- Facts-only sourcing: raw records (name/number/format/date) templated into the bot's own sentence.
- Tests run on SQLite in-memory (`bot/tests/conftest.py` `engine` fixture); schema is created via `metadata.create_all`. Postgres-only DDL in `ensure_schema` must be dialect-guarded (`conn.dialect.name == "postgresql"`), mirroring the existing `slot_key` retrofit.
- Tests never hit the live Wikipedia API — parse a captured fixture under `bot/tests/data/`.
- `content_bank` is **additive**: existing Cricsheet candidates (`h2h:`, `venue:`, `record:`) in `trivia_standalone.py` and the `team_matches` path are unchanged in behavior.
- Run tests from repo root: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/...` (imports are `from bot...`).

---

## File Structure

- `bot/db.py` — add `content_bank` table; add `tweet_count` column to `posts`; extend `ensure_schema` Postgres branch with a `tweet_count` ALTER. Document `"partial"` as a valid `state`.
- `bot/poster.py` — `month_post_count` `COUNT(*)` → `COALESCE(SUM(tweet_count),0)` over `state IN ('posted','partial')`; add `Poster.send_thread`.
- `bot/trivia_standalone.py` — widen `build_candidates` output to `(content_key, format, segments)` via a mechanical wrapper; add `_content_bank_candidates(conn)`; `pick_standalone_trivia` takes optional `conn` and merges the two pools.
- `bot/run.py` — pass `conn` to `pick_standalone_trivia`; unpack the widened tuple; replace the standalone `_try_post` call with a new `_post_standalone` helper that handles single + thread, `partial` state, `tweet_count`, and `trivia_log` logging.
- `bot/scripts/__init__.py`, `bot/scripts/seed_content_bank.py` — new local two-phase seed script.
- Tests: `bot/tests/test_db.py`, `test_poster.py`, `test_trivia_standalone.py`, `test_run.py` updated; new `bot/tests/test_seed_content_bank.py`; new fixture `bot/tests/data/wiki_records_sample.html`.

---

## Design decisions locked from brainstorming + review (read before Task 1)

1. **Separate `_post_standalone`, not a reshape of `_try_post`.** `_try_post` is shared by prediction/trivia/result (all single-tweet); widening its signature would ripple into three unrelated call sites. Threads occur only in the standalone block, so they get their own helper.
2. **`tweet_count` needs a server-side default (prod-only bug otherwise).** On the live populated Neon `posts` table, `ADD COLUMN tweet_count INTEGER NOT NULL` fails without `DEFAULT 1`. Define the column with `server_default=sa.text("1")` (not just Python `default=1`) so the `create_all` DDL and the `ALTER` agree, and write the ALTER as `ADD COLUMN IF NOT EXISTS tweet_count INTEGER NOT NULL DEFAULT 1`.
3. **`month_post_count` must include `partial` and partials must set `posted_at`** — an inference past the spec's literal "COUNT→SUM" line, forced by its own cost rationale: a partial thread's already-public tweets are billed, so they must count against the cap. Filter `state IN ('posted','partial')`, `COALESCE(SUM(...),0)`, and set `posted_at=now` whenever `tweets_sent > 0` (else the `posted_at >= start` filter silently drops partials).
4. **Content-key namespacing.** `content_bank` keys are prefixed `wiki_record:`, `anecdote:`, `story:` so they can never collide with Cricsheet `h2h:`/`venue:`/`record:` keys in the shared `trivia_log`.
5. **Log on `tweets_sent > 0`.** A partial thread is partially public, so its `content_key` is logged to `trivia_log` (prevents a repost). Full failure (`tweets_sent == 0`) is not logged — matches the existing single-tweet convention.
6. **Seed script honesty.** Tests parse a captured MediaWiki HTML fixture, never the live API. `wiki_record` templating is fully specified/tested. Anecdote/story entries are written by `--draft` as empty-`segments` **skeletons** for hand-authoring — scaffold, not fabricated prose. `--commit` (read file → insert → skip existing `content_key`) is fully tested.

---

### Task 1: Schema — `content_bank` table + `posts.tweet_count` + `partial` state

**Files:**
- Modify: `bot/db.py`
- Test: `bot/tests/test_db.py`

**Interfaces:**
- Produces: `content_bank` table with columns `id, category, format, segments_json, content_key (unique), source, created_at`; `posts.tweet_count` (`Integer NOT NULL`, server default `1`); `ensure_schema` idempotent on both SQLite and Postgres.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_db.py`:

```python
import sqlalchemy as sa

from bot.db import content_bank, ensure_schema, metadata, posts


def test_content_bank_table_roundtrips(engine):
    from datetime import datetime, timezone

    with engine.begin() as conn:
        conn.execute(
            content_bank.insert().values(
                category="wiki_record",
                format="single",
                segments_json='["fact"]',
                content_key="wiki_record:test:most-runs",
                source="wikipedia:List_of_Test_cricket_records",
                created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
            )
        )
        row = conn.execute(sa.select(content_bank)).one()
    assert row.content_key == "wiki_record:test:most-runs"
    assert row.format == "single"


def test_content_key_is_unique(engine):
    from datetime import datetime, timezone

    vals = dict(
        category="anecdote",
        format="single",
        segments_json='["x"]',
        content_key="anecdote:dupe",
        source="wikipedia:X",
        created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
    )
    with engine.begin() as conn:
        conn.execute(content_bank.insert().values(**vals))
        with pytest_raises_integrity():
            conn.execute(content_bank.insert().values(**vals))


def test_posts_insert_defaults_tweet_count_to_one(engine):
    with engine.begin() as conn:
        pid = conn.execute(
            posts.insert().values(post_type="standalone_trivia", state="posted")
        ).inserted_primary_key[0]
        tc = conn.execute(
            sa.select(posts.c.tweet_count).where(posts.c.id == pid)
        ).scalar_one()
    assert tc == 1


def test_ensure_schema_idempotent_on_sqlite(engine):
    with engine.connect() as conn:
        ensure_schema(conn)
        ensure_schema(conn)  # second call must not raise


import contextlib


@contextlib.contextmanager
def pytest_raises_integrity():
    import pytest

    with pytest.raises(sa.exc.IntegrityError):
        yield
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_db.py -v`
Expected: FAIL — `ImportError: cannot import name 'content_bank'` (and `posts` has no `tweet_count`).

- [ ] **Step 3: Add the `content_bank` table and `tweet_count` column**

In `bot/db.py`, add the `tweet_count` column to the existing `posts` table definition (place it after the `text` column):

```python
    sa.Column("tweet_count", sa.Integer, nullable=False, server_default=sa.text("1")),
```

Update the `posts.state` comment to include the new value:

```python
    sa.Column("state", sa.String(16), nullable=False, default="scheduled"),
    # 'scheduled' | 'posted' | 'partial' | 'failed' | 'abandoned'
```

Add the new table after `trivia_log`:

```python
content_bank = sa.Table(
    "content_bank",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("category", sa.String(16), nullable=False),
    # 'wiki_record' | 'anecdote' | 'story'
    sa.Column("format", sa.String(8), nullable=False),
    # 'single' | 'thread'
    sa.Column("segments_json", sa.Text, nullable=False),
    # JSON list[str]; len == 1 for 'single', 2-4 for 'thread'
    sa.Column("content_key", sa.String(128), nullable=False, unique=True),
    sa.Column("source", sa.String(256), nullable=False),
    # e.g. "wikipedia:List_of_Test_cricket_records" -- traceability, not shown
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
```

- [ ] **Step 4: Extend `ensure_schema` Postgres branch for the live `posts` table**

`create_all` creates `content_bank` on any dialect, but it does **not** add `tweet_count` to the already-live `posts` table. Add this line to the `if conn.dialect.name == "postgresql":` block in `ensure_schema` (alongside the existing `slot_key` ALTERs):

```python
        conn.execute(
            sa.text(
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS "
                "tweet_count INTEGER NOT NULL DEFAULT 1"
            )
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_db.py -v`
Expected: PASS (all four new tests).

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/db.py bot/tests/test_db.py && ruff format bot/db.py bot/tests/test_db.py
git add bot/db.py bot/tests/test_db.py
git commit -m "feat(bot): add content_bank table and posts.tweet_count column"
```

---

### Task 2: Widen candidate tuples to `(content_key, format, segments)`

**Files:**
- Modify: `bot/trivia_standalone.py:131-132` (`build_candidates`)
- Modify: `bot/tests/test_trivia_standalone.py`
- Modify: `bot/tests/test_run.py:371,397`

**Interfaces:**
- Consumes: existing `_h2h_candidates`/`_venue_candidates`/`_record_candidates` (unchanged — still return `list[tuple[str, str]]`).
- Produces: `build_candidates(df) -> list[tuple[str, str, list[str]]]` — every Cricsheet candidate becomes `(content_key, "single", [text])`.

- [ ] **Step 1: Update the existing tests to the widened shape (they are the failing tests)**

In `bot/tests/test_trivia_standalone.py`, replace every unpack of the old 2-tuple. Concretely:

- Line 50: `assert build_candidates(pd.DataFrame()) == []` — unchanged (empty list).
- Every `{k for k, _ in build_candidates(...)}` → `{c[0] for c in build_candidates(...)}`.
- `dict(build_candidates(pd.DataFrame(rows)))` (lines 89, 100) — this mapped key→text; now each value is a `(format, segments)` pair. Replace with a helper at the top of the file:

```python
def _texts(df):
    """content_key -> first segment text, for the widened tuple shape."""
    return {key: segs[0] for key, _fmt, segs in build_candidates(df)}
```

  then use `texts = _texts(pd.DataFrame(rows))` at lines 89 and 100.
- Line 71-73 (`h2h_keys`): change to
  `h2h_keys = [c[0] for c in candidates if c[0].startswith("h2h:")]`.
- Line 127-128 (tweet length): change to
  `for _key, _fmt, segs in build_candidates(pd.DataFrame(rows)): assert len(segs[0]) <= 280`.
- Lines 137, 152: `{c[0] for c in build_candidates(df)}`.
- `pick_standalone_trivia` return in `test_pick_excludes_recent_keys` (line 143): `assert picked[0] == "h2h:Chennai Super Kings:Mumbai Indians"` — unchanged (`picked[0]` is still the key).

In `bot/tests/test_run.py`, lines 371 and 397: change `{k for k, _ in build_candidates(...)}` → `{c[0] for c in build_candidates(...)}`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_trivia_standalone.py -v`
Expected: FAIL — `build_candidates` still returns 2-tuples, so `c[0]`/`segs[0]` mismatch the assertions (e.g. `KeyError`/`ValueError` on unpack in `_texts`).

- [ ] **Step 3: Widen `build_candidates`**

In `bot/trivia_standalone.py`, replace `build_candidates` (lines 131-132):

```python
def build_candidates(df: pd.DataFrame) -> list[tuple[str, str, list[str]]]:
    """Cricsheet-derived candidates, all single-tweet. Widened to the
    (content_key, format, segments) shape so content_bank threads can share
    the same pool -- every candidate here is format='single', segments=[text].
    """
    singles = _h2h_candidates(df) + _venue_candidates(df) + _record_candidates(df)
    return [(key, "single", [text]) for key, text in singles]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_trivia_standalone.py bot/tests/test_run.py -v`
Expected: PASS. (`pick_standalone_trivia` still works — it selects a tuple by `c[0] not in recent_keys`, which is unaffected by the wider tuple.)

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/trivia_standalone.py bot/tests/test_trivia_standalone.py bot/tests/test_run.py
ruff format bot/trivia_standalone.py bot/tests/test_trivia_standalone.py bot/tests/test_run.py
git add bot/trivia_standalone.py bot/tests/test_trivia_standalone.py bot/tests/test_run.py
git commit -m "refactor(bot): widen trivia candidate tuples to (key, format, segments)"
```

---

### Task 3: `_content_bank_candidates` + merge into `pick_standalone_trivia`

**Files:**
- Modify: `bot/trivia_standalone.py` (add `_content_bank_candidates`, extend `pick_standalone_trivia`)
- Test: `bot/tests/test_trivia_standalone.py`

**Interfaces:**
- Consumes: `content_bank` table (Task 1); `build_candidates` (Task 2).
- Produces:
  - `_content_bank_candidates(conn) -> list[tuple[str, str, list[str]]]` — reads `content_bank`, parses `segments_json`, returns `(content_key, format, segments)`.
  - `pick_standalone_trivia(df, recent_keys, conn=None, rng=None) -> tuple[str, str, list[str]] | None` — merges Cricsheet + content_bank pools, applies the 30-day exclusion, falls back to allowing a repeat when everything is excluded. `conn=None` skips the content_bank pool.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_trivia_standalone.py`:

```python
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
    assert (
        pick_standalone_trivia(pd.DataFrame(), set(), rng=random.Random(0)) is None
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_trivia_standalone.py -k "content_bank or merges or without_conn or excludes_recent_content" -v`
Expected: FAIL — `ImportError: cannot import name '_content_bank_candidates'` and `pick_standalone_trivia() got an unexpected keyword argument 'conn'`.

- [ ] **Step 3: Implement `_content_bank_candidates` and extend `pick_standalone_trivia`**

At the top of `bot/trivia_standalone.py`, add the imports:

```python
import json

import sqlalchemy as sa

from .db import content_bank
```

Add `_content_bank_candidates` above `build_candidates`:

```python
def _content_bank_candidates(conn) -> list[tuple[str, str, list[str]]]:
    """Wikipedia-sourced records + hand-authored anecdotes/stories. Same
    (content_key, format, segments) shape as build_candidates, feeding the
    same 30-day trivia_log dedup."""
    rows = conn.execute(
        sa.select(
            content_bank.c.content_key,
            content_bank.c.format,
            content_bank.c.segments_json,
        )
    ).all()
    return [(r.content_key, r.format, json.loads(r.segments_json)) for r in rows]
```

Replace `pick_standalone_trivia` (currently lines 135-145):

```python
def pick_standalone_trivia(
    df: pd.DataFrame,
    recent_keys: set[str],
    conn=None,
    rng: random.Random | None = None,
) -> tuple[str, str, list[str]] | None:
    rng = rng or random.Random()
    candidates = build_candidates(df)
    if conn is not None:
        candidates = candidates + _content_bank_candidates(conn)
    if not candidates:
        return None
    pool = [c for c in candidates if c[0] not in recent_keys]
    if not pool:
        pool = candidates  # every candidate excluded -- repeat beats silence
    return rng.choice(pool)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_trivia_standalone.py -v`
Expected: PASS (new tests plus all Task 2 tests still green).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/trivia_standalone.py bot/tests/test_trivia_standalone.py
ruff format bot/trivia_standalone.py bot/tests/test_trivia_standalone.py
git add bot/trivia_standalone.py bot/tests/test_trivia_standalone.py
git commit -m "feat(bot): merge content_bank rows into standalone-trivia candidate pool"
```

---

### Task 4: `Poster.send_thread` + tweet-level `month_post_count`

**Files:**
- Modify: `bot/poster.py` (`month_post_count`, add `send_thread`)
- Test: `bot/tests/test_poster.py`

**Interfaces:**
- Consumes: `posts.tweet_count` (Task 1).
- Produces:
  - `month_post_count(conn, now) -> int` — `COALESCE(SUM(tweet_count), 0)` over `state IN ('posted','partial')` in the current month.
  - `Poster.send_thread(segments: list[str]) -> tuple[bool, int]` — posts `segments[0]`, then each remaining segment as a reply to the previous tweet's id. Returns `(all_posted, tweets_sent)`.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_poster.py`:

```python
def test_month_count_sums_tweet_count_including_partial(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="posted",
                tweet_count=1,
                posted_at=datetime(2026, 7, 2, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="posted",
                tweet_count=3,
                posted_at=datetime(2026, 7, 3, tzinfo=timezone.utc),
            )
        )
        conn.execute(
            posts.insert().values(
                post_type="standalone_trivia",
                state="partial",
                tweet_count=2,
                posted_at=datetime(2026, 7, 4, tzinfo=timezone.utc),
            )
        )
        conn.execute(  # failed row does not count
            posts.insert().values(
                post_type="standalone_trivia", state="failed", tweet_count=1
            )
        )
        assert month_post_count(conn, now) == 6  # 1 + 3 + 2


def test_month_count_zero_when_no_rows(engine):
    now = datetime(2026, 7, 19, tzinfo=timezone.utc)
    with engine.begin() as conn:
        assert month_post_count(conn, now) == 0


def test_send_thread_dry_run_returns_all_and_count(capsys):
    p = Poster(_settings(dry=True))
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert (all_ok, sent) == (True, 3)
    out = capsys.readouterr().out
    assert "a" in out and "b" in out and "c" in out


def test_send_thread_chains_reply_ids(monkeypatch):
    calls = []

    class _Resp:
        def __init__(self, tid):
            self.data = {"id": tid}

    class _FakeClient:
        def create_tweet(self, **kwargs):
            calls.append(kwargs)
            return _Resp(len(calls))  # ids 1, 2, 3

    p = Poster(_settings(dry=False))
    monkeypatch.setattr(p, "_x_client", lambda: _FakeClient())
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert (all_ok, sent) == (True, 3)
    assert "in_reply_to_tweet_id" not in calls[0]
    assert calls[1]["in_reply_to_tweet_id"] == 1
    assert calls[2]["in_reply_to_tweet_id"] == 2


def test_send_thread_partial_failure_reports_sent_count(monkeypatch):
    class _Resp:
        def __init__(self, tid):
            self.data = {"id": tid}

    class _FlakyClient:
        def __init__(self):
            self.n = 0

        def create_tweet(self, **kwargs):
            self.n += 1
            if self.n == 2:
                raise RuntimeError("X 500")
            return _Resp(self.n)

    p = Poster(_settings(dry=False))
    monkeypatch.setattr(p, "_x_client", lambda: _FlakyClient())
    all_ok, sent = p.send_thread(["a", "b", "c"])
    assert all_ok is False
    assert sent == 1  # only tweet 1 posted; tweet 2 failed, tweet 3 never attempted
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_poster.py -v`
Expected: FAIL — `month_post_count` returns row counts (test expects 6, gets 3) and `Poster` has no `send_thread`.

- [ ] **Step 3: Update `month_post_count` to sum tweets**

In `bot/poster.py`, replace `month_post_count` (lines 36-42):

```python
def month_post_count(conn, now: datetime) -> int:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return conn.execute(
        sa.select(sa.func.coalesce(sa.func.sum(posts.c.tweet_count), 0))
        .select_from(posts)
        .where(
            posts.c.state.in_(["posted", "partial"]),
            posts.c.posted_at >= start,
        )
    ).scalar_one()
```

- [ ] **Step 4: Add `send_thread`**

Add to the `Poster` class in `bot/poster.py` (after `send`):

```python
    def send_thread(self, segments: list[str]) -> tuple[bool, int]:
        """Post segments as a reply chain. Returns (all_posted, tweets_sent).
        On a mid-thread failure, already-posted tweets are left live (no
        auto-delete); tweets_sent is the count that reached X."""
        if self.settings.dry_run:
            for i, seg in enumerate(segments):
                print(f"DRY RUN THREAD {i + 1}/{len(segments)}:\n{seg}\n")
            summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary_path:
                with open(summary_path, "a") as f:
                    joined = "\n\n".join(segments)
                    f.write(f"### Thread (copy/paste)\n```\n{joined}\n```\n\n")
            return True, len(segments)
        prev_id = None
        sent = 0
        for seg in segments:
            try:
                kwargs = {"text": seg}
                if prev_id is not None:
                    kwargs["in_reply_to_tweet_id"] = prev_id
                resp = self._x_client().create_tweet(**kwargs)
                prev_id = resp.data["id"]
                sent += 1
            except Exception:
                logger.exception("X thread post failed at segment %d", sent + 1)
                summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
                if summary_path:
                    remaining = "\n\n".join(segments[sent:])
                    with open(summary_path, "a") as f:
                        f.write(
                            "### Thread partial — post remaining manually\n"
                            f"```\n{remaining}\n```\n\n"
                        )
                return False, sent
        return True, sent
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_poster.py -v`
Expected: PASS (new tests plus the existing `test_month_count_only_current_month`, which now sums to 1 for its single in-month posted row).

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/poster.py bot/tests/test_poster.py && ruff format bot/poster.py bot/tests/test_poster.py
git add bot/poster.py bot/tests/test_poster.py
git commit -m "feat(bot): tweet-level month_post_count and Poster.send_thread"
```

---

### Task 5: Wire single + thread posting into `run.py`

**Files:**
- Modify: `bot/run.py` (standalone-trivia block, add `_post_standalone`)
- Test: `bot/tests/test_run.py`

**Interfaces:**
- Consumes: `pick_standalone_trivia(df, recent_keys, conn)` (Task 3, returns 3-tuple); `Poster.send`/`send_thread` (Task 4); `month_post_count`/`allowed` (Task 4/existing).
- Produces: `_post_standalone(conn, poster, post_row, fmt, segments, now) -> int` — posts a single or thread, writes `state` (`posted`/`partial`/`failed`), sets `tweet_count`+`posted_at` when any tweet lands, commits, returns `tweets_sent`.

- [ ] **Step 1: Add `send_thread` to the test double and write the failing tests**

In `bot/tests/test_run.py`, extend `SpyPoster` (currently lines 28-34):

```python
class SpyPoster:
    def __init__(self, ok=True, thread_sent=None):
        self.sent, self.ok = [], ok
        self.threads = []
        # thread_sent=None -> full success; an int -> that many segments posted
        self.thread_sent = thread_sent

    def send(self, text):
        self.sent.append(text)
        return self.ok

    def send_thread(self, segments):
        self.threads.append(segments)
        if self.thread_sent is None:
            return True, len(segments)
        return self.thread_sent == len(segments), self.thread_sent
```

Add these tests to `bot/tests/test_run.py`:

```python
def _seed_thread(conn):
    from datetime import datetime, timezone

    from bot.db import content_bank

    conn.execute(
        content_bank.insert().values(
            category="story",
            format="thread",
            segments_json='["Bodyline 1/3", "Bodyline 2/3", "Bodyline 3/3"]',
            content_key="story:bodyline",
            source="wikipedia:Bodyline",
            created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
    )


def test_standalone_thread_posts_all_segments_and_counts_tweets(conn, art):
    _seed_thread(conn)
    # exclude every Cricsheet key so the thread is the only pick
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    for key in {c[0] for c in build_candidates(_load_team_matches(conn))}:
        conn.execute(
            trivia_log.insert().values(
                content_key=key, posted_at=datetime(2026, 7, 18, tzinfo=timezone.utc)
            )
        )
    poster = SpyPoster()
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    assert poster.threads == [["Bodyline 1/3", "Bodyline 2/3", "Bodyline 3/3"]]
    row = conn.execute(
        sa.select(posts.c.state, posts.c.tweet_count, posts.c.text).where(
            posts.c.post_type == "standalone_trivia"
        )
    ).one()
    assert row.state == "posted"
    assert row.tweet_count == 3
    assert row.text == "Bodyline 1/3"  # first segment stored for the summary path
    keys = conn.execute(sa.select(trivia_log.c.content_key).where(
        trivia_log.c.posted_at == now
    )).scalars().all()
    assert keys == ["story:bodyline"]


def test_standalone_thread_partial_failure_records_partial_state(conn, art):
    _seed_thread(conn)
    from bot.db import trivia_log
    from bot.run import _load_team_matches
    from bot.trivia_standalone import build_candidates

    for key in {c[0] for c in build_candidates(_load_team_matches(conn))}:
        conn.execute(
            trivia_log.insert().values(
                content_key=key, posted_at=datetime(2026, 7, 18, tzinfo=timezone.utc)
            )
        )
    poster = SpyPoster(thread_sent=1)  # tweet 1 posts, tweet 2 fails
    now = datetime(2026, 7, 19, 8, 0, tzinfo=timezone.utc)
    tick(conn, FakeProvider([], []), art, poster, now)
    row = conn.execute(
        sa.select(posts.c.state, posts.c.tweet_count, posts.c.posted_at).where(
            posts.c.post_type == "standalone_trivia"
        )
    ).one()
    assert row.state == "partial"
    assert row.tweet_count == 1
    assert row.posted_at is not None  # partial's live tweet must count toward quota
    # partially-public content is logged so it is not reposted
    keys = conn.execute(sa.select(trivia_log.c.content_key)).scalars().all()
    assert keys == ["story:bodyline"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_run.py -k "thread" -v`
Expected: FAIL — `pick_standalone_trivia` is still called without `conn` (content_bank never reaches the pool), so `poster.threads` stays empty / the thread row is never created.

- [ ] **Step 3: Add `_post_standalone` and rewire the standalone block**

In `bot/run.py`, add the helper after `_try_post` (after line 106):

```python
def _post_standalone(conn, poster, post_row, fmt: str, segments: list[str], now) -> int:
    """Post a standalone single or thread. Returns tweets_sent (0 == nothing
    posted). Sets state posted/partial/failed and, when any tweet lands,
    tweet_count + posted_at. No retry/abandon: standalone rows are slot-keyed
    and single-attempt, matching the existing quiet-day design."""
    count = month_post_count(conn, now)
    if not allowed(post_row.post_type, count):
        logger.warning(
            "quota breaker: skipping %s (month count %d)", post_row.post_type, count
        )
        return 0
    if fmt == "thread":
        all_ok, tweets_sent = poster.send_thread(segments)
    else:
        all_ok = poster.send(segments[0])
        tweets_sent = 1 if all_ok else 0
    if tweets_sent == 0:
        state = "failed"
    elif all_ok:
        state = "posted"
    else:
        state = "partial"
    values = {"state": state, "attempts": post_row.attempts + 1, "text": segments[0]}
    if tweets_sent > 0:
        values["posted_at"] = now
        values["tweet_count"] = tweets_sent
    conn.execute(posts.update().where(posts.c.id == post_row.id).values(**values))
    conn.commit()  # irreversible external side effect must survive a later raise
    return tweets_sent
```

Replace the standalone-trivia block at the bottom of `tick` (currently lines 340-371, from `recent_keys = _recent_trivia_keys(...)` through the trailing `conn.commit()`):

```python
            recent_keys = _recent_trivia_keys(conn, now)
            picked = pick_standalone_trivia(df, recent_keys, conn)
            if picked:
                content_key, fmt, segments = picked
                post_id = None
                try:
                    with conn.begin_nested():
                        post_id = conn.execute(
                            posts.insert().values(
                                fixture_id=None,
                                post_type="standalone_trivia",
                                state="scheduled",
                                attempts=0,
                                slot_key=slot_key,
                            )
                        ).inserted_primary_key[0]
                except sa.exc.IntegrityError:
                    logger.info(
                        "standalone trivia slot %s already claimed; skipping", slot_key
                    )
                if post_id is not None:
                    post_row = conn.execute(
                        sa.select(posts).where(posts.c.id == post_id)
                    ).one()
                    tweets_sent = _post_standalone(
                        conn, poster, post_row, fmt, segments, now
                    )
                    if tweets_sent > 0:
                        conn.execute(
                            trivia_log.insert().values(
                                content_key=content_key, posted_at=now
                            )
                        )
                        conn.commit()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_run.py -v`
Expected: PASS — the two new thread tests plus every existing standalone test (they seed no `content_bank`, so `pick_standalone_trivia` returns a `single` and `_post_standalone` drives `poster.send`, preserving `len(poster.sent) == 1` and `state == "posted"`).

- [ ] **Step 5: Full suite + lint + commit**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/ -q`
Expected: PASS (whole bot suite green).

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/run.py bot/tests/test_run.py && ruff format bot/run.py bot/tests/test_run.py
git add bot/run.py bot/tests/test_run.py
git commit -m "feat(bot): post content_bank singles and threads from the standalone tick"
```

---

### Task 6: Seed script — `bot/scripts/seed_content_bank.py`

**Files:**
- Create: `bot/scripts/__init__.py`
- Create: `bot/scripts/seed_content_bank.py`
- Create: `bot/tests/data/wiki_records_sample.html`
- Test: `bot/tests/test_seed_content_bank.py`

**Interfaces:**
- Consumes: `content_bank` table (Task 1); `ensure_schema`/`get_engine` (existing).
- Produces (all in `seed_content_bank.py`):
  - `extract_wiki_records(html: str, fmt: str, source: str) -> list[dict]` — parses the first wikitable via `pd.read_html`, emits `wiki_record` review entries (own-phrasing templated text).
  - `anecdote_skeletons() -> list[dict]` — hardcoded empty-`segments` skeletons for hand-authoring.
  - `write_draft(records_html: dict[str, str], path: Path) -> None` — writes the review JSON file.
  - `commit_reviewed(conn, path: Path, now: datetime) -> int` — inserts rows, skipping existing `content_key`; returns inserted count.
  - `main(argv)` CLI: `--draft <outfile>` / `--commit <reviewed-file>`.

**Review-file JSON schema** (one object per candidate; `segments` is the authored text — empty for skeletons awaiting authoring):

```json
{
  "entries": [
    {
      "category": "wiki_record",
      "format": "single",
      "content_key": "wiki_record:test:most-wickets",
      "source": "wikipedia:List_of_Test_cricket_records",
      "segments": ["🏏 800 — Most Test wickets: Muralitharan. #Cricket"]
    },
    {
      "category": "anecdote",
      "format": "single",
      "content_key": "anecdote:bodyline",
      "source": "wikipedia:Bodyline",
      "segments": []
    }
  ]
}
```

- [ ] **Step 1: Create the captured HTML fixture**

Create `bot/tests/data/wiki_records_sample.html` (a minimal MediaWiki-shaped wikitable — first two columns are label/value; this stands in for the live API response, per the no-live-API constraint):

```html
<table class="wikitable">
<tr><th>Record</th><th>Value</th><th>Player</th></tr>
<tr><td>Most wickets</td><td>800</td><td>M. Muralitharan</td></tr>
<tr><td>Highest score</td><td>400*</td><td>B. Lara</td></tr>
</table>
```

- [ ] **Step 2: Write the failing tests**

Create `bot/tests/test_seed_content_bank.py`:

```python
import json
from datetime import datetime, timezone
from pathlib import Path

import sqlalchemy as sa

from bot.db import content_bank
from bot.scripts.seed_content_bank import (
    commit_reviewed,
    extract_wiki_records,
)

DATA = Path(__file__).parent / "data" / "wiki_records_sample.html"


def test_extract_wiki_records_templates_own_sentence():
    html = DATA.read_text()
    entries = extract_wiki_records(
        html, fmt="test", source="wikipedia:List_of_Test_cricket_records"
    )
    keys = {e["content_key"] for e in entries}
    assert "wiki_record:test:most-wickets" in keys
    murali = next(e for e in entries if e["content_key"] == "wiki_record:test:most-wickets")
    assert murali["category"] == "wiki_record"
    assert murali["format"] == "single"
    assert len(murali["segments"]) == 1
    assert "800" in murali["segments"][0]
    assert len(murali["segments"][0]) <= 280


def test_commit_reviewed_inserts_and_skips_existing(engine, tmp_path):
    review = {
        "entries": [
            {
                "category": "wiki_record",
                "format": "single",
                "content_key": "wiki_record:test:most-wickets",
                "source": "wikipedia:List_of_Test_cricket_records",
                "segments": ["800 Test wickets. #Cricket"],
            },
            {
                "category": "story",
                "format": "thread",
                "content_key": "story:bodyline",
                "source": "wikipedia:Bodyline",
                "segments": ["Bodyline 1", "Bodyline 2"],
            },
        ]
    }
    f = tmp_path / "reviewed.json"
    f.write_text(json.dumps(review))
    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    with engine.begin() as conn:
        n1 = commit_reviewed(conn, f, now)
        n2 = commit_reviewed(conn, f, now)  # re-run is additive, not destructive
        rows = conn.execute(sa.select(content_bank.c.content_key)).scalars().all()
    assert n1 == 2
    assert n2 == 0  # both content_keys already exist
    assert sorted(rows) == ["story:bodyline", "wiki_record:test:most-wickets"]


def test_commit_skips_unauthored_skeletons(engine, tmp_path):
    review = {
        "entries": [
            {
                "category": "anecdote",
                "format": "single",
                "content_key": "anecdote:bodyline",
                "source": "wikipedia:Bodyline",
                "segments": [],  # not yet authored
            }
        ]
    }
    f = tmp_path / "reviewed.json"
    f.write_text(json.dumps(review))
    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    with engine.begin() as conn:
        n = commit_reviewed(conn, f, now)
        count = conn.execute(
            sa.select(sa.func.count()).select_from(content_bank)
        ).scalar_one()
    assert n == 0  # empty-segments skeletons are never inserted
    assert count == 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_seed_content_bank.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'bot.scripts'`.

- [ ] **Step 4: Create the package + script**

Create `bot/scripts/__init__.py` (empty file).

Create `bot/scripts/seed_content_bank.py`:

```python
"""Two-phase local seed for content_bank. NOT wired into any GitHub Actions
workflow -- records/anecdotes change rarely, so this is a manual one-off.

Phase 1  python -m bot.scripts.seed_content_bank --draft draft.json
  Fetches Wikipedia records tables (MediaWiki API), writes wiki_record
  candidates plus empty-segment anecdote/story skeletons to a review file.
  Anecdote/story text is then hand-authored INTO that file (facts-only, own
  phrasing) and the owner reviews every wiki_record sentence.

Phase 2  python -m bot.scripts.seed_content_bank --commit draft.json
  Inserts the reviewed entries, skipping any content_key already present and
  any entry whose segments are still empty (unauthored skeleton).
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
import sqlalchemy as sa

from bot.db import content_bank, ensure_schema, get_engine

WIKI_API = "https://en.wikipedia.org/w/api.php"
RECORD_PAGES = {  # fmt tag -> Wikipedia page title
    "test": "List_of_Test_cricket_records",
    "odi": "List_of_One_Day_International_cricket_records",
    "t20i": "List_of_Twenty20_International_cricket_records",
}
# Anecdote/story source pages seeded as empty skeletons for hand-authoring.
ANECDOTE_PAGES = ["Bodyline", "Jim_Laker", "Kolkata_Test_2001"]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fetch_page_html(title: str) -> str:
    resp = requests.get(
        WIKI_API,
        params={"action": "parse", "page": title, "prop": "text", "format": "json"},
        headers={"User-Agent": "the-cricket-fan-bot/1.0 (seed)"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["parse"]["text"]["*"]


def extract_wiki_records(html: str, fmt: str, source: str) -> list[dict]:
    """First wikitable -> one wiki_record per row. Columns 0/1 are label/value;
    the bot writes its own sentence (facts-only, no verbatim prose)."""
    tables = pd.read_html(html)
    if not tables:
        return []
    table = tables[0]
    entries = []
    for _, row in table.iterrows():
        cells = [str(c).strip() for c in row.tolist()]
        if len(cells) < 2:
            continue
        label, value = cells[0], cells[1]
        text = f"🏏 {value} — {label} ({fmt.upper()}). #Cricket"
        if len(text) > 280:
            continue
        entries.append(
            {
                "category": "wiki_record",
                "format": "single",
                "content_key": f"wiki_record:{fmt}:{_slug(label)}",
                "source": source,
                "segments": [text],
            }
        )
    return entries


def anecdote_skeletons() -> list[dict]:
    return [
        {
            "category": "anecdote",
            "format": "single",
            "content_key": f"anecdote:{_slug(page)}",
            "source": f"wikipedia:{page}",
            "segments": [],  # hand-author before --commit
        }
        for page in ANECDOTE_PAGES
    ]


def write_draft(records_html: dict[str, str], path: Path) -> None:
    entries: list[dict] = []
    for fmt, html in records_html.items():
        entries.extend(
            extract_wiki_records(html, fmt, f"wikipedia:{RECORD_PAGES[fmt]}")
        )
    entries.extend(anecdote_skeletons())
    path.write_text(json.dumps({"entries": entries}, indent=2))


def commit_reviewed(conn, path: Path, now: datetime) -> int:
    review = json.loads(Path(path).read_text())
    existing = set(
        conn.execute(sa.select(content_bank.c.content_key)).scalars().all()
    )
    inserted = 0
    for e in review["entries"]:
        if not e["segments"]:  # unauthored skeleton
            continue
        if e["content_key"] in existing:
            continue
        conn.execute(
            content_bank.insert().values(
                category=e["category"],
                format=e["format"],
                segments_json=json.dumps(e["segments"]),
                content_key=e["content_key"],
                source=e["source"],
                created_at=now,
            )
        )
        existing.add(e["content_key"])
        inserted += 1
    return inserted


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--draft", metavar="OUTFILE")
    group.add_argument("--commit", metavar="REVIEWED_FILE")
    parser.add_argument(
        "--database-url", default=None, help="only needed for --commit"
    )
    args = parser.parse_args(argv)

    if args.draft:
        records_html = {fmt: fetch_page_html(title) for fmt, title in RECORD_PAGES.items()}
        write_draft(records_html, Path(args.draft))
        print(f"Wrote draft to {args.draft} -- author anecdote/story text, then --commit")
        return

    import os

    url = args.database_url or os.environ["BOT_DATABASE_URL"]
    engine = get_engine(url)
    now = datetime.now(timezone.utc)
    with engine.connect() as conn:
        ensure_schema(conn)
        conn.commit()
        n = commit_reviewed(conn, Path(args.commit), now)
        conn.commit()
    print(f"Inserted {n} content_bank rows from {args.commit}")


if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/tests/test_seed_content_bank.py -v`
Expected: PASS. (`pd.read_html` needs `lxml`/`html5lib` — if the test errors with `ImportError: lxml not found`, add `lxml` to `bot/requirements.txt` and `pip install lxml`, then re-run.)

- [ ] **Step 6: Full suite + lint + commit**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && pytest bot/ -q`
Expected: PASS (entire bot suite).

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
ruff check bot/scripts/ bot/tests/test_seed_content_bank.py
ruff format bot/scripts/ bot/tests/test_seed_content_bank.py
git add bot/scripts/ bot/tests/test_seed_content_bank.py bot/tests/data/wiki_records_sample.html
git commit -m "feat(bot): add two-phase content_bank seed script"
```

---

## Self-Review (completed against the spec)

**Spec coverage:**
- Content categories `wiki_record`/`anecdote`/`story` — Task 6 (`extract_wiki_records`, `anecdote_skeletons`) + schema Task 1. ✓
- `content_bank` schema exactly as specced — Task 1. ✓
- Dedup reuses `trivia_log` as-is — Task 3 (keys flow through `_recent_trivia_keys`, no `trivia_log` change) + Task 5 logging. ✓
- `pick_standalone_trivia` takes `conn`, merges `_content_bank_candidates`, tuples widen to `(key, format, segments)` — Tasks 2 + 3. ✓
- `send_thread(segments) -> (all_posted, tweets_sent)`, reply chain, partial leaves tweet 1 live — Task 4. ✓
- Partial failure → `state="partial"`, `tweets_sent` recorded, no auto-delete/retry — Task 5. ✓
- `posts.tweet_count` column; `month_post_count` `COUNT`→`SUM` feeding the 450/490 cutoffs at tweet level — Tasks 1 + 4 (+ `test_circuit_breaker` untouched, still row-agnostic on the count int). ✓
- `state` gains `"partial"` (doc-only) — Task 1. ✓
- `text` holds first/only segment — Task 5 (`values["text"] = segments[0]`). ✓
- Two-phase `--draft`/`--commit` seed, local-only, additive re-runs — Task 6. ✓
- `content_bank` via `create_all` in `ensure_schema`, no dialect migration — Task 1 (only the *existing* `posts` table needs the guarded `tweet_count` ALTER). ✓
- All four spec test bullets — Task 3 (`_content_bank_candidates` + dedup), Task 4/5 (`send_thread` success + partial), Task 4 (`month_post_count` mixed sum + cutoffs), Task 1 (schema via `ensure_schema` on SQLite). ✓

**Beyond-spec inferences flagged in-plan:** `month_post_count` includes `partial`; partials set `posted_at`; `tweet_count` needs `server_default`; content-key namespacing; log-on-`tweets_sent>0`. All are in "Design decisions locked" with rationale.

**Placeholder scan:** none — every code step carries full code; anecdote/story prose is deliberately an empty-`segments` skeleton (spec-mandated hand-authoring), not a plan placeholder.

**Type consistency:** `(content_key, format, segments)` 3-tuple is consistent across `build_candidates`, `_content_bank_candidates`, `pick_standalone_trivia`, and the `run.py` unpack. `send_thread -> (bool, int)`; `_post_standalone -> int`; `month_post_count -> int`; `commit_reviewed -> int`. Consistent.
