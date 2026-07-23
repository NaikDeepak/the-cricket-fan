# Content Bank — Stories, Anecdotes, Historical Records — Design

## Problem

Standalone trivia (`bot/trivia_standalone.py`) only draws from `team_matches`
— data ingested from Cricsheet, scoped to matches the bot itself has parsed
(recent seasons, team-level aggregates only). That means every standalone
post is a same-shape stat line ("X lead Y-Z head-to-head", "venue V: home
teams win N%"). There's no path to the facts that actually make cricket
trivia fun: all-time records (Bradman's 99.94, Lara's 400*, Murali's 800
wickets), or narrative anecdotes/stories (Bodyline, Laker's 19/90, famous
comebacks). None of that exists in `team_matches`, and Cricsheet itself only
goes back to the mid-2000s — it structurally cannot supply pre-2005 history.

Goal: a second, independent content source — a `content_bank` table seeded
once from Wikipedia + hand-authored narrative text — that widens the
standalone-trivia rotation with historical records, anecdotes, and short
multi-tweet stories, without touching the existing Cricsheet-derived path.

## Sourcing (settled during brainstorming)

- **cricinfo.com/records is not usable.** Confirmed blocked at the Akamai
  edge for programmatic access: direct `curl`, `curl` with a browser
  User-Agent, the `WebFetch` tool, and the `stats.espncricinfo.com` redirect
  target all returned 403/Access Denied. A GitHub Actions runner IP would be
  blocked at least as hard. Not revisited.
- **funtrivia.com is out of scope on legal grounds**, not technical ones —
  its quiz Q&A is curated, copyrighted content (not raw facts), and
  reposting it verbatim on a public account is a real exposure. Skipped
  entirely per the facts-only decision below.
- **Wikipedia is the source**, confirmed reachable (MediaWiki API,
  `en.wikipedia.org/w/api.php`, verified 200): `List of Test cricket
  records`, `List of ODI cricket records`, `List of T20I cricket records`
  (plus batting/bowling/partnership sub-pages) for structured records, and
  prose articles on famous incidents/players for anecdote/story material.
- **Facts-only, own phrasing.** Raw records (name, number, format, date)
  aren't copyrightable expression — the bot writes its own sentence around
  them, same convention `trivia_standalone.py` already follows for
  Cricsheet-derived facts. No verbatim copying of Wikipedia prose beyond
  what's needed to identify the underlying fact.
- **No new runtime LLM path.** The bot has zero LLM dependency today (no
  `GEMINI_API_KEY` in `bot/config.py` — that's the web-app's story service,
  a separate unused-in-bot path). Anecdote/story text is hand-authored once
  during the seed build, reviewed by the project owner, and stored as plain
  text — not generated per-tick.

## Content categories

| Category | Source | Format | Authoring |
|---|---|---|---|
| `wiki_record` | Wikipedia records lists, all formats (Test/ODI/T20I) | single tweet | templated from structured data (name/number/format/date), same pattern as existing record candidates in `trivia_standalone.py` |
| `anecdote` | Wikipedia prose (incidents, player pages) | single tweet or thread | hand-authored once during seed build, reviewed before insert |
| `story` | Wikipedia prose (historic series, comebacks, controversies) | thread (2-4 tweets) | hand-authored once during seed build, reviewed before insert |

Existing Cricsheet-derived candidates (H2H, venue, this-season records) are
unchanged and continue to live in `trivia_standalone.py` / `team_matches`.
`content_bank` is additive, not a replacement.

## Schema

New table, `bot/db.py`:

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
    # e.g. "wikipedia:List_of_Test_cricket_records",
    # "wikipedia:Bodyline" -- traceability, not shown in the post
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
```

Created via `metadata.create_all` in the existing `ensure_schema(conn)` —
new table, no dialect-specific migration needed (unlike the earlier
`posts.slot_key` retrofit onto an already-live table).

## Dedup — reuses `trivia_log` as-is

`trivia_log.content_key` is already source-agnostic (just a string + a
timestamp). `content_bank.content_key` values feed into the same 30-day
lookback (`_recent_trivia_keys`) alongside Cricsheet-derived keys — no
schema change to `trivia_log`, just more candidates flowing through the
same dedup check.

## Picking

`pick_standalone_trivia` (currently `df`-only) takes an additional `conn`
argument and merges a new `_content_bank_candidates(conn)` pool into
`build_candidates()`'s output. Candidate tuples widen from `(content_key,
text)` to `(content_key, format, segments)` throughout
`trivia_standalone.py` — `format="single"` for every existing Cricsheet
candidate, so today's candidates need only a mechanical wrapper, not a
rewrite.

## Posting threads

`poster.Poster` gets `send_thread(segments: list[str]) -> tuple[bool, int]`
— posts `segments[0]`, then each subsequent segment as a reply
(`in_reply_to_tweet_id`) to the previous tweet's id. Returns `(all_posted,
tweets_sent)`.

- **Partial failure** (tweet 1 posts, tweet 2 fails): the already-public
  tweet 1 is left in place — no auto-delete of live content. The `posts` row
  is marked `state="partial"` (new state value, alongside the existing
  `scheduled`/`posted`/`failed`/`abandoned`) with `tweets_sent` recorded, for
  manual follow-up. Not retried automatically — same no-retry convention the
  existing standalone-trivia design already uses for single-tweet failures.
- **Quota/cost accounting**: `month_post_count()` currently does
  `COUNT(*)` over posted rows, implicitly assuming one row = one tweet. A
  posted thread is 2-4 actual tweets (each billed separately on X,
  $0.015/tweet per the README's cost model), so undercounting here would
  blow past the intended monthly spend cap. `posts` gets a new
  `tweet_count` column (`Integer, nullable=False, default=1`); threads set
  it to `tweets_sent` on completion; `month_post_count()` changes from
  `COUNT(*)` to `SUM(tweet_count)`.
- All `content_bank`-sourced posts use the existing `standalone_trivia`
  `post_type` — inherits the current quota-breaker priority (dropped first
  at the 450-post cutoff) with no changes to `poster.allowed()`.

## `posts` table changes

- `tweet_count` (above).
- `state` gains `"partial"` as a valid value (documentation-only change —
  `state` is a plain `String(16)`, no enum/check constraint to update).
- `text` continues to hold the first/only segment (keeps the existing
  "recoverable on real-post failure" GitHub summary output working
  unchanged for single-format posts, and gives a partial thread's summary
  something meaningful to show for its first tweet).

## Seed build process

New `bot/scripts/seed_content_bank.py`, run locally — **not** wired into any
GitHub Actions workflow (matches the "one-off seed, manual re-run later"
decision from brainstorming; records/anecdotes don't change often, and a
recurring scrape adds failure surface for no real benefit).

Two-phase, so hand-authored text gets reviewed before it reaches the live
DB:

1. `--draft`: fetches Wikipedia records tables via the MediaWiki API,
   writes structured `wiki_record` candidates plus placeholder entries for
   candidate anecdote/story source pages to a local review file (not
   committed, not inserted). Anecdote/story text is then hand-written into
   that file as a separate authoring pass.
2. `--commit <reviewed-file>`: reads the reviewed file, inserts rows into
   `content_bank`, skipping any `content_key` that already exists (re-runs
   are additive, not destructive).

## Testing

- `_content_bank_candidates`: returns expected tuples from seeded rows;
  respects the 30-day dedup exclusion set same as Cricsheet candidates.
- `send_thread`: full success (all segments posted, correct
  `in_reply_to_tweet_id` chain); partial failure (segment 2 fails — tweet 1
  stays posted, function reports correct `tweets_sent`, `posts` row lands in
  `"partial"`).
- `month_post_count`: a mix of `tweet_count=1` and `tweet_count=3` posted
  rows sums correctly, and correctly feeds the existing quota-breaker
  cutoffs (450/490) at the tweet level, not the row level.
- Schema: `content_bank` created fresh via `ensure_schema` on the test
  suite's SQLite engine, no dialect-specific path needed.

## Out of scope

- Automated/recurring Wikipedia re-scrape (manual `--draft`/`--commit`
  re-run only).
- Auto-repair or auto-delete on a partial thread failure.
- Player-level stats table (anecdotes/stories are hand-authored text, not
  computed from a stats table — no schema needed for that).
- A UI/review tool for the draft file — plain text/JSON file, reviewed by
  reading it.
