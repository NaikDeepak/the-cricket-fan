# Stories Loop & Vault — Design

## Problem

The July content-tooling round (see `2026-07-24-composer-content-tooling-design.md`) shipped
composer workflow depth. Since then, a large unfinished work-in-progress landed on
`feature/composer-press-box-redesign`: a public `/stories` page, a stories API router
(`composer/routers/stories.py`, tests passing), two harvest scripts (Cricsheet thrillers,
Wikipedia stories), and an unwired `bot/news_fetcher.py`. The WIP proves the idea but is
disconnected from the posting workflow, styled outside the Press Box design system, and has a
latent schema bug.

Owner goals this round (confirmed):

1. **Product coherence** — tie bot + composer + stories into one visible loop:
   harvest → curate → publish → web archive.
2. **Wow factor / polish** — make the public surface feel premium, animated, shareable.

Deployment posture: **local-first, deploy-ready** — nothing in this round may block a later
Vercel + Neon deploy, but shipping publicly is a later round.

## The Loop

```
harvest scripts ──> content_bank ──> composer (curate/draft) ──> copy + mark posted
                        │                                              │
                        └──────────> /stories "Vault" <── /stories "The Wire" (posted drafts)
```

Every stage already exists except the two arrows into `/stories`. This round wires them and
polishes both public surfaces.

## Latent issues this round fixes

1. **`content_bank.is_published` uses `server_default=sa.text("1")`** — invalid boolean literal
   on Postgres, and the project convention bans `server_default` (defaults are set explicitly at
   insert time). Fix: drop the `server_default`, set the value explicitly in every insert path
   (harvest scripts, seeders), and add a guarded
   `ALTER TABLE content_bank ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE`
   to `ensure_schema` (`conn.dialect.name == "postgresql"` branch), since the column is new since
   the last Neon deploy.
2. **Stories UI is off-system** — hardcoded `#ffcb05` / `#00e5ff`, inline styles, no Press Box
   tokens. Full restyle (below).
3. **`bot/news_fetcher.py` is dead code** — written and tested, never called. Wired in as a
   composer source (below).

## Backend changes (all small)

- **`GET /stories/wire`** — recent posted drafts (`drafts.status = 'posted'`), newest first,
  `limit` query param (default 12). Public archive of what actually shipped. No schema change.
- **`PATCH /content-bank/{id}/publish`** — flips `is_published`. Body: `{"is_published": bool}`.
  Unpublished items are hidden from all `/stories` list endpoints but remain fully usable inside
  composer.
- **`POST /generate/recap`** — body `{"team_a": str, "team_b": str}`. Calls
  `bot.news_fetcher.get_match_recap_tweet`, creates a draft with `category="recap"`. The fetcher
  already has an offline fallback tweet, so the endpoint never 500s on RSS failure.
- **`is_published` default fix** as described above.

Constraints held: sync SQLAlchemy Core only; `bot` never imports `composer` (composer importing
`bot` is fine and is how `news_fetcher` is reached); explicit timestamps at insert time.

## `/stories` page (the Vault)

Full restyle onto the Press Box design system — same tokens (`--wire-red`,
`--floodlight-cyan`, spacing/easing vars), `ds-*` classes, Space Grotesk. One product, two rooms.
The `#ffcb05` one-off palette dies.

Layout, top to bottom:

1. **Masthead** — "THE VAULT" micro-label, display headline, same header grammar as composer.
   Nav links composer ↔ vault both ways.
2. **"On This Day" hero rail** — items where `event_month_day` matches today. Wide horizontal
   cards, wire-red accent, date stamp ("13 AUG"). Rail renders nothing when no items match — no
   empty placeholder.
3. **"The Wire"** — horizontal strip fed by `GET /stories/wire`: compact ticker-style cards
   (category chip, first line of text, posted date), floodlight-cyan accent. Static swipe strip —
   no marquee/auto-scroll.
4. **Vault grid** — search + tag pills (existing behavior), restyled. Filters read/write the URL
   query string (`?tag=...&q=...`) so filtered views are linkable. Cards: category chip
   (`wiki_record` / `anecdote` / `story` mapped to display names), year badge, title, 2-line
   summary clamp, CSS hover lift + border glow using `--ease-out-quart` / `--duration-standard`.
5. **States** — skeleton cards while loading (no "Loading…" text); styled empty state for zero
   results.

Responsive: rails become swipe-scroll on mobile; grid collapses 3 → 2 → 1 columns.

## Story detail page

**Route:** `/stories/[contentKey]` (App Router dynamic route) fetching the existing
`GET /stories/{content_key}`. Replaces `StoryCardModal`, which is deleted. Deep-linkable URL —
deploy-ready sharing from day one.

Single reading column (~680px measure):

1. **Header** — category chip + `match_format` + year, display-size title, summary as lede.
2. **Beats** — `segments[]` rendered vertically as numbered story beats ("1/3" gutter marker),
   not a carousel. Scroll-reveal per beat (Motion section).
3. **Meta strip** — teams / players / venue / tags as chips; tag chips link to
   `/stories?tag=...` (vault pre-filtered via the URL-param filters above).
4. **Provenance footer** — `source_type` + `source_ref` as an outbound link. Verified-real is
   the brand; provenance is shown, never hidden.
5. **Prev/next** — bottom navigation to adjacent stories in current vault order.

**Share card:** new `StoryCardImg.tsx` beside the existing composer `cards/` components, using
the same PNG-export mechanism (blank-export bug already fixed in `487484f`). 1080×1350 portrait:
category label, title, one key line (first segment, falling back to summary), year + venue stamp,
#TheCricketFan brand mark, Press Box styling. "Download card" button on the detail page.

## Composer tie-ins

1. **RECAP source** — `SourceBar` gains a "RECAP" button beside GENERATE: two team inputs
   (datalist prefilled from known team names in the DB), calls `POST /generate/recap`, opens the
   created draft.
2. **Publish toggle** — eye icon per Browse Bank item hitting the publish PATCH. Curation
   control without delete.
3. **Cross-links** — bank item row gets "View in Vault ↗" → `/stories/[key]`; Posts tab posted
   rows get an "On the Wire" badge; header nav both directions.

No other composer changes — the July round covered workflow depth.

## Motion & polish

GSAP (project mandate; not yet in `frontend/package.json` — installed this round). The global
`prefers-reduced-motion` guard already exists in `globals.css`; GSAP code additionally checks it
before animating.

Motion lives in exactly three places:

1. **Vault grid entrance** — stagger fade-up on load and filter change (~40ms stagger,
   `--ease-out-quart`).
2. **Detail beats** — ScrollTrigger reveal per beat: fade + 20px rise entering the viewport.
3. **On This Day rail** — single entrance slide; date stamp counts in. One-shot, no loops.

Hovers stay pure CSS. No marquee anywhere.

Non-motion polish: `/stories` `layout.tsx` exports `title` / `description` + OG tags
(deploy-ready SEO groundwork; works with client pages). Date stamps formatted consistently as
"13 AUG 2008".

## Testing (TDD)

- **Backend (pytest):** `/stories/wire` (posted-only, ordering, limit); publish PATCH (flip +
  effect on vault list visibility); `/generate/recap` (mock RSS via monkeypatch — success path,
  RSS-down fallback path, draft created with `category="recap"`); explicit `is_published` insert
  value. The Postgres `ensure_schema` branch follows the existing guarded-ALTER pattern.
- **Frontend:** URL-param filter read/write logic; rail/Wire conditional rendering (hidden when
  empty); `StoryCardImg` renders story fields. Motion is not unit-tested — verified visually.
- `bot/news_fetcher.py` tests already exist and pass.

## Task order (cheapest / most isolated first)

1. `is_published` server_default fix + `ensure_schema` ALTER
2. `GET /stories/wire`
3. `PATCH /content-bank/{id}/publish` + bank eye toggle
4. `POST /generate/recap` + RECAP button
5. Vault restyle to Press Box + URL-param filters + skeleton/empty states
6. On This Day rail + Wire strip
7. Detail route `/stories/[contentKey]` — beats, meta chips, provenance, prev/next; delete modal
8. `StoryCardImg` + download button
9. GSAP install + motion pass (grid stagger, beat reveal, rail entrance)
10. Metadata/OG + cross-links both directions

## Out of scope this round

- Actual Vercel/Neon deploy (architecture must not block it; shipping is a later round).
- Auth, paid APIs, auto-posting (settled decisions, not reopened).
- Likes/comments/analytics on the vault.
- Backfilling `event_month_day` dates onto existing bank items — still a flagged manual research
  step; dates are verified before insert, never guessed.

## Constraints (carried from project conventions)

- Sync SQLAlchemy Core throughout composer/bot; never async ORM.
- Timestamps and defaults explicit at insert time; no `server_default`.
- New columns on live-Neon tables need guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in
  `ensure_schema` (`conn.dialect.name == "postgresql"`).
- Ruff line length 99; Python via `bot/.venv/bin/python` only.
- `bot` never imports `composer`.
- Frontend: App Router only; Tailwind v4 tokens; `clsx` + `tailwind-merge`; no raw data tables
  in the UI; check `frontend/node_modules/next/dist/docs/` before writing Next.js code.
