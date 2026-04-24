# The Cricket Fan — MVP Design Spec

**Date:** 2026-04-24  
**Status:** Awaiting implementation  
**Scope:** MVP only — one match story, one battle, one trivia, one prediction, one share card

---

## 1. Product Vision

A fan-first IPL web app that people open during matches the way they check WhatsApp — not to look up stats, but to feel something. The design goal is emotion over information, story over dashboard, specificity over generality.

**Not this:** A cricket stats site with animations.  
**This:** A daily match story that makes someone screenshot and send it to their group.

---

## 2. MVP Scope (Hard Boundary)

### Build
- Hero section — today's match with real data, shock stat, narrative headline
- One Battle Card — player vs player head-to-head (Cricsheet-derived)
- One Trivia — tap to reveal, streak counter
- One Prediction — three evidence items → THEREFORE → probability
- One Share Card — Shock Stat only, 9:16 and 1:1, `navigator.share`

### Defer (explicitly not in MVP)
- Multiple battle cards / battle pagination
- Full navigation / routing
- Complex page transitions
- Trivia card, Battle card, Prediction card share variants
- Auth, user accounts, streak persistence across devices
- Historical dashboards, data explorer

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | App Router, server components for data fetching |
| Styling | Tailwind CSS v4 | Layout and base styles only |
| Animation | GSAP + ScrollTrigger + SplitText | Sole animation library — Framer Motion removed |
| Backend | FastAPI, Python 3.12 | Async, typed, clean |
| Database | PostgreSQL, SQLAlchemy 2.0 async | Pre-aggregated stat tables |
| LLM | Anthropic Claude API | Story generation, trivia, prediction reasoning |
| Data source | Cricsheet ball-by-ball JSON | Parsed at ingest, not at request time |
| Deployment | Vercel (frontend + backend via Fluid Compute) | Single platform |
| Share cards | html2canvas + navigator.share | DOM capture, native mobile share sheet |

---

## 4. Design System

### Typography — Space Grotesk (Google Fonts, single family)

| Role | Size | Weight | Treatment |
|---|---|---|---|
| Stat hero | `clamp(96px, 18vw, 200px)` | 700 | Tabular nums, `letter-spacing: -0.04em` |
| Section headline | `clamp(40px, 7vw, 80px)` | 600 | All-caps, `letter-spacing: -0.02em` |
| Player name | `clamp(24px, 4vw, 48px)` | 500 | Mixed case |
| Body / narrative | `18px` | 400 | `line-height: 1.6` |
| Micro-label | `clamp(12px, 1.2vw, 14px)` | 500 | All-caps, `letter-spacing: 0.15em` |

### Colour System

```css
--bg:       #0A0A0A   /* near-black */
--surface:  #141414
--fg:       #F0F0F0   /* near-white */
--muted:    #666666
--border:   #222222

/* Injected per match from API — the only colour on the page */
--team-a:   [e.g. #004BA0 for MI]
--team-b:   [e.g. #FFCB05 for CSK]
```

Team colours are the sole colour. Everything else is black/white/grey. A stat belonging to Team A renders in `--team-a`. Team B gets `--team-b`. No tints, no opacity variants.

### Gradient — One, Hero Only

```css
background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.05), transparent 70%);
```

No other gradients anywhere.

### Hard Rules

- No `border-radius` above `4px` on the page (share cards: `8px`)
- No `box-shadow`
- No `backdrop-filter` / blur
- No glassmorphism
- Borders: `1px solid var(--border)` only

### Grid

12-column, `gap: clamp(16px, 2vw, 32px)`, `max-width: 1440px`. Mobile: 4 columns.

### Section Heights

- Hero: `100svh`
- All other sections: content-driven (`padding: clamp(80px, 10vw, 140px) 0`)

---

## 5. Motion System

```
Duration:   0.4s – 0.8s
Easing:     cubic-bezier(0.22, 1, 0.36, 1)
Stagger:    80–120ms between siblings
Entry:      opacity 0→1 + translateY 20px→0
Numbers:    GSAP count-up 0→value, 0.8s, same easing
Bars:       scaleX 0→1, transform-origin: left (or center for face-off bars)
Overshoot:  winning bar +4% → snaps back, 0.1s elastic
Drawers:    translateX(100%)→0 desktop / translateY(100%)→0 mobile, 0.5s
```

GSAP is the sole animation library. Framer Motion is removed from `package.json`.

---

## 6. Section Designs

### 6.1 Hero (100svh)

**Layout top → bottom:**
1. Micro-label row: `IPL 2026 · MATCH 34 · WANKHEDE` left / `24 APR 7:30PM` right
2. Background layer: two player silhouettes at 6% opacity, CSS edge mask, left and right  
   MVP: generic batsman/bowler SVG silhouettes (self-hosted). Real player imagery is v2.
3. Radial glow (only allowed gradient) centred behind team names
4. Team names: `MI` (--team-a, 160px) — `RIVALRY` (muted, 14px) — `CSK` (--team-b, 160px)  
   Entry: MI enters from left, CSK from right simultaneously — opposing motion
5. 1px border line: `scaleX 0→1` from centre
6. Headline: data-backed, 10-word max (SplitText word-by-word, 80ms stagger)  
   Example: `"ROHIT HASN'T SCORED >30 vs CSK IN 6 MATCHES."`
7. 1px border line
8. Three stats in 3-column grid:  
   - Left: shock stat (`0`, --team-a) — `ROHIT 50+ VS CSK (L10)` micro-label  
   - Centre: neutral (`78%`, --muted) — `MI WIN % WANKHEDE`  
   - Right: rival stat (`5`, --team-b) — `JADEJA DISMISSALS VS ROHIT`  
   All three count up from 0, fire 400ms after headline completes
9. 1px border line
10. Scroll bait: `ROHIT vs JADEJA — THE KEY BATTLE` left / `SEE THE BATTLE ↓` right

**GSAP sequence:**
- T=0: Team names enter (opposing), border lines `scaleX`
- T=400ms: Headline SplitText, word stagger 80ms
- T=400ms+headline duration: Three stats count up, stagger 120ms
- T=ongoing: Scroll bait fades in last

### 6.2 Battle Card (content-driven)

**Layout:**
1. Micro-label: `MATCH-UP` left / `01 / 01` right  
2. 1px border line
3. Player row: `ROHIT SHARMA` (--team-a) — `VS` (--muted, 36px) — `RAVINDRA JADEJA` (--team-b)  
   Player name silhouettes/cutouts behind names, low opacity
4. 1px border line
5. Stats face-off table — 4 rows:  
   Each row: stat label left → Team A value → bar (grows from centre) → Team B value  
   Bars anchor at VS centreline, grow outward simultaneously  
   Winning side in team colour; losing side in `--muted`  
   Overshoot: winning bar +4% → snap back
6. Rows: `BALLS FACED` / `DISMISSALS` / `STRIKE RATE` / `DOT BALL %`
7. 1px border line
8. `VERDICT` eyebrow label
9. Claude-generated verdict: 2 sentences, hard truth then narrative frame  
   Example: `"Jadeja owns this. 5 dismissals in 28 balls. Tonight is Rohit's redemption arc."`
10. `[ SHARE THIS BATTLE → ]` — opens share drawer (deferred; shock stat card only for MVP)

**GSAP sequence:**
- Section enters viewport → player names stagger from outer edges
- Bars fire: both sides `scaleX 0→1` simultaneously from centre, 0.6s
- Verdict fades in 400ms after bars complete
- Share button last: `opacity 0→1` + `translateY 8→0`

### 6.3 Trivia (content-driven)

**Layout:**
1. Micro-label: `TRIVIA` left / `TODAY'S PICK` right
2. 1px border line
3. Question headline: `clamp(32px, 5vw, 56px)`, no question mark — statement of tension  
   Example: `"HOW MANY TIMES HAS DHONI FINISHED A CHASE IN THE LAST OVER AT WANKHEDE?"`
4. 4 answer options: full-width columns, 48px bold number, large tap targets  
   Desktop: 4-column row. Mobile: 2×2 grid.
5. **On tap (wrong):** selected option shakes (`translateX` GSAP), goes to `--muted`  
   Correct option: `rotateY 90°→0°` flip reveal, team colour border
6. **On tap (correct):** `scale 1→1.06→1` snap, team colour border flash
7. Answer number counts up to value (0→11), stat-hero size
8. Sub-headline: emphasis phrase (`ZERO FAILURES.`)
9. Claude-generated reveal: 2-3 sentences following trivia reveal pattern
10. Streak counter: `🔥 3 CORRECT TODAY` — micro-label, always visible, increments with `scale` pop

**No submit button. No next screen. Tap = full resolution.**

### 6.4 Prediction (content-driven)

**Layout:**
1. Micro-label: `PREDICTION`
2. 1px border line
3. Headline: `THE CASE FOR MI` in `--team-a` — `clamp(40px, 7vw, 80px)`
4. Three evidence items, entering sequentially (400ms stagger):  
   Each item:  
   - `01` number prefix (--muted)  
   - Factor label (all-caps, 16px)  
   - Supporting stat (14px, --muted)  
   - Mini comparison bars: Team A (--team-a) and Team B (--team-b) `scaleX 0→1`
5. Evidence items:  
   - `DEATH OVER DOMINANCE` — `Economy 7.2 vs CSK · Overs 17–20`  
   - `WANKHEDE CHASE RECORD` — `78% wins chasing · CSK: 44%`  
   - `SPIN EXPOSURE` — `CSK top-3 avg 18 vs left-arm spin`
6. 1px border line (enters after all 3 items, 1400ms)
7. `THEREFORE:` micro-label (1800ms)
8. Prediction number counts up 0→value, stat-hero size, `--team-a` colour (2000ms)  
   `MI WIN PROBABILITY` micro-label below
9. `[ SHARE THIS PREDICTION → ]` (opens share drawer — deferred MVP)

**The number appears last. This is non-negotiable. Evidence first, conclusion second.**

---

## 7. Share Card System (MVP: Shock Stat Only)

### Architecture
Each shareable component has a **hidden DOM twin** — identical markup, locked to card dimensions, rendered off-screen. `html2canvas` captures the twin, not the live page. Font loaded into canvas via `FontFace` API before capture.

### Shock Stat Card — 9:16 (1080×1920) and 1:1 (1080×1080)

**9:16 layout:**
```
TOP:    "THE CRICKET FAN"  micro-label, --muted, top-left
        1px border line
CENTRE: Shock stat number, stat-hero size, centred
        Stat label: "ROHIT 50+ SCORES VS CSK (LAST 10)"  micro-label
        1px border line
        Claude one-liner: "0. In 10 matches. Tonight changes that — or it doesn't."
BOTTOM: "MI vs CSK · 24 APR · WANKHEDE"  micro-label
        "thecricketfan.in"  micro-label, right-aligned
```

**1:1 layout:** Same elements, compressed vertically, number smaller (`clamp(64px, 12vw, 120px)`).

### Share Card Rules

| Rule | Value |
|---|---|
| Background | `#0A0A0A` always |
| Font | Space Grotesk via `FontFace` API (loaded before `html2canvas` capture) |
| Team colour | Same CSS vars, passed as inline style to DOM twin |
| No QR codes | Text URL only: `thecricketfan.in` bottom-right |
| Resolution | 1080×1920 (9:16), 1080×1080 (1:1) |
| Mobile share | `navigator.share({ files: [blob] })` → native WhatsApp/IG picker |
| Desktop fallback | Direct PNG download |
| Border radius | `8px` on card only |

### Share Drawer

Opens from right on desktop (`translateX(100%)→0`), bottom on mobile (`translateY(100%)→0`). 0.5s, `cubic-bezier(0.22, 1, 0.36, 1)`.

Overlay behind drawer: `opacity 0→0.6`, 0.3s.  
Close: drawer reverses 0.35s (slightly faster), overlay fades 0.1s after.

Drawer contains: 9:16 preview + 1:1 preview (live DOM renders) + single share button + download fallback.

---

## 8. Section Transitions

### Desktop (pinned scroll)

```
Outgoing:  opacity 1→0,           0.3s, ease-out
Incoming:  opacity 0→1 + translateY 20→0,  0.4s
           starts 0.1s before outgoing finishes (overlap)
```

Section's internal animations fire immediately on arrival — they are the entrance, not an add-on.

**Progress thread (right edge):**
- 1px vertical line, `--border`
- 4 dots: active = `--fg`, scale `1.2`; others = `--muted`
- Active dot transitions between positions, 0.3s
- No labels

**Section counter (top-right, persistent):**
- `01 / 04` → `02 / 04` → `03 / 04` → `04 / 04`
- Micro-label. Current fades out, next fades in, 0.2s.

### Mobile (free scroll)

No pinning. ScrollTrigger fires each section's entrance at `top: 80%` viewport. Same animations, scroll-triggered. Progress thread hidden. Counter persists.

### What Transitions Are Not

- No horizontal slides
- No zoom between sections
- No parallax backgrounds
- No loading spinners (data pre-fetched on mount)

---

## 9. Tone System

### Voice Profile

The narrator is a cricket fan who has watched every IPL season since 2008. Knows stats cold, speaks in emotions. Like a WhatsApp message in a serious cricket group — not a press release, not a chatbot.

### Sentence Patterns

```
Pattern 1 — Stat then consequence:
  "0 fifties. In 6 attempts."

Pattern 2 — Hard truth then narrative frame:
  "Jadeja owns this matchup — 5 dismissals in 28 balls.
   Tonight is Rohit's redemption arc."

Pattern 3 — Number, emphasis, full fact:
  "11. Every single time. Dhoni has never lost a chase
   at Wankhede in the final 2 overs."

Pattern 4 — Evidence format (prediction):
  "Death over economy: MI leads 7.2 vs 8.9"
```

**Rules:**
- Never start with "The" or "A"
- Start with a name, a number, or a verb
- Period is a dramatic device
- Max 12 words per headline
- Max 2 sentences per verdict
- Exactly 3 evidence items per prediction — never 4

### Vocabulary

| Allowed | Forbidden |
|---|---|
| "owns", "haunts", "chokes", "dominates" | "incredible", "amazing", "phenomenal" |
| Raw numbers, no approximation | "approximately", "around" |
| "Tonight", "right now", "never", "every time" | "Going forward", "at the end of the day" |
| Cricket terms without explanation | "passionate fans", "nail-biting encounter" |
| Opinions stated as facts | "epic", "masterclass", "world-class" |
| Active voice always | Passive voice |

### Per-Section Content Contracts (Claude API structured output)

```python
# Headline
{
  "headline": str,  # max 10 words, [PLAYER] [VERB] [STAT] [TIME CONTEXT] pattern
  "shock_stat": {
    "value": int | str,
    "label": str,    # max 5 words, e.g. "ROHIT 50+ VS CSK (L10)"
    "one_liner": str # max 15 words, starts with number or name
  }
}

# Verdict
{
  "sentence_1": str,  # hard truth, data-backed, max 15 words
  "sentence_2": str   # tonight's narrative frame, max 15 words
}

# Trivia reveal
{
  "answer": str | int,
  "emphasis": str,    # 1-3 words, e.g. "ZERO FAILURES."
  "fact": str         # full fact with context, max 20 words
}

# Prediction
{
  "team": str,
  "probability": int,
  "evidence": [
    {"label": str, "detail": str}  # exactly 3 items, label max 4 words, detail max 8 words
  ]
}
```

---

## 10. API Endpoints (MVP)

| Endpoint | Returns |
|---|---|
| `GET /match-story/today` | headline, shock_stat, team_a, team_b, venue, match_time |
| `GET /stats/player-vs-player?player_a=X&player_b=Y` | 4 head-to-head stats + verdict |
| `GET /trivia/today` | question, 4 options, answer, emphasis, fact |
| `GET /prediction/today` | team, probability, 3 evidence items |

All responses cached in DB for the calendar day. Claude API called once per day per endpoint.

---

## 11. Data Layer

**Cricsheet ingest (one-time + seasonal refresh):**
1. Parse ball-by-ball JSON → normalise into `deliveries` table
2. Aggregate into:
   - `player_vs_player` (batsman_id, bowler_id → runs, dismissals, balls, dot_balls)
   - `venue_stats` (venue, team → wins, losses, avg_score, chase_win_pct)
   - `phase_stats` (team, phase → economy, wicket_rate)

**Request-time query:** Fetch pre-aggregated rows by match context. No joins on hot path.

**Claude API call pattern:**
```python
# Pseudocode — actual prompt in services/story_service.py
response = client.messages.create(
    model="claude-opus-4-7",   # most capable for narrative quality
    max_tokens=512,
    system=TONE_SYSTEM_PROMPT, # encodes all vocabulary + sentence rules above
    messages=[{"role": "user", "content": structured_stats_json}]
)
# Cache response in db with today's date key
```

---

## 12. Component File Map (to be created)

```
frontend/src/
  app/
    page.tsx              # data fetch (server component), renders sections
    layout.tsx            # Space Grotesk font, CSS custom properties
  components/
    hero/
      MatchHero.tsx       # hero section
      HeroStats.tsx       # 3-stat row with count-up
    battle/
      PlayerBattle.tsx    # face-off section
      BattleBars.tsx      # growing bars from centre
    trivia/
      TriviaCard.tsx      # tap-to-reveal interaction
    prediction/
      PredictionCard.tsx  # evidence items + number reveal
    share/
      ShareDrawer.tsx     # GSAP drawer, html2canvas capture
      ShockStatCard.tsx   # 9:16 and 1:1 DOM twins
    ui/
      SectionCounter.tsx  # 01/04 persistent counter
      ProgressDots.tsx    # right-edge progress thread
  lib/
    gsap.ts               # GSAP registration (ScrollTrigger, SplitText)
    share.ts              # html2canvas + navigator.share logic
    api.ts                # typed fetch wrappers for all 4 endpoints
```

---

*Spec written: 2026-04-24. Approved by: Deepak Naik (pending). Next: writing-plans.*
