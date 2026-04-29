# Stat Explorer — Design Spec

**Date:** 2026-04-29
**Goal:** WhatsApp-first virality through user-discovered stats. Fan finds a shocking PvP or venue stat, generates a 1:1 share card, drops it in their group chat. The sharer becomes the insider.

---

## Viral Loop

```
Match page → ExploreQuicklinks → /explore (pre-filled) → shocking stat → Generate Card → Share to WhatsApp → group chat recipient opens link → lands on /explore
```

No accounts, no login. The card and the URL are the entire acquisition funnel.

---

## What We're Building

Two new things. Everything else reused.

1. `/explore` page — tab-based stat explorer (Player vs Player · Venue)
2. `ExploreQuicklinks` component on the match page — 3 pre-filled deep links into the explorer

**Deferred:** Team vs Team tab. The `matches` table has fixtures, not results — no win/loss history to aggregate. Revisit after Cricsheet ingest is expanded.

---

## Backend

### Existing endpoints (no changes needed)

| Endpoint | Used for |
|---|---|
| `GET /stats/player-vs-player?batsman=X&bowler=Y` | PvP tab result |

### New endpoints

#### `GET /stats/players`

Typeahead search for the player picker.

**Query params:** `q` (string, min 2 chars) — name substring match, case-insensitive.

**Response:**
```json
[
  { "id": 1, "name": "Jasprit Bumrah", "team": "MI" },
  { "id": 2, "name": "Bumrah", "team": "MI" }
]
```

**Implementation:** `SELECT id, name, teams.short_name FROM players JOIN teams ON players.team_id = teams.id WHERE players.name ILIKE '%q%' LIMIT 10`. No pagination needed — 10 results max.

#### `GET /stats/venue-team`

Venue stats scoped to one team. `VenueStats` already has `team_id` — this just exposes it.

**Query params:** `venue` (string), `team` (short_name string, e.g. `MI`)

**Response:**
```json
{
  "venue": "Wankhede Stadium, Mumbai",
  "team": "MI",
  "matches_played": 42,
  "win_pct": 57,
  "avg_score": 176,
  "chase_win_pct": 52
}
```

**Error:** 404 if no `VenueStats` row found for that venue + team combination.

---

## Frontend

### URL structure

```
/explore?mode=pvp&p1=Jasprit+Bumrah&p2=Abhishek+Sharma
/explore?mode=venue&venue=Wankhede+Stadium%2C+Mumbai&team=MI
```

All state lives in the URL — shareable, bookmarkable, pre-fillable from quicklinks.

### Components

#### `PlayerPicker`

Typeahead input for selecting a player.

- Calls `GET /stats/players?q=<value>` on each keystroke, debounced 300ms
- Shows dropdown of up to 10 results with player name + team badge
- On select: updates URL param and clears dropdown
- Controlled via URL params (`p1`, `p2`) so pre-fill from quicklinks works on mount
- Empty state: "Start typing a player name"

#### `StatExplorer` (page component, `/explore`)

Reads URL params on mount. Manages:
- Active tab (`mode` param: `pvp` | `venue`)
- Picker values
- Fetch state (idle → loading → result | error)

On tab switch: clears result, updates `mode` param, preserves unrelated params.

Fires the right API call when all required inputs are filled:
- PvP tab: both `p1` and `p2` set → `GET /stats/player-vs-player`
- Venue tab: `venue` and `team` set → `GET /stats/venue-team`

#### `StatResult`

Renders the API response. Two layouts:

**PvP layout:**
- Giant dismissal count (top stat)
- Headline: `"{bowler} has dismissed {batsman} X times"`
- Sub: `"More than any other bowler in IPL history"` (only if dismissals ≥ 5, otherwise omit)
- Breakdown row: Dot Balls · Strike Rate · Sixes · Seasons

**Venue layout:**
- Giant win % (top stat)
- Headline: `"{team} win {X}% of matches at {venue_short}"`
- Breakdown row: Matches Played · Avg Score · Chase Win %

"Generate Share Card" button sits below the result. Only visible when a result is loaded.

#### `ShareCard`

1:1 format (square), generated client-side with `html-to-image` (already in the project).

Card layout:
```
THE CRICKET FAN                    [top-left, small]

Bumrah vs Abhishek Sharma          [player names]

8                                  [giant number, team_a color]
DISMISSALS. MOST IN IPL.           [headline, white, bold]
38 SR · 34 dot balls. No answer.   [one-liner, muted]

thecricketfan.in · Tap to explore  [footer, very small]
```

"Share to WhatsApp" button: captures the card div to PNG blob via `html-to-image`, then calls `navigator.share({ files: [new File([blob], 'stat.png', { type: 'image/png' })] })` — this opens the native share sheet on mobile, which includes WhatsApp. On desktop where `navigator.share` with files is unsupported, falls back to a download button ("Save Card").

#### `ExploreQuicklinks`

Sits on the match page, below the hero section. No additional fetch — consumes story data already loaded by the page.

Renders 3 cards:

| Label | Destination |
|---|---|
| Player Battle · `{bowler} vs {batsman}` | `/explore?mode=pvp&p1={bowler}&p2={batsman}` |
| Venue Edge · `{team_a} at {venue_short}` | `/explore?mode=venue&venue={venue}&team={team_a}` |
| Venue Edge · `{team_b} at {venue_short}` | `/explore?mode=venue&venue={venue}&team={team_b}` |

Card style: same pill style as existing match-page stat cards (dark bg, gold border on hover, arrow →).

---

## Data Constraints

- `PlayerVsPlayer` rows are created during Cricsheet ingest. If no row exists for a given batsman/bowler pair, the existing endpoint returns 404 — `StatResult` shows "No head-to-head data for this matchup yet."
- `VenueStats` rows exist for teams that have played at that venue in the ingested Cricsheet data. 404 → "No venue data for this team yet."
- Player search only returns players in the `players` table (ingested from Cricsheet). If a current-season player hasn't appeared in any ingested match, they won't appear in typeahead.

---

## What We Are Not Building

- Team vs Team tab (no result data in DB)
- Saved/favourited stats (no auth)
- Leaderboard of most-shared stats
- Push notifications
- Any backend changes to the story generation pipeline

---

## Files Affected

**Backend (new):**
- `backend/app/api/stats.py` — add `GET /stats/players` and `GET /stats/venue-team` routes

**Frontend (new):**
- `frontend/src/app/explore/page.tsx` — `StatExplorer` page
- `frontend/src/components/explorer/PlayerPicker.tsx`
- `frontend/src/components/explorer/StatResult.tsx`
- `frontend/src/components/explorer/ShareCard.tsx`

**Frontend (modified):**
- `frontend/src/app/page.tsx` — add `<ExploreQuicklinks>` below hero
- `frontend/src/components/explorer/ExploreQuicklinks.tsx` — new component, referenced from page
- `frontend/src/lib/api.ts` — add `getPlayers()`, `getVenueTeamStats()` fetch helpers

---

## Success Criteria

1. Fan on the match page can tap "Bumrah vs Abhishek →" and land on `/explore` with both players pre-filled and the stat result loaded.
2. Fan can change either player in the typeahead and get a new result without a page reload.
3. "Generate Share Card" produces a 1:1 PNG card. "Share to WhatsApp" opens WhatsApp with the card.
4. A cold visitor landing on `/explore?mode=pvp&p1=Jasprit+Bumrah&p2=Virat+Kohli` sees the stat result immediately (URL is the share surface).
