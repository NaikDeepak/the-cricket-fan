# Content Bank Harvest Pipeline — Design

## Problem

`content_bank` (see `2026-07-23-content-bank-design.md`) exists but has no
growth path: it was seeded once, by hand, via
`bot/scripts/seed_content_bank.py`, and has sat at 13 rows (3 anecdote, 1
story, 9 wiki_record) since. Two of its three "harvester" scripts are
non-functional as growth mechanisms:

- `bot/scripts/harvest_wikipedia_stories.py` is named and documented as a
  live MediaWiki API harvester, but `harvest_wikipedia_story_candidates()`
  just returns a hardcoded `HISTORIC_STORIES` list (3 entries). No API call
  happens.
- `bot/scripts/harvest_cricsheet_thrillers.py` is a real algorithmic scanner
  (scans local Cricsheet JSON for last-over finishes / big comebacks) but is
  never called by anything — dead code.

No GitHub Actions workflow touches `content_bank`. Goal: a recurring,
low-touch pipeline that keeps finding new candidate stories/anecdotes,
drafts tweet-ready text for them, and queues them for owner review —
without the owner having to hand-write prose every time or hand-edit a
draft JSON file.

## Relationship to the original content-bank design

The original design (`2026-07-23-content-bank-design.md`) deliberately
chose **no runtime LLM path** and **hand-authored, owner-reviewed** text for
anecdotes/stories, for two reasons: (1) the bot had zero LLM dependency at
the time, and (2) avoiding verbatim reuse of copyrighted Wikipedia prose —
facts are not copyrightable, expression is, so the text had to be written
fresh by a human.

This pipeline changes the *authoring* step but keeps the same legal
guardrail and adds a stronger review gate:

- Harvesters still surface **facts only** (event, names, numbers, dates) —
  never scraped prose.
- Gemini drafts fresh sentences **from those facts**, not by paraphrasing
  or summarizing source prose — same "own phrasing" principle, just
  mechanized instead of hand-typed.
- Nothing a harvester or Gemini produces is postable until the owner
  explicitly reviews and publishes it (see "Review gate" below) — the
  review step that was implicit in editing `draft.json` by hand is now
  explicit and enforced by the bot itself, not just by process.

`bot/scripts/seed_content_bank.py`'s file-based two-phase flow is untouched
and remains available for one-off manual bootstrapping; this pipeline is
the new path for ongoing, recurring growth.

## Architecture

```
[Wikipedia API]   [local Cricsheet JSON]   [r/cricket public .json]
       |                    |                        |
       v                    v                        v
harvest_wikipedia_   harvest_cricsheet_       harvest_reddit_
stories.py (fixed:   thrillers.py (wired      stories.py (new)
real API calls,      up: now has a caller)
not hardcoded)
       \____________________|________________________/
                             v
              bot/scripts/harvest_content.py  (new orchestrator)
                1. collect candidates from all 3 sources
                2. drop any whose content_key already exists
                   in content_bank (dedup)
                3. cap combined new candidates at 10 per run
                4. for any candidate without pre-written segments,
                   call Gemini to draft tweet-ready text from its
                   facts (own phrasing, not source prose)
                5. INSERT INTO content_bank, is_published = FALSE
                             |
                             v
              composer /content-bank UI (already exists)
                owner reviews each pending row, edits if needed,
                toggles is_published = TRUE to approve
                             |
                             v
       bot/trivia_standalone.py._content_bank_candidates()
         FIX: add `.where(content_bank.c.is_published == True)`
         (missing today — every row is eligible regardless of the
         publish flag, making composer's toggle currently a no-op)
                             |
                             v
                 bot-run cron tweets it eventually,
                 same 30-day trivia_log dedup as today
```

One new external dependency for `bot/`: `google-generativeai`, plus a new
`GEMINI_API_KEY` GitHub Actions secret (bot's workflows don't have one
today — `composer/`'s key is a separate app/secret).

## Components

### 1. `harvest_wikipedia_stories.py` (fix)

Replace the hardcoded `HISTORIC_STORIES` return with real MediaWiki API
calls against the same curated page-title list (`Bodyline`, `Jim_Laker`,
`Kolkata_Test_2001`, `2005_Ashes_series`, plus room to grow the list) using
`action=query&prop=extracts` for a plain-text summary. Output shape:
`{content_key, title, summary, category, teams, players, venue, year,
match_format, tags, source}` — facts/metadata only, no `segments` (drafting
happens downstream).

### 2. `harvest_cricsheet_thrillers.py` (wire up)

Already-correct scanning logic. Give it a caller: iterate the local
Cricsheet JSON directory (same path `bot/cricsheet.py` already ingests
from), run `scan_cricsheet_match_file()` per file, collect non-`None`
results. Output shape mirrors the Wikipedia harvester's facts-only shape,
`content_key = "story:thriller:<cricsheet-match-id>"`.

### 3. `harvest_reddit_stories.py` (new)

Pulls `https://www.reddit.com/r/cricket/top.json?t=year&limit=50` (public,
unauthenticated — read-only JSON doesn't require an app/OAuth client) with
a descriptive `User-Agent` header. Filters titles by a nostalgia keyword
regex (`on this day`, `years ago`, `remember when`, `throwback`, etc.).
Output: `{content_key: "story:reddit:<post-id>", title, summary (post
selftext or top comment excerpt), source: "reddit:<permalink>"}`. A source
returning nothing (rate-limited, no matches this run) is not an error —
logs and returns `[]`.

### 4. `harvest_content.py` (new orchestrator)

```
candidates = wiki_candidates() + cricsheet_candidates() + reddit_candidates()
# each source call wrapped individually — one failing logs a warning
# and contributes [] rather than aborting the run
existing_keys = {row.content_key for row in content_bank}
new = [c for c in candidates if c["content_key"] not in existing_keys][:10]
for c in new:
    if "segments" not in c:
        c["segments"] = draft_segments_with_gemini(c)  # facts -> fresh prose
    insert content_bank(..., is_published=False)
```

`draft_segments_with_gemini` ports the client pattern from
`composer/gemini.py` into `bot/`, prompted to produce 1 tweet (category
`anecdote`/`wiki_record`) or 2-4 segments (category `story`) strictly from
the given facts, in the bot's existing voice/hashtag convention
(`#Cricket #TheCricketFan`), never inventing facts not in the input.

### 5. Review-gate fix

One-line addition to `_content_bank_candidates()` in
`bot/trivia_standalone.py`:
`.where(content_bank.c.is_published == True)`. Independent bug fix — the
13 existing rows are all `is_published=True` today so this has been
invisible, but it means composer's unpublish toggle currently does
nothing. Ships as part of this work since the whole review-gate design
depends on it actually filtering.

### 6. Ops

New `.github/workflows/bot-harvest-content.yml`:
- `schedule: cron("0 6 * * 1")` (weekly, Monday 06:00 UTC)
- `workflow_dispatch` for manual runs
- Same secret pattern as `bot-run.yml`/`bot-retrain.yml` (`BOT_DATABASE_URL`
  + new `GEMINI_API_KEY`)
- No X/CRICKET_API secrets needed — this workflow never posts or fetches
  fixtures

## Error handling

- Each source is independently try/excepted in the orchestrator; a failure
  logs and contributes zero candidates rather than aborting the run.
- Gemini failures on a single candidate are logged and that candidate is
  skipped (not inserted half-drafted) — never insert a row with empty or
  malformed `segments_json`, same invariant `_valid_content_row()` already
  enforces on read.
- Reddit's public endpoint has no guaranteed uptime/rate-limit SLA — treated
  as best-effort, same as the other two sources.

## Testing

- `harvest_wikipedia_stories.py`: mock `requests.get`, assert real API call
  shape and parsed output (same style as `test_news_fetcher.py`).
- `harvest_cricsheet_thrillers.py`: existing scan logic already has direct
  unit coverage (per current tests); add a test for the new
  directory-iteration caller.
- `harvest_reddit_stories.py`: mock `requests.get`, assert nostalgia-keyword
  filtering and `content_key` derivation from post ID.
- `harvest_content.py`: fake sources fixture, assert dedup against existing
  `content_key`s, the 10-item cap, `is_published=False` on insert, and that
  one source raising doesn't stop the other two.
- Regression test in `test_trivia_standalone.py` locking in the
  `is_published` filter: a row with `is_published=False` must never appear
  in `_content_bank_candidates()`'s output.

## Non-goals

- No change to `bot-run.yml`'s cadence or the prediction/trivia posting
  path — this pipeline only ever writes `is_published=False` rows.
- No auto-publish. Every harvested/drafted row requires an explicit owner
  action in composer before it can be tweeted.
- No new Reddit API credentials/app registration — public JSON endpoint
  only, read-only, best-effort.
