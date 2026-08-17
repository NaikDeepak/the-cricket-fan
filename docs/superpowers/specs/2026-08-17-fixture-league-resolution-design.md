# Fixture league resolution (series_id → canonical label)

Follow-up to `docs/superpowers/specs/2026-08-16-prediction-model-quality-design.md`
section 1 ("Per-league gate + Elo-fallback routing"), whose "Known
limitation" note (corrected 2026-08-17) documents the defect this spec
fixes.

## Problem

`fixtures.league` is populated by `bot/fixtures_provider.py::_resolve_league`,
which reads `m.get("series")`. A live probe against CricAPI's
`currentMatches` endpoint (2026-08-17, 18 matches sampled) confirmed
`series` is **absent from every match** — only `series_id` (a UUID) is
present. `_resolve_league` therefore always falls through to `m["name"]`,
the full match-description string (e.g. `"Jamaica Kingsmen vs Trinbago
Knight Riders, 8th Match, Caribbean Premier League 2026"`), for every
league except The Hundred (special-cased on a substring match against
that same description).

Consequence, confirmed by tracing consumers:
- `league_elo_override` routing (`composer/routers/predictions.py::run_model`)
  never matches — it compares against canonical short labels (`"IPL"`)
  from the Cricsheet ingest league map, never a match-description string.
- The public `/predictions` page's league filter dropdown and composer's
  league filter chips are driven by the same broken value — already
  broken today, independent of this branch.
- `predictions.league` inherits the same value at insert time
  (`league=f.league` in both `bot/run.py` and `composer/routers/predictions.py`).

CricAPI's `series_info` endpoint resolves `series_id` to a real
tournament name (verified live: `"Women's T20I Quadrangular Series in
Namibia 2026"`) — but that name still isn't one of
`bot/scripts/ingest_all_leagues.py`'s ~28 canonical short labels, so a
fix needs resolution *and* normalization, at a real API cost: the free
tier is 100 credits/day, and `series_info` costs 1 credit per call.

## Goals

- `fixtures.league` (and everything downstream: `predictions.league`,
  `league_elo_override` routing, UI filters) gets a real canonical
  league label whenever CricAPI's data supports resolving one.
- Spend at most 1 API credit per **tournament**, not per fixture — a
  74-match IPL season costs 1 credit total, not 74, across the life of
  that `series_id`.
- Never block or fail fixture ingestion because of a resolution miss —
  today's fallback behavior (raw description string) stays the safety
  net for anything unmapped or unresolvable.

## Non-goals

- Routing the 3 other `predict()` call sites (`bot/run.py::tick`,
  `composer/routers/generate.py`, `composer/routers/live_predict.py`)
  through `league_elo_override` — separate, smaller follow-up plan once
  this lands and `fixtures.league` is trustworthy.
- Retroactively fixing `fixtures.league`/`predictions.league` on rows
  already ingested before this change — no backfill; the cache and the
  clean labels apply going forward, from the next fixture-fetch run.
- Budget-tracking/throttling logic beyond a per-call try/except fallback
  — a bad day spending most of the 100-credit budget on genuinely new
  series is an accepted risk, not solved here.
- Any change to `bot/gating.py`, `bot/elo.py`, or the per-league gate
  logic itself — this spec only fixes the label feeding into it.

## Design

### Data model

New table in `bot/db.py`, separate from the existing `aliases` table
(that one is a hand-seeded name-variant table for team/venue
resolution — a different concern from an automatically-populated,
UUID-keyed API-response cache):

```python
resolved_leagues = sa.Table(
    "resolved_leagues",
    metadata,
    sa.Column("series_id", sa.String(64), primary_key=True),
    sa.Column("series_name", sa.String(256), nullable=False),
    # raw name from series_info, kept for debugging/auditing keyword misses
    sa.Column("canonical_league", sa.String(32), nullable=True),
    # NULL = series_info succeeded but no keyword matched (cached as a
    # confirmed miss, so it isn't re-fetched every ingestion run)
    sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=False),
)
```

No `ensure_schema` migration DDL needed — `metadata.create_all(conn)`
(already the first line of `ensure_schema`, see `bot/db.py:210`) creates
any new table on any dialect automatically. Existing DBs get the table
the next time `ensure_schema` runs; no backfill of historical rows.

### Keyword table

A hand-curated, module-level constant — same substring-match style as
`_resolve_league`'s existing `"hundred"` check, not a fuzzy/algorithmic
match (rejected: silent mismatches between similarly-named domestic
competitions are a worse failure mode than an unmapped fallback). The
Hundred is excluded from this table entirely — it's already handled by
`_resolve_league`'s dedicated substring check before this table is ever
consulted (see Resolution flow), and that check runs against `m["name"]`
directly, not the `series_info`-resolved name, so it needs no change
here.

Structured as an explicitly-ordered `list[tuple[str, str]]`, not a
`dict` — a dict literal's insertion order is technically what Python
iterates, but it reads as unordered intent to a future editor, and
ordering is load-bearing here: a women's competition's keyword must be
checked *before* its men's counterpart, or `"women's t20 blast"` matches
the bare `"t20 blast"` keyword first and returns the wrong label.

```python
# bot/league_keywords.py
LEAGUE_KEYWORDS: list[tuple[str, str]] = [
    ("indian premier league", "IPL"),
    ("big bash league", "BBL"),
    ("pakistan super league", "PSL"),
    ("caribbean premier league", "CPL"),
    ("sa20", "SA20"),
    ("major league cricket", "MLC"),
    ("international league t20", "ILT20"),
    ("lanka premier league", "LPL"),
    ("bangladesh premier league", "BPL"),
    ("mzansi super league", "MSL"),
    ("nepal premier league", "NPL"),
    ("csa t20", "CSA T20"),
    ("syed mushtaq ali", "SMAT"),
    ("women's premier league", "WPL"),
    ("women's big bash", "WBBL"),
    ("women's caribbean premier league", "WCPL"),
    ("charlotte edwards cup", "Charlotte Edwards Cup"),
    ("women's t20 blast", "Women's T20 Blast"),   # before the bare "t20 blast" entry below
    ("t20 blast", "T20 Blast"),
    ("super smash women", "Super Smash Women"),    # before the bare "super smash" entry below
    ("super smash", "Super Smash"),
    ("fairbreak", "FairBreak"),
]
```

Covers 22 of the 28 canonical labels in
`bot/scripts/ingest_all_leagues.py`'s `LEAGUES` list. Deliberately
excluded, not oversights:

- **`The Hundred` / `The Hundred Women`** (2) — already handled by
  `_resolve_league`'s existing dedicated substring check, which runs
  against `m["name"]` before this table is ever consulted (see
  Resolution flow) and needs no change.
- **`T20I` / `WT20I`** (2) — bare internationals have no single stable
  series name; CricAPI's naming for a bilateral tour ("India tour of
  Australia", etc.) varies too much for one keyword to reliably catch,
  and `_resolve_league`'s existing fallback (raw description) already
  carries enough signal for a human reading the UI even without a clean
  `"T20I"` label. Left as a known gap.
- **`WSL` / `Women's T20 Challenge`** (2) — I don't have confident
  knowledge of these two competitions' exact real-world names as
  CricAPI would report them (unlike the other 22, where I'm confident),
  and this spec's own principle is a wrong keyword is worse than an
  honest gap. Flagged for you to supply or confirm during
  implementation, not guessed at here.

Only one entry in the whole table is confirmed against a real live
sample so far — none of the 22, since the one live sample seen
(`"Women's T20I Quadrangular Series in Namibia 2026"`) correctly matches
nothing, exercising the fallback path rather than a match. **The 22
tournament-name strings are drafted from general knowledge, not live
CricAPI samples, and need your review before merge** — a wrong keyword
risks a silent mismatch (worse than today's safe fallback), so this
table is the one part of this plan that should get eyeballed line by
line, not rubber-stamped via the normal task-review loop alone.

### Resolution flow

`_resolve_league(m: dict) -> str` becomes
`_resolve_league(conn, client, api_key, base_url, m: dict) -> str`. Its
only call site is `CricApiProvider.fetch`, which already holds `conn`,
`self.client`, `self.api_key`, `self.base_url` — no new parameters
threaded through anything else.

1. `series_id = m.get("series_id")`. Missing → return today's fallback
   unchanged (`m.get("series") or m.get("name") or ""`, then the
   existing `"hundred"` substring check). This preserves current
   behavior for any response shape without a `series_id` at all.
2. Look up `series_id` in `resolved_leagues`.
   - Hit with `canonical_league` set → return it.
   - Hit with `canonical_league` NULL (a previously-confirmed miss) →
     return today's fallback. No new API call.
   - Miss → proceed to step 3.
3. Call `GET {base_url}/series_info?apikey={api_key}&id={series_id}`
   (mirrors `fetch`'s existing `currentMatches` call style — same
   `httpx.Client`, same timeout, same `raise_for_status` pattern with a
   try/except wrapper here since a resolution failure must never break
   ingestion).
   - Success: keyword-match `data.info.name` against the ordered
     `LEAGUE_KEYWORDS` list (case-insensitive substring, first match
     wins, respecting the women's-before-men's ordering above). Insert a
     `resolved_leagues` row (`canonical_league` = match or `None`).
     Return the match, or today's fallback if no keyword matched.
   - Failure (network error, non-2xx, rate-limit response, malformed
     payload): log a warning with `series_id` and the error, return
     today's fallback, **do not** write a cache row — an unresolved
     `series_id` is retried on the next ingestion run once whatever
     failed (budget, network) has cleared.

### Testing

- `bot/tests/data/provider_matches.json` gets a `series_id` field added
  (matching the live probe's shape) and its existing `"series"` field
  removed — it currently asserts the disproven shape and must not keep
  doing so.
- New fixture: a mocked `series_info` response shape for tests to feed
  the resolution function without a live API call.
- Unit tests (`bot/tests/test_fixtures_provider.py`, extending the
  existing file for this module): cache hit returns cached value with
  zero HTTP calls to `series_info` (assert via mock call count); cache
  miss + keyword match writes the cache row and returns the canonical
  label; cache miss + no keyword match writes a NULL-canonical cache row
  and returns the fallback; a second call for the same unmatched
  `series_id` makes no further HTTP call (NULL is cached too); API
  error returns the fallback and writes no cache row; missing
  `series_id` in the payload skips resolution entirely (today's
  behavior, unchanged).
- No live network calls in the test suite — everything above mocks the
  `series_info` HTTP call the same way the existing test suite already
  mocks `currentMatches` (check `bot/tests/test_fixtures_provider.py`'s
  current mocking pattern before writing new tests — match it, don't
  invent a new one).

### Rollout

No backfill. `fixtures.league` for rows ingested before this change
stays whatever it already is; new fixture-fetch runs (the existing
scheduled cron, `.github/workflows/bot-run.yml`) populate clean labels
going forward as each `series_id` is first encountered. The cache
persists in the DB across cron runs (fresh process each tick, DB is the
only durable state) — this is the entire reason for a DB table over an
in-memory cache: an in-memory cache would reset every run and never
actually reduce API spend.

## Open question the plan should resolve explicitly

Should a manually-triggered "re-resolve all NULL-canonical rows" script
exist for after the keyword table gets a new entry added (e.g. a new
league debuts and its `series_id`s are already cached as unmatched)? Not
designed here — flag it in the plan as a decision point, default to "no,
edit the DB row directly or let a fresh `series_id` next season pick up
the new keyword" if no strong reason emerges to build tooling for it.
