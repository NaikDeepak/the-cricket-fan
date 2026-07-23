# Composer Content Tooling — Design

## Problem

Composer (the manual content-authoring tool, `composer/` + `frontend/src/app/composer/`) shipped this week with a full visual redesign and two new read-only tabs (Predictions, Posts), but the owner is "still not satisfied with the features." Polish isn't the gap — production capability is.

## Process

Four independent product-team agents (general-purpose, isolated from each other, each with full product context but a distinct lens) were asked to prioritize what's actually missing:

1. **Solo-Creator UX Advocate** — daily-use friction, reading the actual component code.
2. **Growth & Audience Strategist** — what drives an X cricket-fan audience.
3. **Technical Feasibility Realist** — read the real schema/backend code, separated cheap wins from infra fantasy.
4. **Competitive/Reference Scanner** — researched Buffer/Hootsuite/TweetDeck/Typefully/Hypefury and cricket-stats accounts for concrete patterns, not generic advice.

Full transcripts are not preserved; the convergent findings below are.

## Decisions (owner-confirmed)

- **Evergreen content tooling over fixtures-pipeline investment.** The bot's ML-prediction pipeline is blocked on a separate, already-tracked bug (`CRICKET_API_KEY` / `bot/run.py` never fetching upcoming fixtures) and costs ongoing API reliability + money to fix. The `team_matches`/`content_bank`-driven generators (H2H, venue, record, curated anecdotes/stories) work today at zero marginal cost. This round invests there.
- **Composer is for planned content, not live in-match reactions.** Optimize for content depth and reliable output, not raw speed-to-publish. (Rules out mobile quick-capture and live-moment fast-mode from this round.)
- **Success metric is consistency/output volume**, not audience-growth chasing. (Rules out debate-bait/rivalry templates and anything requiring paid engagement-analytics APIs.)

## Root cause found during investigation (not a feature — a bug)

`composer/routers/generate.py`'s `generate_bot` handler, for `kind` in `{h2h, venue, record}`, does:

```python
matches = [c for c in build_candidates(df) if c[0].startswith(prefix)]
key, _fmt, segments = matches[0]
```

`build_candidates` (in `bot/trivia_standalone.py`) computes every valid H2H pair, every qualifying venue, and up to 5 record types per season — but the composer endpoint always takes index `0`. Every "Generate" click for the same `kind` returns the *same* candidate, forever, and the created draft never records which `content_key` it came from (`create_draft(..., content_key=` is never passed in this path). This single line is why "record" generation has felt repetitive — it's not a missing feature, it's a truncation bug with a one-line surface but a real fix (Task 1).

The bot's own `bot/trivia_standalone.py::pick_standalone_trivia` already solves exactly this problem (recent-exclusion + random choice, falling back to the full pool when everything's been used) for the automated posting path. Task 1 mirrors that established idiom for composer's manual path, keyed off the `drafts` table instead of `trivia_log` (composer creates drafts, not bot posts).

## Scope for this round (7 tasks, ordered cheapest/most-isolated first)

1. **Fix the `matches[0]` truncation** — `generate/bot` for h2h/venue/record excludes candidates already generated recently (via `drafts.content_key`), falls back to the full pool once everything's been used. Also starts recording `content_key` on bot-generated drafts (currently never set).
2. **Fix thread-segment truncation on bank select** — `SourceBar.tsx` currently drops `item.segments[1:]` when a thread-format content-bank item is picked; only the first tweet of a 2-4 tweet thread survives into the draft.
3. **Evergreen resurfacing** — replace the binary `used` flag on content-bank items with `last_used_days` (days since last drafted from, `null` = never used). Never-used items sort first; among used items, longest-unused sorts first. Items used within a 14-day freshness window still visually dim; older ones don't, so a good record/anecdote naturally comes back into rotation instead of being permanently buried.
4. **"On this day" date-matched surfacing** — content-bank items gain a nullable `event_month_day` ("MM-DD") column. Items matching today's month/day sort to the very top of Browse Bank, ahead of the evergreen sort. Ships the mechanism; backfilling real dates onto the 13 existing seeded items is a separate, explicitly-flagged research step (verify each date before inserting — do not guess).
5. **One-click "Copy + Mark Posted"** — collapses the current copy-text-then-separately-click-mark-posted sequence into one action, serving the consistency/volume goal directly.
6. **Duplicate-draft** — one click to create a new draft pre-filled from an existing one's text/category/theme, for repeating a format that's working.
7. **Wire the `Posts` tab's `post_type` filter into the UI** — `GET /posts` already accepts `post_type`; the frontend only exposes the `state` filter. Cheap, backend has no work.

## Explicitly out of scope this round

- Fixing the CricAPI fixtures pipeline (separate spec: `docs/superpowers/specs/2026-07-23-upcoming-fixtures-provider-design.md`).
- Any paid X read-API / engagement analytics.
- Auto-posting or browser automation of any platform (settled decision, not reopened).
- Multi-user/auth.
- LLM-generated "facts" bypassing hand-review.
- New card themes / visual polish.
- Mobile quick-capture, live-moment fast mode, debate-bait templates (deprioritized this round per the decisions above, not rejected forever).

## Constraints (carried from existing project conventions)

- Sync SQLAlchemy Core throughout composer/bot; never async ORM.
- Timestamps explicit (`datetime.now(timezone.utc)` at insert time), never `server_default`.
- `card_meta` JSON boundary: `card_meta_json` TEXT in DB, `dict | None` at the API.
- New columns on tables that already exist on the live Neon DB need explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `ensure_schema`, guarded by `conn.dialect.name == "postgresql"` (SQLite tests get the column for free via `metadata.create_all` on a fresh engine).
- Ruff line length 99. Python via `bot/.venv/bin/python` only.
- `bot` never imports `composer`.
