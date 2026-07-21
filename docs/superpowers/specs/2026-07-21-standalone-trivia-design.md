# Standalone Trivia — Design

## Problem

`bot/run.py` only posts `prediction` / `trivia` / `result`, and all three are
scheduled from a real fixture (`_upsert_fixtures` inserts `prediction` and
`trivia` post rows per fixture; `result` is inserted when a match completes).
On days with zero T20 fixtures across the tracked leagues, the account posts
nothing. Goal: post 2-3 cricket-trivia tweets on quiet days, using only the
team-level data already in `team_matches` (no player-level table exists).

## Trigger

Three fixed UTC hours, `STANDALONE_TRIVIA_HOURS = {8, 14, 20}` (a subset of
the 12 daily cron ticks at `0 */2 * * *`). At a tick whose UTC hour is in
that set:

1. Skip if any `fixtures` row with `status = 'upcoming'` has
   `now <= start_time <= now + 24h` (real match content always takes
   priority; standalone trivia only fills genuinely quiet stretches). Both
   bounds matter: a stale `upcoming` fixture whose provider stopped
   returning it (and so never got a result to flip it to `completed`/`void`)
   must not permanently block standalone trivia via an unbounded "starts
   within 24h" check.
2. Skip if a `posts` row already exists for this slot (see Idempotency).
3. Otherwise generate and post one standalone trivia.

## Content — mixed rotation

New `bot/trivia_standalone.py` builds a pool of candidate facts from
`team_matches`, two styles:

- **Random H2H / venue** — same shape as the existing `compose.trivia_post`
  (head-to-head record between two teams, or a venue's home-win rate), but
  the pair/venue is chosen at random from historical data rather than from
  today's fixture.
- **Records / extremes** — biggest win margin, best run-chase, highest team
  total, best powerplay/death-overs economy, computed over the most recent
  season present in `team_matches` (`season` column, e.g. `"2026"`).

Each candidate carries a `content_key` identifying the underlying fact. For
H2H facts the two team names are sorted alphabetically into the key (e.g.
`h2h:CSK:MI`, not `h2h:MI:CSK`) so the same pairing dedupes regardless of
which team the raw data happens to list first — otherwise "MI vs CSK" and
"CSK vs MI" would count as two different facts within the 30-day window.
Record-style keys look like `record:best_chase:2026`. One candidate is
picked at random from whichever pool isn't excluded by the dedup check.

Data-quality rules for the records/extremes pool, following existing
conventions elsewhere in this codebase (`features.py` already excludes
DLS-affected matches before computing rate stats; `compose.trivia_post`
already gates facts on a minimum sample size — `len(h2h) >= 3`,
`len(home_rows) >= 5`):

- Exclude `dls == True` matches — a DLS-shortened chase or total is not
  comparable to a full-length match and would skew "highest total" /
  "best chase" facts.
- Require a minimum sample before selecting a rate-based record (e.g. best
  powerplay/death economy needs a minimum overs-faced/bowled volume, not
  just whichever team happened to bowl one death over well).
- Drop rows with nulls in the relevant phase columns
  (`pp_runs_scored`/`pp_overs_faced`/`death_runs_conceded`/
  `death_overs_bowled` are nullable) before aggregating.

If `team_matches` is empty or too small to produce any candidate (mirrors
the existing fallback in `compose.trivia_post`), skip posting for that tick
rather than posting a generic filler line — a quiet day with no data is
better than a repeated non-fact.

## Dedup

New table `trivia_log`:

| column | type |
|---|---|
| `id` | PK |
| `content_key` | text, indexed |
| `posted_at` | timestamptz, indexed |

Candidate generation excludes any `content_key` logged within the last 30
days. If every candidate in both pools is excluded (small data set, long
quiet stretch), fall back to allowing a repeat rather than skipping — a
repeated fact beats silence.

## Idempotency + schema

Standalone trivia reuses the existing `posts` table so monthly quota
counting (`month_post_count`, pay-per-use cost control) stays a single
source of truth across all post types:

- `posts.fixture_id` becomes nullable (standalone posts have no fixture).
- New nullable `posts.slot_key` (`String(32)`, e.g. `2026-07-22-08`),
  declared `unique=True` at the model level in `db.py` — a plain SQL UNIQUE
  constraint already permits multiple NULLs on both SQLite and Postgres, so
  no partial index is needed, and fresh installs (tests) get the column and
  constraint for free via `metadata.create_all`. Guarantees at most one post
  per calendar slot even if a tick is retried or rerun manually.
- New `post_type` value `"standalone_trivia"`. `poster.allowed()` treats it
  identically to `"trivia"` in the quota breaker (dropped first at the
  450-post cutoff, before predictions/results).

`metadata.create_all` only creates missing tables — it will not alter the
already-existing Neon `posts` table to add `slot_key` or drop the
`fixture_id` NOT NULL. Schema changes apply via a new idempotent
`ensure_schema(conn)` in `db.py`:

- New tables (`trivia_log`) via `metadata.create_all` — works on any
  dialect, including the SQLite engine the test suite uses.
- For the existing `posts` table, Postgres-specific migration DDL, guarded
  by `if conn.dialect.name == "postgresql"` so it never runs against the
  test suite's `sqlite:///:memory:` engine (SQLite has no
  `ALTER COLUMN ... DROP NOT NULL`):
  ```sql
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_key VARCHAR(32);
  ALTER TABLE posts ALTER COLUMN fixture_id DROP NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_slot_key ON posts(slot_key);
  ```

`ensure_schema(conn)` is called from both `ingest.py` (already runs schema
setup) and the top of `run.main()`, so `bot-run` self-heals the schema on
its next tick instead of depending on a manual `bot-retrain` run first.

## Posting path

In `tick()`, after the existing prediction/trivia/results blocks: on a
trigger hour with no upcoming fixture and no existing `slot_key` row,
generate `(text, content_key)`, insert a `posts` row (`fixture_id=NULL`,
`post_type="standalone_trivia"`, `slot_key=...`, `state="scheduled"`), call
`_try_post()`, and insert `content_key` into `trivia_log` only if the post
actually reached `state="posted"` — not on `failed`/`abandoned`, so a
send failure doesn't wrongly suppress that fact for 30 days.

`_try_post()` currently returns `None` and doesn't report success to its
caller (the existing prediction/trivia call sites don't need it to). Making
this call site able to tell needs either re-reading the row's `state` after
the call, or changing `_try_post()` to return the outcome — left as an
implementation decision for the plan, not settled here.

## Out of scope

- Player-level trivia (no player stats table exists in this DB).
- Configurable trigger hours / per-day count (fixed 3 slots is enough for
  now; revisit if usage shows otherwise).
- Retrying a failed standalone post on a later tick (unlike prediction/
  trivia/result, there's no `_due()`-style rescan for standalone since it
  has no fixture to join against — a failed attempt is simply abandoned;
  the next trigger hour tries a fresh fact).
