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

1. Skip if any `fixtures` row with `status = 'upcoming'` starts within the
   next 24h (real match content always takes priority; standalone trivia
   only fills genuinely quiet stretches).
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

Each candidate carries a `content_key` (e.g. `h2h:MI:CSK`,
`record:best_chase:2026`) identifying the underlying fact. One candidate is
picked at random from whichever pool isn't excluded by the dedup check.

If `team_matches` is empty or too small to produce any candidate (mirrors
the existing fallback in `compose.trivia_post`), skip posting for that tick
rather than posting a generic filler line — a quiet day with no data is
better than a repeated non-fact.

## Dedup

New table `trivia_log`:

| column | type |
|---|---|
| `id` | PK |
| `content_key` | text |
| `posted_at` | timestamptz |

Candidate generation excludes any `content_key` logged within the last 30
days. If every candidate in both pools is excluded (small data set, long
quiet stretch), fall back to allowing a repeat rather than skipping — a
repeated fact beats silence.

## Idempotency + schema

Standalone trivia reuses the existing `posts` table so monthly quota
counting (`month_post_count`, pay-per-use cost control) stays a single
source of truth across all post types:

- `posts.fixture_id` becomes nullable (standalone posts have no fixture).
- New nullable `posts.slot_key` (text, e.g. `2026-07-22-08`), with a partial
  unique index (`WHERE slot_key IS NOT NULL`) — guarantees at most one post
  per calendar slot even if a tick is retried or rerun manually.
- New `post_type` value `"standalone_trivia"`. `poster.allowed()` treats it
  identically to `"trivia"` in the quota breaker (dropped first at the
  450-post cutoff, before predictions/results).

Schema changes apply via a new idempotent `ensure_schema(conn)` in `db.py`
(new tables via `metadata.create_all`, plus `ALTER TABLE posts ALTER COLUMN
fixture_id DROP NOT NULL` — a no-op if already nullable). Called from both
`ingest.py` (already runs schema setup) and the top of `run.main()`, so
`bot-run` self-heals the schema on its next tick instead of depending on a
manual `bot-retrain` run first.

## Posting path

In `tick()`, after the existing prediction/trivia/results blocks: on a
trigger hour with no upcoming fixture and no existing `slot_key` row,
generate `(text, content_key)`, insert a `posts` row (`fixture_id=NULL`,
`post_type="standalone_trivia"`, `slot_key=...`, `state="scheduled"`), call
the existing `_try_post()` unchanged, and on success insert `content_key`
into `trivia_log`.

## Out of scope

- Player-level trivia (no player stats table exists in this DB).
- Configurable trigger hours / per-day count (fixed 3 slots is enough for
  now; revisit if usage shows otherwise).
- Retrying a failed standalone post on a later tick (unlike prediction/
  trivia/result, there's no `_due()`-style rescan for standalone since it
  has no fixture to join against — a failed attempt is simply abandoned;
  the next trigger hour tries a fresh fact).
