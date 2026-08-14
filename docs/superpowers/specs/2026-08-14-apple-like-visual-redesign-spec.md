# The Cricket Fan — Visual Redesign Spec (for Gemini/agent execution)

Date: 2026-08-14
Status: Draft — not brainstormed interactively, written directly per owner
request to hand to another agent. Ground truth verified against the live
repo at branch `feature/world-class-ui-quality-bar` (PR #8).

**Read this whole document before writing any code.** It is written to be
self-contained — you (the executing agent) have no memory of the
conversation that produced it.

---

## 1. Why this exists

The app's current UI is functionally correct but reads as "developer built
this," not "Apple built this." A prior cycle (PR #8) extended the design
*system's documentation* (states, motion tokens, mobile breakpoints,
keyboard rules) and fixed concrete execution bugs (an unstyled `<select>`,
a CSS-specificity bug, a raw text dump) — but that cycle explicitly did
**not** touch typography scale, layout structure, hero moments, or visual
depth. Those are exactly what separate a premium app from a competent dark
theme, and they are this spec's job.

**"Apple-like" here means:** restraint, typographic confidence, generous
whitespace, one clear focal point per screen, motion that's felt not just
present, and layout that doesn't read as a template. It does **not**
necessarily mean switching to a white/light theme — Apple's own apps
(Music, TV, Fitness+) run dark themes with exactly this kind of polish.
This spec keeps the existing near-black + Wire Red identity (it's already
well-reasoned — see `DESIGN.md` at repo root) and elevates its *execution*,
rather than replacing the palette. If you disagree after reading `DESIGN.md`
in full, that's a decision point to raise with the owner before building —
don't silently change brand colors.

---

## 2. Stack constraints (do not violate)

- **Next.js 16**, App Router only, no `pages/` directory. **Next.js 16 has
  breaking changes from what most training data knows** — read
  `frontend/node_modules/next/dist/docs/` for current API before writing
  any Next-specific code (routing, data fetching, metadata, config).
- **React 19.2.4** (stable channel). Do not use `ViewTransition` from
  `"react"` — it is canary-channel-only in this install (verified this
  session via `node -e "require('react').ViewTransition"` → `undefined`).
  Any cross-page transition work must use GSAP (already a dependency) or
  plain CSS, not React's experimental transitions API.
- **Tailwind CSS v4** is installed but this codebase's actual pattern is a
  hand-rolled `.ds-*` utility-class system in
  `frontend/src/app/globals.css`, driven by CSS custom properties in
  `:root`. Follow that existing pattern — don't introduce Tailwind
  utility classes into JSX that the rest of the codebase doesn't use.
- **GSAP** for all animation. `frontend/src/lib/motion.ts` exports
  `prefersReducedMotion()` — every animation must check it and no-op
  under reduced motion.
- **TypeScript**, strict. **Vitest + Testing Library** for tests — this
  repo has meaningful test coverage already (54 tests, 12 files as of
  this writing); don't leave it worse than you found it.
- **No backend/API changes.** This is a frontend-only visual pass. The
  API surface (`composer/routers/*.py`) is out of scope entirely.
- Do not touch `backend/app/` — it's legacy/unused, explicitly marked as
  such in `CLAUDE.md`, kept only pending a future cleanup decision.

---

## 3. Current state — what actually exists today

Two live surfaces, one shared token system:

- **Public Vault** (`/stories`, `/stories/[contentKey]`) — what fans see.
  Story cards, an on-this-day rail, a wire strip of recent posts, tag
  filtering, a story detail page with "beats" (segments of narrative
  text) and a downloadable share-card export.
- **Composer** (`/composer`, `/composer/{posts,predictions,analytics}`)
  — an internal manual content tool, not public-facing. Draft generation,
  card preview, publish workflow.

Design tokens live in `frontend/src/app/globals.css` under `:root`:
```css
--bg: #030303;              /* page background */
--surface: #0a0a0a;         /* card/panel background */
--fg: #ffffff;               /* primary text */
--muted: #888888;            /* secondary text */
--border: #1a1a1a;           /* the only line weight in the system */
--wire-red: #e8432e;         /* the one accent — primary actions only */
--wire-red-deep: #c22f1c;
--wire-red-tint: #3a1712;
--floodlight-cyan: #5dc4d9;  /* category/source labeling only, never actions */
--floodlight-cyan-deep: #3a9fb3;
--space-xs/sm/md/lg/xl: 4/8/16/24/40px;
--duration-fast: 150ms;
--duration-standard: 250ms;
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
```

Typography today: Oswald (display, uppercase, one per view) + Space
Grotesk (everything else). Full rules in `DESIGN.md` at repo root —
**read it in full before designing anything**, especially:
- §1 Overview (the "Press Box" creative concept)
- §2 Colors, "The One Red Rule" and "The Cool-Codes, Warm-Acts Rule"
- §3 Typography, "The Loud-Then-Quiet Rule"
- §4 Elevation, "The Flat-By-Default Rule" (no shadows anywhere — this
  is a deliberate constraint, not an oversight; if you want depth, it
  has to come from tonal layering, not shadows, unless you get explicit
  sign-off to change this rule)
- §6-9 States/Motion/Mobile/Keyboard (added in PR #8 — states, a
  token-only motion contract, mobile breakpoints, keyboard rules)

Component inventory (all real, all live):
- Vault: `StoryCard`, `StoryCardImg` (share-card export), `OnThisDayRail`,
  `WireStrip`, `StoryBeats`
- Composer: `Editor`, `Feed`, `SourceBar`, `CardPreview`, `TeamBadge`,
  `PredictionCardImg`, `RecordCardImg`, `TriviaCardImg`

**What this spec is reacting against, concretely** (verified via
screenshots this session):
- The Vault at low story counts is 1-2 cards floating in a mostly-empty
  viewport with no visual anchor — no hero, no imagery, no sense of
  place.
- Every page opens with the same shape: small eyebrow label, one
  headline, one paragraph, then content. No page has a genuine "hero
  moment" — a first few seconds that feels designed rather than
  assembled.
- Cards are uniform rectangles with a category chip, a title, two lines
  of body text, a "Read story →" link. There's no size/weight variation
  to create visual rhythm — every card is exactly as loud as every
  other card.
- The story detail page's content, even after PR #8's pull-quote fix, is
  still fundamentally a stack of text blocks — no large-format moment,
  no sense of "this is the story," just correctly-styled paragraphs.

---

## 4. What "done" looks like

Five concrete, testable outcomes. Each needs a design decision AND an
implementation — don't design in the abstract, ship working React/CSS.

### 4.1 A real typographic scale

Today: Display (Oswald, `clamp(32px,6vw,64px)`), Title (18px), Body
(15px), Label (11px). That's only 2 real size steps between Title and
Display, and nothing between Body and Title. Apple-grade hierarchy needs
more steps and more contrast between them.

**Deliverable:** extend `DESIGN.md`'s Typography section (§3) with a full
modular scale (recommend a 1.25–1.333 ratio, landing roughly at
13/15/18/24/32/48/64px, all as new CSS custom properties in `:root` —
e.g. `--text-xs` through `--text-3xl`), and specify which existing UI
element maps to which new step. Then apply it — every hardcoded
`fontSize: 15` / `fontSize: 14` inline style in the codebase (`grep -rn
"fontSize:" frontend/src` to find them all) should resolve to one of the
new scale steps, not a bespoke number.

### 4.2 A hero moment on every top-level page

`/stories`, a story detail page, and `/composer`'s main view each need
one deliberate, larger-than-life opening moment — not just a bigger
headline. Ideas to choose from (pick what fits the "wire service /
floodlit stadium" identity, don't default to a generic gradient hero):
- A large-format "today's headline" treatment on `/stories` — the single
  most notable story of the moment gets a full-width, oversized
  treatment above the grid, distinct from every other card.
- A big Oswald numeral/stat as a background watermark behind the story
  detail page's title (e.g. the year, or a key stat from the story).
- An animated stadium-floodlight-style light sweep or scan-line texture
  behind headlines — subtle, on-brand, GSAP-driven, respects reduced
  motion.

**Constraint:** stays within the Flat-By-Default rule (§4) — no drop
shadows, no glassmorphism. Depth/drama has to come from scale, type
weight, and the existing tonal-layering technique, or from a genuinely
new named rule you add to DESIGN.md with justification.

### 4.3 Card rhythm, not card uniformity

Redesign `StoryCard` (and the Vault's grid) so cards have visual
hierarchy — e.g. a featured/first card that's visually larger or
differently laid out than the rest, varying card heights driven by
actual content length rather than fixed clamps, or a masonry-style grid
instead of uniform `repeat(auto-fill, minmax(280px, 1fr))`. Apply the
new type scale from 4.1 so card titles aren't all the same visual weight
as their metadata.

### 4.4 Motion with weight

PR #8 added a 250ms opacity fade on page arrival — correctly
implemented but, per the owner's own feedback, invisible in practice.
Redesign the motion layer to actually register:
- Real page-transition choreography (GSAP timeline, not a single
  opacity tween) — e.g. staggered reveal of hero → metadata → grid,
  not everything fading in at once.
- Meaningful hover/interaction feedback on cards and buttons beyond the
  existing border-color change — motion, not just color, on the
  system's "one primary action" elements (respects the One Red Rule —
  don't add motion to every element, just the ones that matter).
- Keep the token-only motion contract from `DESIGN.md` §7 — extend the
  token set if you need more values (e.g. a `--duration-slow` for
  hero-level choreography), don't hardcode ad-hoc numbers.

### 4.5 Visual texture without photography

There's no photography/illustration budget or pipeline (verified — no
image assets exist beyond exported share cards). Depth and visual
interest has to come from typography, generative/CSS-driven graphics
(gradients are currently banned by house style except where DESIGN.md
explicitly carves out an exception — check before adding any), data
visualization (stat call-outs, score/number treatments in the large
Oswald display face), or motion — not stock imagery.

---

## 5. Process constraints (how to work, not just what to build)

- **Read `DESIGN.md` in full before writing CSS.** Don't reinvent tokens
  that already exist. Where you need a new rule, add it to `DESIGN.md`
  with a "Named Rule" in the doc's existing style (see how §6-9 are
  written) — the doc is the system of record, not a one-time reference.
- **Screenshot your work before calling it done.** A past cycle on this
  branch shipped a CSS-specificity bug (an inline style silently beat a
  media query, regressing mobile) that a single screenshot would have
  caught immediately — verified only by a later whole-branch code
  review, not by the implementer. Run the app
  (`cd frontend && npm run dev`, backend via
  `bot/.venv/bin/python -m uvicorn composer.app:app --port 8000` from
  repo root — see root `CLAUDE.md`'s Composer section for full local-dev
  instructions) and actually look at both desktop and mobile viewports
  before considering any task finished.
- **Don't break existing tests.** `cd frontend && npm test` — 54 tests,
  12 files, all passing as of this spec's writing. Extend tests for new
  components/behavior; don't delete coverage to make changes easier.
- **Don't touch composer's internal-tool pages beyond token/type-scale
  application.** `/composer` is a working tool for one operator (the
  owner), not a public-facing surface — it needs the same design tokens
  applied consistently, but doesn't need its own hero moments or
  redesigned information architecture. Focus the ambitious work (4.2,
  4.3) on the public Vault and story detail pages.
- **This is a big change — decompose it.** Don't attempt all of section
  4 in one pass. Suggested order: 4.1 (typography scale) first since
  everything else depends on it, then 4.3 (card rhythm), then 4.2 (hero
  moments), then 4.4 (motion), then 4.5 (texture) last since it's the
  most exploratory.
- **Preserve accessibility work already done.** PR #8 added keyboard
  reachability rules (`DESIGN.md` §9) — every new interactive element
  needs a native, Tab-reachable element and a visible focus state
  (`:focus-visible` with the existing Wire Red outline pattern). Don't
  regress this while redesigning.

---

## 6. Explicit non-goals

- No new backend functionality (trivia end-to-end and prediction-on-vault
  are separate, already-scoped future cycles — see `CLAUDE.md`'s "Next
  up" section — not part of this visual pass).
- No framework migration, no new major dependencies beyond what's already
  installed, no CSS-in-JS library adoption (the `.ds-*` class pattern is
  established and should be extended, not replaced).
- No stock photography or illustration purchases/generation pipeline.
- No light/white theme — see §1's framing on what "Apple-like" means
  here.

---

## 7. Deliverable format

Whoever executes this should produce, in order:
1. An updated `DESIGN.md` with the new typography scale (§4.1) and any
   new Named Rules the hero-moment/motion/texture work requires.
2. Working code for §4.1-4.5, each as its own reviewable commit or PR,
   screenshotted (desktop + mobile) before being called done.
3. A short before/after visual comparison (screenshots) for the owner to
   review — this is a visual redesign; the owner needs to *see* it, not
   just read a diff.
