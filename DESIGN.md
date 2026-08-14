---
name: The Cricket Fan — Press Box System
description: The shared design system for both the public Vault (/stories) and the internal Composer (/composer) — one token set, one interaction contract, two surfaces.
colors:
  bg: "#030303"
  surface: "#0a0a0a"
  ink: "#ffffff"
  muted: "#888888"
  border: "#1a1a1a"
  wire-red: "#e8432e"
  wire-red-deep: "#c22f1c"
  wire-red-tint: "#3a1712"
  floodlight-cyan: "#5dc4d9"
  floodlight-cyan-deep: "#3a9fb3"
typography:
  scale:
    xs: "11px"
    sm: "13px"
    base: "15px"
    lg: "18px"
    xl: "24px"
    2xl: "32px"
    3xl: "clamp(36px, 5.5vw, 60px)"
    4xl: "clamp(56px, 9vw, 96px)"
  display:
    fontFamily: "Oswald, sans-serif"
    fontSize: "var(--text-3xl)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "var(--text-lg)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "var(--text-base)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "var(--text-xs)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  sm: "4px"
  md: "8px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.wire-red}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.wire-red-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.border}"
  chip-source:
    backgroundColor: "{colors.wire-red-tint}"
    textColor: "{colors.wire-red}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip-category:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.floodlight-cyan}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: The Cricket Fan — Press Box System

## 1. Overview

**Creative North Star: "The Press Box"**

The Press Box is a sportswriter's desk at the ground, late in the day, under stadium floodlights — not a SaaS admin panel or a generic matchday scoreboard. The energy is wire-service urgency: facts come in, copy goes out, fast, with a single decisive red the same way a press-room clock or an on-air tally light reads as "this matters, act now." Everything else stays quiet — near-black surfaces, tight neutral type — so that one red never has to compete for attention.

This system now covers both surfaces the app ships: the public Vault
(`/stories`) and the internal Composer (`/composer`). Both consume the
same tokens in `frontend/src/app/globals.css` — there is one design
system, not a composer-only skin. An earlier team-blue/team-gold
matchday identity existed for a fixture-explorer UI that has since
been removed from the codebase; nothing in the current app should
reintroduce it without a new brainstorming cycle.

**Key Characteristics:**
- Near-black, flat, tonally layered — no shadows, depth comes from surface-vs-bg-vs-border contrast alone.
- One confident accent (Wire Red) carries all primary actions and states; it never shares a screen with equal-weight competing color.
- A second, cooler color (Floodlight Cyan) exists only to code categories/sources — it is never used for actions.
- Oswald carries display/section weight (inherited from the main app's stat-hero typography); Space Grotesk carries everything you read and type.
- Fast and efficient, polished, a little playful — never sterile, never corporate.

## 2. Colors

The palette is Restrained-to-Committed: near-black neutrals dominate almost the entire surface, and Wire Red is the one deliberate hit of saturation — used sparingly enough that it stays urgent rather than becoming wallpaper.

### Primary
- **Wire Red** (`#e8432e`, oklch(0.58 0.19 10)): The one confident accent. Primary buttons, active/selected states, the record/generate call-to-action, focus rings. Nothing else on the screen competes with it in saturation.
- **Wire Red Deep** (`#c22f1c`): Hover/active state for anything filled with Wire Red. Darker, not lighter — depth reads as "pressed," never washed out.
- **Wire Red Tint** (`#3a1712`): A near-black wash of the same hue, used only as the background behind a Wire Red chip/tag so red text stays legible without introducing a second bright surface.

### Secondary
- **Floodlight Cyan** (`#5dc4d9`, oklch(0.75 0.13 200)): Category/source coding only — the "bank," "bot," "llm," "freeform" and content-bank category tags. Cooler and lighter than Wire Red by design (hue 200 vs. 10, L 0.75 vs. 0.58) so the two never get confused at a glance. Never used on a button or any primary action.
- **Floodlight Cyan Deep** (`#3a9fb3`): Hover state for cyan-tagged interactive chips.

### Neutral
- **Void Black** (`#030303`): Page background. Unchanged from the main app — this is the base identity composer inherits.
- **Ash Surface** (`#0a0a0a`): Card and panel background, one step off the void. The only thing separating a card from the page is this small lightness step plus a 1px border — no shadow.
- **Paper White** (`#ffffff`): Primary text (`ink`). Full contrast against both Void Black and Ash Surface.
- **Signal Muted** (`#888888`): Secondary text, labels, meta rows, placeholder copy that isn't the main content.
- **Border Line** (`#1a1a1a`): The only line weight in the system — card edges, dividers, input outlines at rest.

### Named Rules

**The One Red Rule.** Wire Red appears on exactly one interactive element's resting state per view — the single primary action. Everything else that needs emphasis uses weight, size, or a neutral surface change, never a second saturated fill.

**The Cool-Codes, Warm-Acts Rule.** Floodlight Cyan never sits on a button or triggers an action; Wire Red never labels a category. If a color is clickable-and-consequential, it's red. If it's informational, it's cyan or neutral.

## 3. Typography

**Display Font:** Oswald (with sans-serif fallback)
**Body Font:** Space Grotesk (with sans-serif fallback)

**Character:** Oswald is condensed, heavy, all-caps — it's the shout of a section headline or a stat, used sparingly. Space Grotesk is where the actual work happens: geometric but warm enough not to feel clinical, used for every editable field, button label, and paragraph of body copy.

### Modular Scale
The typography system uses a strict 8-tier modular scale bound to CSS custom properties (`--text-xs` through `--text-4xl`). No hardcoded pixel font sizes exist in component code.

- **4XL Watermark** (`--text-4xl`: `clamp(56px, 9vw, 96px)`): Oversized background watermark numerals (e.g. years or stats) at low opacity (4–6%).
- **3XL Hero** (`--text-3xl`: `clamp(36px, 5.5vw, 60px)`): Page-level spatial section headers ("THE VAULT").
- **2XL Title** (`--text-2xl`: `32px`): Sub-hero headlines and major detail titles.
- **XL Featured** (`--text-xl`: `24px`): Featured lead story titles and panel section headers.
- **LG Subhead** (`--text-lg`: `18px`): Standard story card titles and preview headings.
- **Base Body** (`--text-base`: `15px`): Standard body text, story beats, and editor text.
- **SM Caption** (`--text-sm`: `13px`): Secondary summaries, card metadata, and tool captions.
- **XS Micro Label** (`--text-xs`: `11px`, 0.18em tracking, uppercase): Category badges, form labels, timestamps.

### Named Rules

**The Modular Scale Rule.** Every font size in the app must map to one of the system custom properties `--text-*`. Inline pixel numbers for font sizes are strictly disallowed.

**The Loud-Then-Quiet Rule.** A view gets exactly one Display-weight moment at its top; everything below drops straight to Title/Body/Label. Contrast between the single loud line and quiet structure creates immediate visual hierarchy.

## 4. Elevation & Spatial Depth

**Spatial Dark Glassmorphism:** Depth is created through translucent dark surfaces (`rgba(15, 15, 18, 0.75)` with `backdrop-filter: blur(24px)`), floating spatial tiles, and crisp 1px glowing borders (`rgba(255, 255, 255, 0.08)` at rest → Wire Red `#e8432e` hover aura). Inspired by Apple Vision Pro spatial landing pages, UI containers float with subtle backdrop blur and clean tonal contrast (Void Black `#030303` base → Ash Glass surface → 1px Border Line).

### Named Rules

**The Spatial Glass Rule.** Containers use translucent dark glass (`.ds-spatial-card`, `.ds-glass-panel`) with high-contrast text and 1px border lighting. Depth reads as floating translucent tiles without muddy heavy shadows.

**The Focal Hero Rule.** Every top-level page opens with an immersive spatial hero moment combining media/graphic backdrop assets, bold display typography, and stadium lighting ambiance.

**The Dynamic Rhythm Rule.** Story grids feature visual hierarchy: a lead spatial card spanning 2 columns with full visual prominence, followed by balanced floating cards.

## 5. Components

### Buttons
- **Shape:** 4px radius (`{rounded.sm}`), never fully rounded except chips.
- **Primary:** Wire Red fill, Paper White text, 12px/20px padding, uppercase Label-weight text at 13px. This is the only button that gets a fill.
- **Hover/Focus:** Primary darkens to Wire Red Deep on hover; a 2px Wire Red focus ring (offset 2px from Ash Surface) on keyboard focus. Transition 150ms ease-out on background-color only — no layout-affecting transitions.
- **Secondary/Ghost:** Ash Surface background, Border Line outline, Paper White text — used for every non-primary action (Copy Text, Download PNG, Browse Bank). Hover shifts background to Border Line, no fill change otherwise.

### Chips (source & category tags)
- **Style:** Fully rounded (`{rounded.full}`), 4px/12px padding, Label-weight text.
- **Source chip** (bank/bot/llm/freeform): Wire Red Tint background, Wire Red text.
- **Category chip** (wiki_record/anecdote/story, or content-bank category): Ash Surface background, Floodlight Cyan text, 1px Border Line outline.
- **State:** An already-used content-bank item's chip drops to 50% opacity rather than changing color — "used" is a state, not a new category.

### Cards / Containers
- **Corner Style:** 4px radius, matching the existing `.card-container`.
- **Background:** Ash Surface.
- **Shadow Strategy:** None — see Elevation.
- **Border:** 1px Border Line, always present, never removed for a "flatter" look.
- **Internal Padding:** 16px (`{spacing.md}`) standard; 24px (`{spacing.lg}`) for the editor/preview panels.

### Inputs / Fields
- **Style:** Ash Surface background, 1px Border Line outline, 4px radius, Body-weight text, 12px/16px padding. Replaces the current raw unstyled `<input>`/`<select>` entirely.
- **Focus:** Border Line shifts to Wire Red at 1px — no glow, no box-shadow, consistent with the Flat-By-Default rule. This is the same red as the primary button, so "this field is active" and "this button will act" read as the same signal.
- **Placeholder:** Signal Muted color, never lighter — placeholder text still needs to be read at a glance.
- **Disabled:** Border Line background (matches card background, effectively invisible outline), Signal Muted text, no pointer cursor.

### Navigation
- **Style:** The composer sub-nav (FEED / ANALYTICS) uses Label-weight uppercase links, Signal Muted at rest, Paper White on hover, Wire Red underline (2px, no shadow) on the active route. No pill background on the active state — the underline alone carries it, keeping the header flat.

## 6. States

### Loading
Skeleton shapes, never a spinner. Use the existing `.ds-skeleton` class
(Ash Surface background, `ds-skeleton-pulse` opacity animation, already
defined in `globals.css`) sized to match the content it's replacing —
card-shaped skeletons for a card grid, not a generic bar.

### Empty
Real copy plus an actionable next step — never a bare "No results."
The Vault's existing empty-state pattern (`NOTHING IN THE VAULT FOR
THAT FILTER` + a `Clear filters` button when a filter is active) is
the house rule, not a one-off: any list/grid view that can return zero
results follows the same shape — Label-weight headline, one line of
Body-weight explanation, a recovery action when one exists.

### Error
Per PRODUCT.md's fail-honestly principle: surface the real failure
(unreachable API, missing env var, 503) in Body text, never a generic
"Something went wrong." `SourceBar.tsx`'s error handling (distinguishing
a 503/missing-key message from a generic one) is the reference
implementation — apply the same specificity anywhere a request can fail.

### Named Rule

**The Honest-State Rule.** A component's loading, empty, and error
states get the same design attention as its populated state — they are
not an afterthought bolted on after the "real" UI ships.

## 7. Motion Contract

**Declarative Framer Motion & Spring Physics.** All animation logic uses `framer-motion`. Transition durations and spring curves map to system design tokens (`var(--duration-fast)`, `var(--duration-standard)`, `var(--duration-slow)`).

- **Spring Preset**: `type: "spring", stiffness: 300, damping: 28` for spatial tile hover lifts and subtle interactive responses.
- **Stagger Preset**: `staggerChildren: 0.06` for grid reveals.

**Animates:**
- Spatial hero section entry stagger on page arrival.
- Vault grid card stagger reveal (`motion.div` with Framer variants).
- Spatial card interactive hover elevation (`whileHover={{ y: -4, scale: 1.01 }}`).
- Primary Wire Red action button hover glow expansion (`filter: drop-shadow(0 0 12px rgba(232, 67, 46, 0.4))` + smooth scale).

**Does not animate:**
- Secondary meta text rows, static labels, or background elements.

**Reduced Motion:** Framer Motion handles reduced motion via `<MotionConfig reducedMotion="user">` or checking `prefersReducedMotion()` in `lib/motion.ts`. Under reduced motion, all Framer Motion components instantly snap to final state without layout transitions, matching the global `@media (prefers-reduced-motion: reduce)` block in `globals.css`.

### Named Rule

**The One-Motion-Moment Rule.** A route or state change gets exactly one primary motion moment — the hero reveal, grid stagger, or detail cross-fade. This is the Loud-Then-Quiet rule applied to time.

## 8. Mobile

**Breakpoint.** 640px is the single mobile breakpoint for both
surfaces (distinct from Composer's existing 860px two-column collapse
in `.composer-grid` — that rule is unchanged and stays as its own
breakpoint for the Drafts/Editor split).

**Layout.** Below 640px: single-column card grids (Vault's
`repeat(auto-fill, minmax(280px, 1fr))` already collapses to one column
naturally at this width — verify, don't reintroduce a fixed column
count).

**Tag rows.** Below 640px, a tag/chip row that would otherwise wrap to
several lines becomes a single horizontally-scrolling row
(`overflow-x: auto`, `-webkit-overflow-scrolling: touch`) with a
low-opacity edge fade (a `mask-image` linear-gradient, or a
pseudo-element gradient overlay) signaling more content off-screen.
Never wrap a tag row to more than 2 lines on mobile.

**Touch targets.** Every tappable element (chip, button, card) keeps a
minimum 44×44px hit area on touch viewports, even where the visual
element is smaller — pad with `min-height`/`min-width`, not visual
size inflation.

### Named Rule

**The Scroll-Not-Wrap Rule.** A row of same-weight items (tags, chips)
that doesn't fit its container scrolls horizontally on mobile; it does
not wrap into a multi-line block that pushes content down.

## 9. Keyboard

**Reachability.** Every interactive element is a native `<button>`,
`<a>`, `<input>`, or `<select>` (never a click-only `<div>` or `<span
role="button">` without the accompanying `tabIndex`/`onKeyDown` pair
the existing publish-toggle in `SourceBar.tsx` already demonstrates)
and is reachable via Tab in the same order it appears visually.

**Focus.** The existing Wire Red 2px focus ring (`.ds-btn-primary`,
`.ds-btn-secondary`, `.ds-input` already define `:focus-visible`) is
the one focus treatment in the system — every new interactive class
gets the same `outline: 2px solid var(--wire-red); outline-offset:
2px;` on `:focus-visible`, no exceptions.

**Escape.** Any open modal, popover, or expandable panel (e.g.
`SourceBar`'s Browse Bank panel) closes on `Escape`.

### Named Rule

**The No-Silent-Element Rule.** If it's clickable, it's Tab-reachable
and has a visible focus state. A hover-only or click-only interactive
element is a keyboard dead end and is not shipped.

## 10. Do's and Don'ts

### Do:
- **Do** use Wire Red (`#e8432e`) for exactly one primary action per view, and Oswald Display type for exactly one section header per view — the "one loud thing" discipline is the whole personality.
- **Do** code content sources and categories with Floodlight Cyan or neutral chips, never with a second saturated red.
- **Do** keep every card, panel, and input flat: Ash Surface + 1px Border Line, no box-shadow.
- **Do** surface real error/empty-state text (missing API key, empty content bank, unreachable API) instead of a generic failure message — per PRODUCT.md's "fail honestly" principle.

### Don't:
- **Don't** reintroduce team-blue (`#004ba0`) or team-gold (`#ffcb05`) as an accent anywhere in this app — that pairing belonged to a matchday/fixture UI that has been removed from the codebase entirely; nothing here should bring it back without a new brainstorming cycle.
- **Don't** use raw unstyled HTML `<select>`/`<input>` elements — the plain-admin-dashboard look this system replaces.
- **Don't** add box-shadows, glassmorphism, or soft glows to cards or panels — flat tonal layering only (the one sanctioned exception is the sparing Wire Red button hover glow).
- **Don't** use gradient text, side-stripe borders, or numbered section eyebrows (01 / 02 / 03) as default scaffolding — composer's feed isn't a numbered sequence.
- **Don't** let Floodlight Cyan appear on a button or trigger an action — it labels, it never acts.
