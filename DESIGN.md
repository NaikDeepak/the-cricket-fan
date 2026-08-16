---
name: The Cricket Fan — Sports Editorial & Press Box System
description: The shared design system for the public Vault (/stories, /predictions) and Composer studio (/composer) — one cohesive token set, editorial serif typography, tactical accents, and spatial glass materials.
colors:
  bg: "#f8fafc"
  surface: "#ffffff"
  surface-dark: "#07120e"
  fg: "#0f172a"
  fg-muted: "#64748b"
  border: "#e2e8f0"
  border-dark: "rgba(255, 255, 255, 0.12)"
  electric-gold: "#facc15"
  electric-gold-hover: "#eab308"
  meadow-emerald: "#22c55e"
  deep-stadium: "#07120e"
  acrylic-bg: "rgba(11, 20, 16, 0.78)"
  acrylic-border: "rgba(255, 255, 255, 0.14)"
  success: "#16a34a"
  success-tint: "#f0fdf4"
  warning: "#d97706"
  warning-tint: "#fffbeb"
  error: "#dc2626"
  error-tint: "#fef2f2"
typography:
  scale:
    xs: "11px"
    sm: "13px"
    base: "15px"
    lg: "18px"
    xl: "24px"
    2xl: "32px"
    3xl: "clamp(36px, 5vw, 56px)"
    4xl: "clamp(52px, 8vw, 84px)"
  serif:
    fontFamily: "Fraunces, Georgia, serif"
  sans:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
---

# Design System: The Cricket Fan — Sports Editorial & Press Box System

## 1. Overview

**Creative North Star: "The Modern Sports Editorial"**

The Cricket Fan blends the tactile heritage of premium longform sports journalism (the morning broadsheet, pavilion memoirs, timeless records) with high-precision telemetry (live win probabilities, predictive backtest simulations, player head-to-heads).

The UI pairs crisp, bright editorial canvases with Apple-grade dark spatial glassmorphism and bento surfaces. It feels like an exclusive press box desk overlooking a sunlit ground by day and illuminated under stadium floodlights by night.

**Key Characteristics:**
- **Layered Spatial Canvas**: Clean white and light slate editorial surfaces (`#f8fafc` / `#ffffff`) contrasted with tactical dark stadium acrylics (`rgba(11, 20, 16, 0.78)` / `#07120e`).
- **Rich Typographic Pairing**: **Fraunces** brings warmth, literary prestige, and editorial punch to headlines and quotes; **Plus Jakarta Sans** powers crisp, legible UI elements, cards, and metadata; **JetBrains Mono** delivers precise tabular statistics and telemetry readouts.
- **Tactical Accents**: Electric Gold (`#facc15`) and Meadow Emerald (`#22c55e`) highlight active telemetry, live radars, and performance gains.
- **Honest States & Transparency**: Outcomes and system states are never hidden or flattened into a binary right/wrong. Hits, misses, pending fixtures, and voided matches receive distinct, intentional visual treatments.

---

## 2. Color Palette & Token System

### Base Surfaces & Neutrals
- **Canvas Base** (`--bg`: `#f8fafc`): The clean, open background for public editorial reading.
- **Surface Card** (`--surface`: `#ffffff`): Primary card background, elevated with subtle borders and soft ambient diffusion.
- **Deep Stadium** (`--surface-dark` / `--deep-stadium`: `#07120e`): Night-session stadium backdrop used in spatial hero cards, dark bento panels, and terminal cards.
- **Text Primary** (`--fg`: `#0f172a`): High-contrast slate-900 for effortless reading.
- **Text Muted** (`--fg-muted`: `#64748b`): Secondary labels, timestamps, venue details, and category eyebrows.
- **Border Default** (`--border`: `#e2e8f0`): 1px structural hairline on light cards and inputs.
- **Border Dark** (`--border-dark`: `rgba(255, 255, 255, 0.12)`): Hairline border on dark spatial cards.

### Tactical Accents
- **Electric Gold** (`--electric-gold`: `#facc15`, hover `#eab308`): Telemetry accents, active simulation indicators, radar pulses.
- **Meadow Emerald** (`--meadow-emerald`: `#22c55e`): Outperformance metrics, positive form indicators, and accuracy callouts.
- **Acrylic Dark Glass** (`--acrylic-bg`: `rgba(11, 20, 16, 0.78)`): Blurred frosted panel surface for stadium cards.

### Status & Outcome Tints (Honest-State Palette)
- **Success / Hit** (`--success`: `#16a34a`, `--success-tint`: `#f0fdf4`): Correct predictions, high-confidence signals.
- **Warning / Neutral Miss** (`--warning`: `#d97706`, `--warning-tint`: `#fffbeb`): Incorrect predictions and pending fixtures. A missed model pick is styled with warning/amber tones rather than abrasive error reds, acknowledging that probabilistic predictions have natural variance.
- **Error / System Failure** (`--error`: `#dc2626`, `--error-tint`: `#fef2f2`): Reserved strictly for genuine operational errors, failed network requests, or missing configurations.
- **Void / Inactive** (`#f0f0f2` background with `--fg-muted` text): Abandoned matches, no-results, or excluded records.

---

## 3. Typography

```
Serif (Display & Narrative):    Fraunces (400, 600, 700, 800 + italic)
Sans-Serif (UI & Navigation):   Plus Jakarta Sans (400, 500, 600, 700, 800)
Monospace (Numbers & Telemetry): JetBrains Mono (400, 500, 600, 700)
```

### Modular Scale (`--text-*`)
- `--text-4xl` (`clamp(52px, 8vw, 84px)`): Watermark numerals and background years (low opacity 4–6%).
- `--text-3xl` (`clamp(36px, 5vw, 56px)`): Primary editorial hero headlines (`.text-hero-headline`).
- `--text-2xl` (`32px`): Section titles, modal headers, major metric numbers.
- `--text-xl` (`24px`): Featured card headlines, panel titles.
- `--text-lg` (`18px`): Card titles, pull-quote text (`.ds-quote-editorial`).
- `--text-base` (`15px`): Standard body copy (`.text-body-default`), story paragraphs.
- `--text-sm` (`13px`): Captions, metadata lines, filter tabs.
- `--text-xs` (`11px`): Micro labels (`.text-micro`), status pills, source badges.

### Core Typographic Classes
- `.text-editorial-serif`: Applies Fraunces for literary weight and storytelling.
- `.text-ledger-mono`: Applies JetBrains Mono with tabular numbers (`font-feature-settings: "tnum" on, "lnum" on`).
- `.text-micro`: Uppercase, tracked (0.08em), bold metadata eyebrow.
- `.text-hero-headline`: Bold Fraunces headline with tight negative letter spacing (-0.02em).

---

## 4. Materials, Elevation & Spatial Depth

1. **Editorial Bento Cards (`.ds-bento-card`, `.ds-editorial-card`)**:
   - Clean white background (`#ffffff`), 16px–20px radius, 1px border (`#e2e8f0`).
   - Soft multi-stop shadow (`0 4px 20px -2px rgba(15, 23, 42, 0.05)`).
   - Hover transition: `translateY(-3px)`, border shifts to `#cbd5e1`, shadow deepens.

2. **Apple Glass & Translucent Studio Panels (`.ds-glass-card`, `.card-container`)**:
   - Light translucent glass: `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(20px) saturate(180%)`.
   - Dark acrylic glass (`.ds-acrylic-card`, `.ds-spatial-card-dark`): `rgba(11, 20, 16, 0.78)` with `backdrop-filter: blur(28px)` and glowing white/emerald 1px border.

3. **Watermark Accents (`.text-watermark`)**:
   - Subtle background numerals/years anchoring the historic or predictive context without obstructing readability.

---

## 5. Component Contracts

### Buttons & Interactive Controls
- **Pill Buttons (`.ds-btn-pill`)**:
  - `.ds-btn-pill-dark`: Obsidian black fill (`#000000`), white text, subtle hover lift and scale (`1.02`).
  - `.ds-btn-pill-light`: Translucent glass button with backdrop blur.
  - `.ds-btn-pill-accent`: Accent blue fill for primary studio exports.
- **Filter Tabs (`.ds-filter-tab`)**:
  - Fully rounded pills (`border-radius: 999px`), 13px font weight 600.
  - Inactive: `#ffffff` background, `#475569` text, `#e2e8f0` border.
  - Active (`.ds-filter-tab--active`): Slate-900 background (`#0f172a`), white text, elevated shadow.

### Status Pills (`.status-pill`)
Used across Track Record, Backtest, and Match Cards to display honest states:
- `.status-pill--correct`: Emerald tint background (`#f0fdf4`), green text (`#1c8a3f`).
- `.status-pill--incorrect`: Amber tint background (`#fffbeb`), warning text (`#d97706`).
- `.status-pill--pending`: Amber tint background (`#fffbeb`), pending text (`#b25f00`).
- `.status-pill--void`: Neutral background (`#f0f0f2`), muted text (`#64748b`).

### Match Cards (`.match-card`, `.match-grid`)
- Grid layout with auto-fit (`minmax(310px, 1fr)`).
- Visual header with League badge and status pill.
- Team slot with team crest (or high-contrast initials fallback) and 2-line clamped team name.
- Split probability track (`.prob-track` with `.prob-fill` transitioning via Apple ease curve).

### Form Inputs (`.ds-input`, `.ds-select`)
- Clean rounded containers (`border-radius: 14px`), subtle inset shadow.
- High-contrast focus state: `border-color: #0071e3`, ring `0 0 0 3px rgba(0, 113, 227, 0.15)`.

---

## 6. System Rules

1. **The Honest-State Rule**:
   - Never conceal or distort unfavorable outcomes. Predictions that miss the mark are displayed with the same structural prominence as winning predictions.
   - Use distinct statuses: `pending`, `correct`, `incorrect`, and `void`.
   - Never style an incorrect probabilistic prediction with an aggressive system error color (`--error`); use the neutral/warning tint (`--warning-tint`).

2. **The Scroll-Not-Wrap Rule**:
   - On mobile screens (< 640px), filter chips and league selectors scroll horizontally (`.ds-tag-scroll`) with an edge mask fade instead of wrapping into cluttered multi-line stacks.

3. **The No-Silent-Element Rule**:
   - Every interactive control must be a native accessible element (`<button>`, `<a>`, `<select>`, `<input>`) or provide full keyboard `tabIndex`, visible `:focus-visible` outlines, and `aria-*` roles.

4. **The One-Motion-Moment Rule**:
   - Limit animation to a single purposeful transition per view (e.g. entry stagger, radar pulse, or probability track fill). Secondary text and structural scaffolding remain rock-solid.

5. **Reduced Motion**:
   - Respect `prefers-reduced-motion: reduce` by setting animation and transition durations to instantaneous snap (`0.01ms`).

---

## 7. Do's and Don'ts

### Do:
- **Do** use Fraunces for hero display titles, pull quotes, and storytelling headlines.
- **Do** use Plus Jakarta Sans for UI labels, interactive buttons, form controls, and body copy.
- **Do** use JetBrains Mono for win probabilities, match scores, Elo ratings, and tabular numerals.
- **Do** provide clear empty and error states with transparent diagnostic copy.
- **Do** test team crests with proper dark/light theme background contrast.

### Don't:
- **Don't** use raw unstyled browser inputs or selects.
- **Don't** treat incorrect predictions as fatal system errors (`--error`).
- **Don't** wrap horizontal filter rows into multi-line blocks on mobile devices.
- **Don't** reintroduce obsolete stark red/black press-box tokens that do not exist in `globals.css`.
