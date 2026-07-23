---
name: The Cricket Fan — Composer
description: A sportswriter's late-night desk for turning cricket facts into copy-ready, on-brand posts.
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
  display:
    fontFamily: "Oswald, sans-serif"
    fontSize: "clamp(32px, 6vw, 64px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.15em"
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

# Design System: The Cricket Fan — Composer

## 1. Overview

**Creative North Star: "The Press Box"**

Composer is a sportswriter's desk at the ground, late in the day, under stadium floodlights — not a SaaS admin panel. The energy is wire-service urgency: facts come in, copy goes out, fast, with a single decisive red the same way a press-room clock or an on-air tally light reads as "this matters, act now." Everything else stays quiet — near-black surfaces, tight neutral type — so that one red never has to compete for attention.

This system explicitly rejects the generic-admin-dashboard defaults composer shipped with at first build: plain HTML `<select>` and `<input>` elements, no visual hierarchy between the four content sources, no color distinguishing a wiki-record fact from a hand-written anecdote, flat gray-on-gray panels. It also deliberately does not reuse the main app's team-blue/team-gold pairing — composer is a working tool, not a matchday scoreboard, and needed its own accent identity rather than borrowing the fixture colors.

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

### Hierarchy
- **Display** (Oswald 700, `clamp(32px, 6vw, 64px)`, 1.1 line-height, -0.02em tracking, uppercase): Page-level section headers only ("DRAFTS & GENERATORS" / "EDITOR & PREVIEW"). Reuses the app's existing `.text-section-headline` class.
- **Title** (Space Grotesk 600, 18px, 1.3 line-height, -0.01em tracking): Card titles, draft preview headings, modal/panel titles.
- **Body** (Space Grotesk 400, 15px, 1.5 line-height): Draft text, editor textarea, paragraph copy. Cap measure at ~70ch inside the editor so long drafts don't stretch edge-to-edge.
- **Label** (Space Grotesk 600, 11px, 1.4 line-height, 0.15em tracking, uppercase): Meta rows, form labels, chip text, timestamps. Reuses the app's existing `.text-micro` class and color (`--muted`).

### Named Rules

**The Loud-Then-Quiet Rule.** A view gets exactly one Display-weight moment at its top; everything below drops straight to Title/Body/Label. No intermediate "Headline" tier — the contrast between the one loud line and everything quiet under it is the hierarchy.

## 4. Elevation

Flat by design — no box-shadows anywhere in the system. Depth is conveyed entirely through tonal layering (Void Black → Ash Surface → a 1px Border Line) and through the Wire Red accent, which reads as "raised" purely because it's the only saturated thing in the frame. This matches the main app's existing `.card-container` convention and keeps the stadium-floodlight character: crisp edges, no soft glow, no glass.

### Named Rules

**The Flat-By-Default Rule.** If an element needs to look "elevated," change its surface tone or add the 1px border — never add a shadow. The one exception is a deliberate, sparing glow behind the Wire Red primary action on hover (a soft `filter: drop-shadow` at low opacity), used only there, never on cards or panels.

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

## 6. Do's and Don'ts

### Do:
- **Do** use Wire Red (`#e8432e`) for exactly one primary action per view, and Oswald Display type for exactly one section header per view — the "one loud thing" discipline is the whole personality.
- **Do** code content sources and categories with Floodlight Cyan or neutral chips, never with a second saturated red.
- **Do** keep every card, panel, and input flat: Ash Surface + 1px Border Line, no box-shadow.
- **Do** surface real error/empty-state text (missing API key, empty content bank, unreachable API) instead of a generic failure message — per PRODUCT.md's "fail honestly" principle.

### Don't:
- **Don't** reintroduce team-blue (`#004ba0`) or team-gold (`#ffcb05`) as composer's accent — that pairing was explicitly rejected for this surface; it belongs to the matchday/fixture UI, not the composer desk.
- **Don't** use raw unstyled HTML `<select>`/`<input>` elements — the plain-admin-dashboard look this system replaces.
- **Don't** add box-shadows, glassmorphism, or soft glows to cards or panels — flat tonal layering only (the one sanctioned exception is the sparing Wire Red button hover glow).
- **Don't** use gradient text, side-stripe borders, or numbered section eyebrows (01 / 02 / 03) as default scaffolding — composer's feed isn't a numbered sequence.
- **Don't** let Floodlight Cyan appear on a button or trigger an action — it labels, it never acts.
