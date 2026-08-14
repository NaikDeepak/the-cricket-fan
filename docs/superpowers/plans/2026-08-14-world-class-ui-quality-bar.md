# World-Class UI Quality Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `DESIGN.md` with the missing interaction layer (states, motion contract, mobile, keyboard), fix the concrete execution bugs that layer exposes on `/stories` and `/composer`, and truth-up `CLAUDE.md` to describe the live stack.

**Architecture:** Doc-first (DESIGN.md gets the new rules), then fixes applied against those rules in the existing component tree — no new pages, no new routes, no backend changes. CSS additions live in `frontend/src/app/globals.css` alongside the existing `.ds-*` utility classes; components consume them by class name, same pattern already used throughout.

**Tech Stack:** Next.js 16 App Router, React 19.2 (`ViewTransition` from `react`), Tailwind v4 tokens via `globals.css` CSS variables, GSAP for imperative motion, Vitest + Testing Library for component tests.

**Spec:** `docs/superpowers/specs/2026-08-14-world-class-ui-quality-bar-design.md`

## Global Constraints

- Motion: only `var(--duration-fast)` (150ms) / `var(--duration-standard)` (250ms) + `var(--ease-out-quart)` — no ad-hoc duration/easing values.
- Every new/changed interactive element must be keyboard-reachable (native `<button>`/`<a>`/`<select>`, no click-only `<div>`).
- Every animation must no-op or reduce to an instant swap under `prefers-reduced-motion: reduce` (use `frontend/src/lib/motion.ts`'s `prefersReducedMotion()` for GSAP paths; CSS-only paths rely on the existing global `@media (prefers-reduced-motion: reduce)` block in `globals.css:37-44`, which already zeroes all animation/transition durations).
- No box-shadow, glassmorphism, or gradient additions — flat tonal layering only, per DESIGN.md's Elevation section.
- `backend/app/` stays in the tree, marked legacy — do not delete in this plan.
- No backend/API contract changes — frontend + docs only.

---

### Task 1: DESIGN.md — extend with States, Motion Contract, Mobile, Keyboard

**Files:**
- Modify: `DESIGN.md`

**Interfaces:**
- Produces: the four new named-rule sections later tasks implement against — "States" (Skeleton/Empty/Error), "Motion Contract" (token-only durations, animate/don't-animate list), "Mobile" (640px breakpoint, tag-row horizontal-scroll, 44px touch targets), "Keyboard" (Tab-reachability, Escape-closes-panel).

- [ ] **Step 1: Retitle and re-scope the doc header**

In `DESIGN.md`, change:
```
name: The Cricket Fan — Composer
description: A sportswriter's late-night desk for turning cricket facts into copy-ready, on-brand posts.
```
to:
```
name: The Cricket Fan — Press Box System
description: The shared design system for both the public Vault (/stories) and the internal Composer (/composer) — one token set, one interaction contract, two surfaces.
```

- [ ] **Step 2: Fix the stale "Overview" paragraph**

Replace the second paragraph of `## 1. Overview` (the one starting "This system explicitly rejects...") — the line "It also deliberately does not reuse the main app's team-blue/team-gold pairing... composer is a working tool, not a matchday scoreboard" is stale: the team-blue/gold matchday UI it refers to (`MatchHero`, `HeroStats`, the old fixture explorer) was deleted from the codebase. Replace with:
```
This system now covers both surfaces the app ships: the public Vault
(`/stories`) and the internal Composer (`/composer`). Both consume the
same tokens in `frontend/src/app/globals.css` — there is one design
system, not a composer-only skin. An earlier team-blue/team-gold
matchday identity existed for a fixture-explorer UI that has since
been removed from the codebase; nothing in the current app should
reintroduce it without a new brainstorming cycle.
```

- [ ] **Step 3: Add the "States" section**

Insert a new `## 6. States` section physically **between** the existing
`## 5. Components` section and the existing `## 6. Do's and Don'ts`
section (i.e. right before "## 6. Do's and Don'ts" in the file — Do's
and Don'ts is renumbered in Step 7 below, after all four new sections
are in place):

```markdown
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
```

- [ ] **Step 4: Add the "Motion Contract" section**

Insert immediately after the new States section (still before the
existing Do's and Don'ts section):

```markdown
## 7. Motion Contract

**Tokens only.** Every transition/animation duration is
`var(--duration-fast)` (150ms) or `var(--duration-standard)` (250ms);
every easing is `var(--ease-out-quart)`. No inline `300ms`, no
`ease-in-out`, no bespoke curve — if a moment needs a duration not on
this list, that's a signal to use the existing token closest to it, not
to add a new one.

**Animates:**
- Vault grid mount/filter-change stagger (existing, `stories/page.tsx`).
- On-this-day rail entrance on real data arrival (existing).
- A short cross-fade between the Vault and a story detail page —
  "same collection, different item," not a directional navigation.

**Does not animate:**
- Hover states on secondary/non-primary elements — motion marks the one
  primary action per view, mirroring the One Red Rule. A card border
  color change on hover (already flat, no motion) stays as-is; it does
  not gain a scale/shadow/glow treatment.

**Reduced motion.** Every animation degrades to an instant state swap
under `prefers-reduced-motion: reduce`. GSAP-driven motion checks
`prefersReducedMotion()` from `frontend/src/lib/motion.ts` before
running; CSS-only transitions are covered by the global
`@media (prefers-reduced-motion: reduce)` block that already zeroes all
animation/transition durations (`globals.css`).

### Named Rule

**The One-Motion-Moment Rule.** A route or state change gets exactly
one motion moment — the stagger, the reveal, or the cross-fade, never
several competing at once. This is the Loud-Then-Quiet rule applied to
time instead of type scale.
```

- [ ] **Step 5: Add the "Mobile" section**

Insert immediately after Motion Contract (still before Do's and Don'ts):

```markdown
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
```

- [ ] **Step 6: Add the "Keyboard" section**

Insert immediately after Mobile — this is the last of the four new
sections, still physically positioned before the existing Do's and
Don'ts section:

```markdown
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
```

- [ ] **Step 7: Renumber Do's and Don'ts**

Change the existing `## 6. Do's and Don'ts` heading to `## 10. Do's and
Don'ts` — after Steps 3-6, the physical file order is: 5. Components,
6. States, 7. Motion Contract, 8. Mobile, 9. Keyboard, 10. Do's and
Don'ts. This step's renumbering must be the last edit in this task —
doing it before Steps 3-6 would leave the heading text and physical
position mismatched.

- [ ] **Step 8: Commit**

```bash
git add DESIGN.md
git commit -m "docs(design): add States, Motion Contract, Mobile, Keyboard sections

Closes the gap between DESIGN.md's static visual language and what
separates a premium app from a competent dark theme. Re-scopes the
doc from composer-only to app-wide since both surfaces share one
token system."
```

---

### Task 2: CSS foundation for the fixes

**Files:**
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `.ds-select` (styled native select, consumed by Task 3), `.ds-tag-scroll` + `.ds-tag-scroll::after` (mobile horizontal-scroll tag row, consumed by Task 4), `.ds-quote` (pull-quote treatment, consumed by Task 5), `.ds-fade-enter`/`.ds-fade-exit` keyframes for the View Transition cross-fade (consumed by Task 6).

- [ ] **Step 1: Add `.ds-select` — styled native select**

Append to `globals.css` after the existing `.ds-input` block (after line 166):

```css
.ds-select {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px 32px 10px 14px;
  font-family: "Space Grotesk", sans-serif;
  font-size: 14px;
  appearance: none;
  -webkit-appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 3px),
    calc(100% - 13px) calc(50% - 3px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  transition: border-color var(--duration-fast) var(--ease-out-quart);
  cursor: pointer;
}
.ds-select:focus-visible {
  outline: 2px solid var(--wire-red);
  outline-offset: 2px;
  border-color: var(--wire-red);
}
.ds-select:disabled {
  color: var(--muted);
  cursor: not-allowed;
}
```

This is a CSS-only triangle chevron (two gradients forming a `v`) so no
icon asset/font is needed — matches the system's existing no-icon-library
footprint in this file.

- [ ] **Step 2: Add `.ds-tag-scroll` — mobile horizontal-scroll tag row**

Append:

```css
@media (max-width: 640px) {
  .ds-tag-scroll {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    position: relative;
    mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
  }
  .ds-tag-scroll::-webkit-scrollbar {
    display: none;
  }
  .ds-tag-scroll > * {
    flex: 0 0 auto;
  }
}
```

Above 640px, `.ds-tag-scroll` has no rules — the element keeps whatever
wrap/flex layout its own inline styles already give it, so this class is
additive-only and safe to apply unconditionally in Task 4.

- [ ] **Step 3: Add `.ds-quote` — pull-quote treatment for story beats**

Append:

```css
.ds-quote {
  position: relative;
  padding-left: var(--space-lg);
  border-left: 2px solid var(--wire-red);
}
.ds-quote > p {
  font-family: "Space Grotesk", sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.01em;
  color: var(--fg);
  margin: 0;
}
```

A left rule in Wire Red (the system's one accent, used here as the
sole "this is quoted" signal — no shadow, no background tint, no
literal quote-mark glyph) plus Title-weight type instead of Body-weight,
consistent with DESIGN.md's Typography hierarchy (`Title`: 18px/600).

- [ ] **Step 4: Add the cross-fade keyframes for Task 6**

Append:

```css
::view-transition-old(stories-content) {
  animation: var(--duration-standard) var(--ease-out-quart) both ds-fade-out;
}
::view-transition-new(stories-content) {
  animation: var(--duration-standard) var(--ease-out-quart) both ds-fade-in;
}
@keyframes ds-fade-out {
  to { opacity: 0; }
}
@keyframes ds-fade-in {
  from { opacity: 0; }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(design-system): add select/tag-scroll/quote/cross-fade CSS foundation

Adds the CSS building blocks the Motion Contract, Mobile, and States
sections of DESIGN.md require. No component wired up yet — that's
Tasks 3-6."
```

---

### Task 3: Fix the raw `<select>` in composer's SourceBar

**Files:**
- Modify: `frontend/src/components/composer/SourceBar.tsx:124-136`
- Test: `frontend/src/components/composer/__tests__/SourceBar.test.tsx`

**Interfaces:**
- Consumes: `.ds-select` from Task 2.
- Produces: no interface change — same `kind`/`setKind` state, same `composerApi.generateBot(kind)` call. Purely a className swap plus removal of the inline `style` override.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/composer/__tests__/SourceBar.test.tsx` (inside the existing `describe("SourceBar", ...)` block):

```tsx
  it("bot-kind select uses the styled ds-select class, not raw ds-input", () => {
    render(<SourceBar onCreated={vi.fn()} />);
    const select = screen.getByLabelText("bot kind");
    expect(select).toHaveClass("ds-select");
    expect(select).not.toHaveClass("ds-input");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SourceBar.test.tsx`
Expected: FAIL — `expect(element).toHaveClass("ds-select")` fails because
the element currently has class `ds-input`.

- [ ] **Step 3: Fix the component**

In `frontend/src/components/composer/SourceBar.tsx`, replace lines 124-130:

```tsx
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="bot kind"
            className="ds-input"
            style={{ padding: "10px 12px" }}
          >
```

with:

```tsx
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="bot kind"
            className="ds-select"
          >
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SourceBar.test.tsx`
Expected: PASS — all SourceBar tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/composer/SourceBar.tsx frontend/src/components/composer/__tests__/SourceBar.test.tsx
git commit -m "fix(composer): style the bot-kind select, drop raw native chrome

DESIGN.md's own Don't rule #2 (no raw unstyled <select>) was broken
in shipped code — the dropdown rendered with default OS chrome
instead of the Ash Surface / Border Line / Wire Red-focus treatment
every other input already has."
```

---

### Task 4: Vault — low-count placeholder tile + mobile tag-scroll

**Files:**
- Modify: `frontend/src/app/stories/page.tsx`
- Test: create `frontend/src/app/stories/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `.ds-tag-scroll` from Task 2; `filteredStories`, `allTags`, `activeTag`, `selectTag` already defined in `Vault()`.
- Produces: no exported interface change — internal render output only.

- [ ] **Step 1: Write the failing test for the placeholder tile**

Create `frontend/src/app/stories/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StoriesPage from "../page";
import { storiesApi } from "@/lib/storiesApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const story = (key: string, title: string) => ({
  content_key: key,
  category: "anecdote",
  format: "odi",
  segments: ["x"],
  source: "wiki",
  title,
  summary: "s",
  source_type: "wikipedia",
  source_ref: "",
  teams: [],
  players: [],
  venue: null,
  year: 2020,
  match_format: null,
  tags: [],
  is_published: true,
  event_month_day: null,
});

beforeEach(() => {
  vi.spyOn(storiesApi, "getWire").mockResolvedValue([]);
});

describe("Vault low-count placeholder", () => {
  it("shows a 'more stories coming' tile when fewer than 6 stories are loaded", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue([
      story("a", "Story A"),
      story("b", "Story B"),
    ]);
    render(<StoriesPage />);
    expect(await screen.findByText(/MORE STORIES COMING/i)).toBeInTheDocument();
  });

  it("does not show the placeholder tile at 6 or more stories", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => story(`k${i}`, `Story ${i}`))
    );
    render(<StoriesPage />);
    await screen.findByText("Story 0");
    expect(screen.queryByText(/MORE STORIES COMING/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stories/__tests__/page.test.tsx`
Expected: FAIL — "MORE STORIES COMING" not found (first case).

- [ ] **Step 3: Implement the placeholder tile**

In `frontend/src/app/stories/page.tsx`, replace the grid render block
(lines 268-287) with:

```tsx
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {filteredStories.map((story) => (
            <Link
              key={story.content_key}
              href={`/stories/${encodeURIComponent(story.content_key)}`}
              style={{ textDecoration: "none" }}
            >
              <StoryCard story={story} />
            </Link>
          ))}
          {filteredStories.length < 6 && (
            <div
              className="card-container"
              style={{
                padding: "var(--space-lg)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: 148,
              }}
            >
              <p
                className="text-tool-headline"
                style={{ margin: 0, fontSize: 22, color: "var(--muted)" }}
              >
                MORE STORIES COMING
              </p>
              <p style={{ margin: "var(--space-sm) 0 0 0", fontSize: 13, color: "var(--muted)" }}>
                The vault grows with every match — check back soon.
              </p>
            </div>
          )}
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stories/__tests__/page.test.tsx`
Expected: PASS — both cases green.

- [ ] **Step 5: Write the failing test for mobile tag-scroll class**

Add to the same test file:

```tsx
  it("applies ds-tag-scroll to the tag row for mobile horizontal scroll", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue([
      { ...story("a", "Story A"), tags: ["rivalry", "iconic"] },
    ]);
    render(<StoriesPage />);
    await screen.findByText("Story A");
    expect(screen.getByText("All Stories").parentElement).toHaveClass("ds-tag-scroll");
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- stories/__tests__/page.test.tsx`
Expected: FAIL — parent element lacks `ds-tag-scroll` class.

- [ ] **Step 7: Apply the class**

In `frontend/src/app/stories/page.tsx`, the tag row container (line 203):

```tsx
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
```

becomes:

```tsx
          <div className="ds-tag-scroll" style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
```

(Per Task 2 Step 2, `.ds-tag-scroll` only applies rules under the
640px media query, so the existing `flexWrap: "wrap"` inline style keeps
governing layout above that width — additive, not conflicting.)

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- stories/__tests__/page.test.tsx`
Expected: PASS — all four cases green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/stories/page.tsx frontend/src/app/stories/__tests__/page.test.tsx
git commit -m "feat(vault): low-count placeholder tile + mobile tag-scroll

Closes the 'empty database dump' read at low story counts (Loud-
Then-Quiet placeholder instead of faking density) and stops the
17-tag wall from wrapping into a multi-line block on mobile
(Scroll-Not-Wrap rule)."
```

---

### Task 5: Story detail — pull-quote treatment for beats

**Files:**
- Modify: `frontend/src/components/stories/StoryBeats.tsx`
- Test: `frontend/src/components/stories/__tests__/StoryBeats.test.tsx`

**Interfaces:**
- Consumes: `.ds-quote` from Task 2.
- Produces: same `{ segments: string[] }` prop contract — no change for `StoryDetailPage`, which already imports and renders `<StoryBeats segments={story.segments} />` unmodified.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/stories/__tests__/StoryBeats.test.tsx`:

```tsx
  it("renders each beat with the ds-quote pull-quote treatment", () => {
    render(<StoryBeats segments={["first beat"]} />);
    const beat = document.querySelector("[data-beat]");
    expect(beat).toHaveClass("ds-quote");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- StoryBeats.test.tsx`
Expected: FAIL — `[data-beat]` element lacks `ds-quote` class (currently
`card-container`).

- [ ] **Step 3: Implement**

Replace `frontend/src/components/stories/StoryBeats.tsx` in full:

```tsx
export default function StoryBeats({ segments }: { segments: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          data-beat
          className="ds-quote"
          style={{ position: "relative" }}
        >
          {segments.length > 1 && (
            <span
              className="text-micro"
              style={{ position: "absolute", top: 0, right: 0, margin: 0 }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p>{seg}</p>
        </div>
      ))}
    </div>
  );
}
```

(The old `card-container` box — Ash Surface fill, border, uniform
Body-weight text — is dropped in favor of `.ds-quote`'s left-rule +
Title-weight treatment. The multi-segment counter keeps its existing
position/style, just re-anchored to the now-borderless container.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- StoryBeats.test.tsx`
Expected: PASS — all StoryBeats tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/stories/StoryBeats.tsx frontend/src/components/stories/__tests__/StoryBeats.test.tsx
git commit -m "fix(stories): pull-quote treatment for story beats, not a raw text dump

Source text (often a literal tweet, emoji included) was rendering in
a flat gray card-container box with no typographic distinction from
surrounding UI chrome. ds-quote (Wire Red left rule + Title-weight
type) marks it as quoted content per DESIGN.md's new Typography-
adjacent quoting convention."
```

---

### Task 6: Vault↔detail cross-fade via React ViewTransition

**Files:**
- Modify: `frontend/next.config.ts`
- Modify: `frontend/src/app/stories/page.tsx`
- Modify: `frontend/src/app/stories/[contentKey]/page.tsx`

**Interfaces:**
- Consumes: `::view-transition-old(stories-content)` / `::view-transition-new(stories-content)` CSS from Task 2 Step 4; React's `ViewTransition` export (available in React 19.2, already installed).
- Produces: no prop/interface change to either page component — purely wraps existing top-level return values.

- [ ] **Step 1: Enable view transitions in Next config**

In `frontend/next.config.ts`, change:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
};
```

to:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
};
```

- [ ] **Step 2: Wrap the Vault's top-level container**

In `frontend/src/app/stories/page.tsx`, add the import:

```tsx
import { ViewTransition } from "react";
```

Wrap the `Vault()` function's returned JSX (the outer `<div style={{ maxWidth: 1100, ... }}>` at line 153) in:

```tsx
  return (
    <ViewTransition name="stories-content" default="none">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-lg)" }}>
        {/* ...unchanged existing content... */}
      </div>
    </ViewTransition>
  );
```

- [ ] **Step 3: Wrap the story detail page's top-level container**

In `frontend/src/app/stories/[contentKey]/page.tsx`, add the same import:

```tsx
import { ViewTransition } from "react";
```

Wrap the main return's outer `<div style={containerStyle}>` (line 136,
the one containing the "← The Vault" link through the prev/next nav —
**not** the `notFound` or loading-skeleton early returns, which stay
untransitioned since they're not "the same collection, different item"
case the cross-fade communicates) in the same `ViewTransition`:

```tsx
  return (
    <ViewTransition name="stories-content" default="none">
      <div style={containerStyle}>
        {/* ...unchanged existing content... */}
      </div>
    </ViewTransition>
  );
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: PASS — `ViewTransition` renders its children transparently in
jsdom (no browser View Transition API support in the test environment,
so it behaves as a pass-through wrapper); no existing assertion targets
the removed/wrapped outer `<div>` by anything other than its content, so
nothing breaks.

- [ ] **Step 5: Manual verification (no automated test for the animation itself — jsdom cannot execute the browser View Transition API)**

Start `npm run dev`, open `/stories` in an actual browser (Chrome/Edge —
the doc notes Safari support varies), click into a story, click "← The
Vault". Confirm a short opacity cross-fade plays instead of the previous
hard cut, and that it disappears entirely with the OS "reduce motion"
setting on.

- [ ] **Step 6: Commit**

```bash
git add frontend/next.config.ts frontend/src/app/stories/page.tsx frontend/src/app/stories/[contentKey]/page.tsx
git commit -m "feat(stories): cross-fade between vault and detail via React ViewTransition

'Same collection, different item' signal per the Motion Contract's
One-Motion-Moment Rule — was a hard navigation cut. Uses Next 16's
native experimental.viewTransition + React 19.2's ViewTransition
component rather than a hand-rolled GSAP route transition."
```

---

### Task 7: CLAUDE.md truth-up

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Rewrite the ARCHITECTURE section**

Replace the `## ARCHITECTURE` section's tree and the "Data flow" /
"Key tables" / "Story generation" / "Prediction engine" paragraphs
below it with:

```markdown
## ARCHITECTURE

```
the-cricket-fan/
├── bot/                  # ELO prediction engine, cricsheet ingest, X poster
│   ├── predict.py        # ELO-based win-probability scoring
│   ├── ingest.py          # cricsheet.py — match-data ingest
│   ├── db.py              # SQLite/Postgres schema, shared with composer/
│   ├── news_fetcher.py    # match-recap headline fetch (Google News RSS)
│   ├── trivia_standalone.py  # trivia question logic — NOT YET wired to
│   │                          # composer or the public surface (tracked
│   │                          # below under "Next up")
│   └── scripts/seed_content_bank.py  # hand-authored content bank seed
├── composer/             # FastAPI content tool — reuses bot/db.py's schema
│   ├── app.py
│   ├── routers/          # stories, generate, predictions, posts,
│   │                      # analytics, content_bank, drafts
│   └── gemini.py          # Gemini SDK call site (story/copy generation)
├── frontend/
│   └── src/app/
│       ├── stories/       # public Vault — /stories, /stories/[contentKey]
│       └── composer/      # internal tool UI — /composer, /composer/{posts,predictions,analytics}
└── backend/app/          # LEGACY — not on the live path. FastAPI app with
                            # its own story/prediction/trivia services from
                            # the original pre-pivot architecture. Superseded
                            # by bot/ + composer/. Kept in the tree, not
                            # deleted, pending confirmation nothing in it
                            # gets reused once the trivia/prediction next-up
                            # cycles land. Do not build new features here.
```

**Data flow:** Cricsheet JSON → `bot/cricsheet.py` / `bot/ingest.py` →
shared DB (`bot/db.py` schema, SQLite locally via `COMPOSER_DATABASE_URL`,
Postgres in prod) → `composer/routers/` → JSON API → Next.js
`frontend/src/app/{stories,composer}`.

**Story generation:** `composer/gemini.py` calls the Gemini API for
draft copy (not Anthropic). Composer caches results as drafts in the DB
rather than regenerating on every request.

**Prediction engine:** `bot/predict.py` — ELO-based win-probability
scoring, no ML. `composer/routers/predictions.py` exposes it to the
Composer UI; a prediction can be generated and exported as a card PNG,
but nothing in `/stories` displays it yet (tracked below under "Next
up").
```

- [ ] **Step 2: Rewrite the API ENDPOINTS table**

Replace the `## API ENDPOINTS` table (the 5 legacy `backend/app/`
endpoints) with:

```markdown
## API ENDPOINTS (composer, port 8000)

| Endpoint | Description |
|---|---|
| `GET /stories` | List published vault stories (search/category/team/player/venue/year filters) |
| `GET /stories/{content_key}` | Single story detail |
| `GET /stories/contextual` | Stories relevant to a given fixture/teams/venue |
| `GET /stories/wire` | Recent posted-draft archive for the wire strip |
| `POST /generate` | Bot-kind draft generation (prediction/trivia/h2h/venue/record) |
| `POST /generate/llm` | Freeform Gemini-prompted draft |
| `POST /generate/recap` | Match-recap draft from Google News RSS |
| `GET/POST /predictions` | ELO prediction generation + retrieval |
| `GET/POST /posts` | Draft → posted-card lifecycle |
| `GET /analytics` | Posting analytics |
| `GET/POST /content-bank` | Hand-authored content bank browse + publish toggle |
| `GET/POST /drafts` | Draft CRUD |

`backend/app/`'s 5 endpoints (`/match-story/today`,
`/stats/player-vs-player`, `/stats/venue`, `/trivia/today`,
`/prediction/today`) are legacy — not mounted on the live composer app,
not called by the frontend. See ARCHITECTURE's legacy note.
```

- [ ] **Step 3: Rewrite "Planned frontend components"**

Replace the `### Planned frontend components (not yet built)` section
with:

```markdown
### Frontend components (live)

**Vault (`/stories`):** `StoryCard`, `StoryCardImg` (share-card export),
`OnThisDayRail`, `WireStrip`, `StoryBeats` (pull-quote story-text
treatment).

**Composer (`/composer`):** `Editor`, `Feed`, `SourceBar`, `CardPreview`,
`TeamBadge`, card-type renderers (`PredictionCardImg`, `RecordCardImg`,
`TriviaCardImg` — note: `TriviaCardImg` exists as a component but has
no composer router or generation path feeding it yet, see "Next up").

### Next up (scoped, not yet designed — each gets its own brainstorming
cycle per `docs/superpowers/specs/2026-08-14-world-class-ui-quality-bar-design.md`'s
decomposition)

1. **Trivia end-to-end.** `bot/trivia_standalone.py` has the question
   logic; no composer router wires it to draft generation, and no
   public `/stories` surface displays a trivia card. Full-stack gap.
2. **Prediction on the public surface.** Composer can generate and
   export a `PredictionCardImg`, but `/stories` never displays a
   prediction — it only leaves the app as a downloaded PNG for manual
   posting.
```

- [ ] **Step 4: Add a "Design" section**

Insert a new `## DESIGN` section after `## API ENDPOINTS` (before
`## COMMANDS`):

```markdown
## DESIGN

The authority for all visual/interaction work on both surfaces is
`DESIGN.md` (repo root) — per the house `design-standards` skill's own
override contract, a project's design system wins over the generic
house defaults where the two would otherwise conflict.

Summary (see `DESIGN.md` for the full rules): near-black flat surfaces,
one accent color (Wire Red) for primary actions only, Floodlight Cyan
for category/source labeling only, Oswald for the one Display-weight
headline per view + Space Grotesk for everything else (One Red Rule,
Loud-Then-Quiet Rule). As of 2026-08-14 this also covers: skeleton/
empty/error states (Honest-State Rule), a token-only motion contract
(One-Motion-Moment Rule), a 640px mobile breakpoint with horizontal-
scroll tag rows (Scroll-Not-Wrap Rule), and full keyboard reachability
(No-Silent-Element Rule).
```

- [ ] **Step 5: Update the CODING STANDARDS Anthropic reference**

In `## CODING STANDARDS` → `### Backend (Python)`, change:

```
- Do not call the Anthropic API on every request — cache story/trivia results in DB for the day
```

to:

```
- Do not call the Gemini API on every request — cache story/trivia results in DB for the day (composer's live LLM path is Gemini via `composer/gemini.py`, not Anthropic)
```

- [ ] **Step 6: Add the SESSION LOG entry**

Append a row to the `## SESSION LOG` table:

```markdown
| 2026-08-14 | World-class UI quality bar | DESIGN.md extended with States/Motion Contract/Mobile/Keyboard sections (Approach B: extend then execute). Fixed raw `<select>`, vault dead-space, story-detail raw-text-dump. CLAUDE.md truth-up: bot/+composer/ presented as live stack, backend/app/ marked legacy (not deleted). Trivia end-to-end and prediction-on-vault logged as separate next-up cycles. | Brainstorm trivia end-to-end cycle, then prediction-on-vault cycle |
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): truth-up — bot/+composer/ is the live stack, backend/app/ legacy

ARCHITECTURE tree, API ENDPOINTS table, and 'Planned frontend
components' all still described the pre-pivot backend/app/ stack and
components deleted in the composer-press-box-redesign branch's diff.
Adds a Design section pointing to DESIGN.md as authority, and a
'Next up' list naming trivia end-to-end + prediction-on-vault as
scoped, not-yet-designed follow-on cycles."
```

---

## Self-review notes

- **Spec coverage:** DESIGN.md States/Motion/Mobile/Keyboard → Task 1.
  Concrete fix #1 (select) → Task 3. Concrete fix #2 (vault dead-space +
  tag row) → Task 4. Concrete fix #3 (story-detail pull-quote) → Task 5.
  Concrete fix #4 (route cross-fade) → Task 6. CLAUDE.md truth-up (all 5
  bullets from the spec) → Task 7. All spec sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code or
  literal doc text to write, not a description of intent.
- **Type consistency:** `Story` type used in Task 4's test fixture matches
  the exact shape defined in `frontend/src/lib/storiesApi.ts:3-21` (all
  16 fields present). `StoryBeats`'s `{ segments: string[] }` prop is
  unchanged from Task 5 through `StoryDetailPage`'s existing call site.
  `ViewTransition` import path (`"react"`) is consistent across Task 6's
  two file edits.
