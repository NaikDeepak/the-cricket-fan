# World-Class UI Quality Bar — Design Spec

Date: 2026-08-14
Status: Approved by owner, pending implementation plan

## Problem

Owner feedback: "we still dont look like world class app" — after a Press Box
redesign already shipped (`feature/composer-press-box-redesign`). Investigation
(live app screenshots at `/stories`, `/stories/[key]`, `/composer`, not just
reading `DESIGN.md`) confirmed the complaint is real and has two distinct
causes:

1. **Execution bugs** against the existing, well-specified `DESIGN.md`:
   - Composer's prediction-type control is a raw unstyled native `<select>` —
     `DESIGN.md`'s own "Don't" rule #2 broken in shipped code.
   - `/stories` vault renders 2 cards in a full-bleed black viewport with a
     17-pill unweighted tag wall and no visual anchor — reads as a database
     dump, not editorial folklore.
   - Story detail page dumps the raw tweet-text (emoji included) into a flat
     gray box with no typographic treatment; metadata is one undifferentiated
     row.
2. **Spec gap**: `DESIGN.md` fully covers static visual language (color,
   type, flat elevation, resting/hover/focus/disabled per component) but has
   zero opinion on loading/empty/error states, a motion contract, mobile
   breakpoints/touch targets, or keyboard-focus behavior — exactly what
   separates a premium app (Linear/Arc/Things — the owner's named reference
   bar) from a competent dark theme.

`CLAUDE.md` compounds this: its ARCHITECTURE tree, API ENDPOINTS table, and
"Planned frontend components" list all describe the legacy `backend/app/`
stack and components deleted in this branch's diff (`MatchHero`,
`PlayerBattleCard`, `PredictionCard`, `TriviaCard`, `AnimatedStatGraph`) —
the live stack is `bot/` + `composer/` + `frontend/src/app/{stories,composer}`.

## Decomposition

Three independent efforts identified; only #1 is in scope for this spec:

1. **Quality bar** (this spec): extend `DESIGN.md`'s missing layer, fix the
   concrete execution bugs against it, truth-up `CLAUDE.md`.
2. **Trivia end-to-end** (next cycle): `bot/trivia_standalone.py` has the
   logic; no composer router, no card export, no public surface. Full-stack
   gap, own brainstorm cycle.
3. **Prediction on the public surface** (next cycle): composer can generate
   and export a `PredictionCardImg`, but `/stories` never displays a
   prediction — it only ever leaves as a downloaded PNG for manual posting.
   Own brainstorm cycle.

## Approach

Considered three:
- **A — Execute only**: fix the concrete bugs inside the existing spec.
  Fast, but leaves the next feature to repeat the same gaps (no states/
  motion/mobile/keyboard spec to build against).
- **B — Extend then execute (chosen)**: add the missing layer to
  `DESIGN.md` first (states, motion contract, mobile, keyboard), then fix
  the bugs against the fuller spec. Matches what actually distinguishes the
  named reference bar (Linear/Arc/Things) — interaction discipline, not
  decoration.
- **C — Full motion/interaction rebuild**: custom cursors, scroll-tied
  choreography everywhere. Rejected — violates `DESIGN.md`'s own "one loud
  thing" restraint rule and YAGNI.

## Design

### 1. `DESIGN.md` additions (app-wide — both `/stories` and `/composer`
consume one token system; the doc's current "— Composer" title and its
stale "team-blue belongs to matchday UI" don't-rule get corrected to
reflect this)

**States**
- Loading: skeleton shaped like `.card-container`, Ash Surface pulse — never
  a spinner.
- Empty: real copy + an actionable next step (the vault's existing
  "clear filters" pattern becomes the house rule, not a one-off).
- Error: PRODUCT.md's fail-honestly principle extended to every component —
  no generic "Something went wrong."

**Motion contract**
- Only `--duration-fast` / `--duration-standard` + `--ease-out-quart` — no
  ad-hoc duration/easing values anywhere.
- Animates: mount/filter grid stagger (exists), rail entrance on real data
  (exists), a new short vault↔detail route cross-fade (currently a hard
  navigation cut).
- Does not animate: hover states on secondary elements — "one motion
  moment" mirrors the existing One Red Rule.
- Everything respects `prefers-reduced-motion` (already wired via
  `frontend/src/lib/motion.ts`).

**Mobile**
- Single column below 640px.
- Tag row becomes horizontal-scroll with edge fade instead of wrapping to
  17 lines.
- 44px minimum touch targets.
- Composer's two-column Drafts/Editor layout stacks on mobile.

**Keyboard**
- Every interactive element Tab-reachable in visual order — the existing
  Wire Red focus ring extended app-wide, not just form inputs.
- Escape closes any open modal/panel.

### 2. Concrete fixes against the extended spec

1. Composer prediction-type control: replace the raw `<select>` with the
   styled dropdown pattern `DESIGN.md` already mandates (Ash Surface,
   Border Line, Wire Red focus). Audit composer for any other raw
   `<select>`/`<input>` that slipped through the same way.
2. Vault dead-space: constrain the grid to a max-content-width container
   instead of full-bleed black; at low card counts, fill the space honestly
   with a Loud-Then-Quiet graphic/typographic device ("MORE STORIES
   COMING") rather than faking density.
3. Story detail raw-dump: treat the source text as a pull-quote (larger
   Title-weight type, quote treatment) instead of a `<pre>`-style gray box.
   Group metadata (teams/players/venue/tags) visually instead of one flat
   row.
4. Add the vault↔detail route cross-fade from the motion contract.

### 3. `CLAUDE.md` truth-up

- ARCHITECTURE tree + purpose line: present `bot/` + `composer/` +
  `frontend/src/app/{stories,composer}` as the live stack.
  `backend/app/` marked explicitly legacy/unused (owner decision: mark, do
  not delete, this cycle — revisit once the trivia/prediction cycles
  confirm nothing in it gets reused).
- API ENDPOINTS table: replace the 5 unused legacy endpoints with the
  actual composer routes (`/stories`, `/stories/wire`, `/generate`,
  `/predictions`, `/posts`, `/analytics`, `/content-bank`, `/drafts`).
- "Planned frontend components": delete the already-deleted list
  (`MatchHero`/`PlayerBattleCard`/`AnimatedStatGraph`/`PredictionCard`/
  `TriviaCard`); replace with what's real (`StoryCard`, `StoryCardImg`,
  `OnThisDayRail`, `WireStrip`, composer's `Editor`/`Feed`/`CardPreview`)
  plus a "Next up" line naming trivia-end-to-end and prediction-on-vault as
  scoped, not-yet-designed follow-on cycles.
- New "Design" section pointing to `DESIGN.md` as the authority (per the
  house `design-standards` skill's own override contract), summarizing the
  One Red Rule / Loud-Then-Quiet / new states+motion+mobile+keyboard
  additions so this doc can't silently drift from `DESIGN.md` again.
- "Do not call the Anthropic API on every request" corrected — the live
  path is Gemini (`composer/gemini.py`).
- SESSION LOG: new entry for this cycle.

## Testing / verification

- Visual: re-screenshot `/stories`, `/stories/[key]`, `/composer` (desktop +
  mobile viewport) after implementation, compare against this spec's fixes.
- Existing component tests (`Editor.test.tsx`, `SourceBar.test.tsx`,
  `StoryCardImg.test.tsx`, `rails.test.tsx`) updated/extended to cover new
  skeleton/empty/error states where components gain them.
- No backend contract changes — this is frontend + doc only.

## Non-goals (this cycle)

- Trivia end-to-end build.
- Prediction-on-vault build.
- New photography/illustration asset pipeline (no real images available;
  solved with typographic/graphic treatment, not stock photos).
- Deleting `backend/app/`.
- Approach C's cursor/scroll choreography.
