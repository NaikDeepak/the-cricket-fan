# Stat Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/explore` page where fans discover shocking match stats and share them to WhatsApp as a 1:1 image card, with pre-filled entry points from the match page.

**Architecture:** Two new FastAPI endpoints expose player typeahead and venue-team stats. A `"use client"` `StatExplorer` component reads URL params via `useSearchParams`, fires API calls when pickers are filled, and generates a shareable image card using the existing `html-to-image` + `captureCard`/`shareCard` infrastructure. `ExploreQuicklinks` on the match page provides pre-filled deep-links from today's matchup — no extra fetch.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async (backend), Next.js 16 App Router, Tailwind v4, `html-to-image` (already in `package.json`), `@/lib/share` (already exists)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/api/stats.py` | Modify | Add `GET /stats/players` and `GET /stats/venue-team` |
| `backend/tests/test_api.py` | Modify | Tests for both new routes |
| `frontend/src/lib/api.ts` | Modify | Add `PlayerResult`, `VenueTeamData` types; `api.players()`, `api.venueTeam()` |
| `frontend/src/app/layout.tsx` | Modify | Add "Explore" nav link |
| `frontend/src/app/page.tsx` | Modify | Add `<ExploreQuicklinks>` below hero |
| `frontend/src/app/explore/page.tsx` | Create | Server component shell with `<Suspense>` boundary |
| `frontend/src/components/explorer/ExploreQuicklinks.tsx` | Create | Server component; 3 pre-filled links from `StoryData` |
| `frontend/src/components/explorer/StatExplorer.tsx` | Create | `"use client"` orchestrator; tabs, pickers, fetch state |
| `frontend/src/components/explorer/PlayerPicker.tsx` | Create | `"use client"`; debounced typeahead input |
| `frontend/src/components/explorer/StatResult.tsx` | Create | Pure component; PvP or Venue result layout |
| `frontend/src/components/explorer/ExplorerShareCard.tsx` | Create | `"use client"`; off-screen card + capture/share |

---

## Task 1: Backend — GET /stats/players

**Files:**
- Modify: `backend/app/api/stats.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_players_short_query_returns_empty():
    from unittest.mock import AsyncMock
    async def override():
        yield AsyncMock()
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/players?q=b")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_players_returns_matching():
    from unittest.mock import AsyncMock, MagicMock
    mock_player = MagicMock()
    mock_player.id = 1
    mock_player.name = "Jasprit Bumrah"
    mock_player.team_id = 5
    mock_team = MagicMock()
    mock_team.short_name = "MI"
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [mock_player]
    mock_session = AsyncMock()
    mock_session.execute.return_value = mock_execute_result
    mock_session.get.return_value = mock_team
    async def override():
        yield mock_session
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/players?q=bumrah")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "Jasprit Bumrah"
    assert data[0]["team"] == "MI"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && source .venv/bin/activate
pytest tests/test_api.py::test_players_short_query_returns_empty tests/test_api.py::test_players_returns_matching -v
```

Expected: FAIL with `404` or attribute error (route doesn't exist yet).

- [ ] **Step 3: Implement the endpoint**

In `backend/app/api/stats.py`, add these imports at the top and the two new models + route:

```python
from ..models.match import Team  # add to existing import block
from ..models.player import Player, PlayerVsPlayer, VenueStats  # VenueStats needed in Task 2
```

Add after the existing `PlayerVsPlayerResponse` class:

```python
class PlayerResult(BaseModel):
    id: int
    name: str
    team: str


@router.get("/players", response_model=list[PlayerResult])
async def get_players(
    q: str = Query("", description="Name substring, min 2 chars"),
    session: AsyncSession = Depends(get_session),
):
    if len(q) < 2:
        return []
    result = await session.execute(
        select(Player).where(Player.name.ilike(f"%{q}%")).limit(10)
    )
    players = result.scalars().all()
    out = []
    for p in players:
        team = await session.get(Team, p.team_id)
        out.append({"id": p.id, "name": p.name, "team": team.short_name if team else ""})
    return out
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/test_api.py::test_players_short_query_returns_empty tests/test_api.py::test_players_returns_matching -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/stats.py backend/tests/test_api.py
git commit -m "feat: GET /stats/players — typeahead endpoint for explorer"
```

---

## Task 2: Backend — GET /stats/venue-team

**Files:**
- Modify: `backend/app/api/stats.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_venue_team_unknown_team_returns_404():
    from unittest.mock import AsyncMock
    mock_session = AsyncMock()
    mock_session.scalar.return_value = None
    async def override():
        yield mock_session
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/venue-team?venue=Wankhede&team=XX")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_venue_team_found():
    from unittest.mock import AsyncMock, MagicMock
    mock_team = MagicMock()
    mock_team.id = 1
    mock_vs = MagicMock()
    mock_vs.venue = "Wankhede Stadium, Mumbai"
    mock_vs.matches = 42
    mock_vs.wins = 24       # round(24/42*100) = 57
    mock_vs.chase_wins = 10
    mock_vs.chase_attempts = 20   # 50%
    mock_vs.avg_score = 176.0
    mock_session = AsyncMock()
    mock_session.scalar.side_effect = [mock_team, mock_vs]
    async def override():
        yield mock_session
    app.dependency_overrides[get_session] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/stats/venue-team?venue=Wankhede+Stadium%2C+Mumbai&team=MI")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    data = r.json()
    assert data["team"] == "MI"
    assert data["matches_played"] == 42
    assert data["win_pct"] == 57
    assert data["chase_win_pct"] == 50
    assert data["avg_score"] == 176
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_api.py::test_venue_team_unknown_team_returns_404 tests/test_api.py::test_venue_team_found -v
```

Expected: FAIL (route doesn't exist).

- [ ] **Step 3: Implement the endpoint**

Add after the `get_players` route in `backend/app/api/stats.py`:

```python
class VenueTeamResponse(BaseModel):
    venue: str
    team: str
    matches_played: int
    win_pct: int
    avg_score: int
    chase_win_pct: int


@router.get("/venue-team", response_model=VenueTeamResponse)
async def get_venue_team(
    venue: str = Query(...),
    team: str = Query(..., description="Team short name, e.g. MI"),
    session: AsyncSession = Depends(get_session),
):
    team_row = await session.scalar(select(Team).where(Team.short_name == team))
    if not team_row:
        raise HTTPException(status_code=404, detail="Team not found")

    vs = await session.scalar(
        select(VenueStats).where(
            VenueStats.venue == venue,
            VenueStats.team_id == team_row.id,
        )
    )
    if not vs:
        raise HTTPException(status_code=404, detail="No venue data for this team")

    win_pct = round((vs.wins / vs.matches) * 100) if vs.matches else 0
    chase_win_pct = round((vs.chase_wins / vs.chase_attempts) * 100) if vs.chase_attempts else 0

    return {
        "venue": vs.venue,
        "team": team,
        "matches_played": vs.matches,
        "win_pct": win_pct,
        "avg_score": round(vs.avg_score),
        "chase_win_pct": chase_win_pct,
    }
```

`VenueStats` is already imported in Task 1's import block. Confirm `VenueStats` appears in the import from `..models.player`.

- [ ] **Step 4: Run all stats tests**

```bash
pytest tests/test_api.py -v -k "player or venue"
```

Expected: 5 passed (3 existing PvP + 2 new venue-team + 2 new players = 7 total).

- [ ] **Step 5: Run full test suite**

```bash
pytest -v
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/stats.py backend/tests/test_api.py
git commit -m "feat: GET /stats/venue-team — venue stats scoped to one team"
```

---

## Task 3: Frontend API helpers

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types and helpers**

Add after the `MatchSummary` type block in `frontend/src/lib/api.ts`:

```typescript
export type PlayerResult = { id: number; name: string; team: string };

export type VenueTeamData = {
  venue: string;
  team: string;
  matches_played: number;
  win_pct: number;
  avg_score: number;
  chase_win_pct: number;
};
```

Add to the `api` object (after `predictionFor`):

```typescript
  players: (q: string) =>
    get<PlayerResult[]>(`/stats/players?q=${encodeURIComponent(q)}`),
  venueTeam: (venue: string, team: string) =>
    get<VenueTeamData>(
      `/stats/venue-team?venue=${encodeURIComponent(venue)}&team=${encodeURIComponent(team)}`
    ),
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add players + venueTeam API helpers"
```

---

## Task 4: ExploreQuicklinks component

**Files:**
- Create: `frontend/src/components/explorer/ExploreQuicklinks.tsx`

Server component — no `"use client"`. Receives `StoryData`, renders 3 `<Link>` cards. Only renders the PvP link when both `featured_batsman` and `featured_bowler` are non-empty.

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/explorer/ExploreQuicklinks.tsx
import Link from "next/link";
import type { StoryData } from "@/lib/api";

export default function ExploreQuicklinks({ data }: { data: StoryData }) {
  const venueShort = data.venue.split(",")[0];

  const links = [
    ...(data.featured_batsman && data.featured_bowler
      ? [
          {
            tag: "PLAYER BATTLE",
            label: `${data.featured_bowler} vs ${data.featured_batsman}`,
            href: `/explore?mode=pvp&p1=${encodeURIComponent(data.featured_batsman)}&p2=${encodeURIComponent(data.featured_bowler)}`,
          },
        ]
      : []),
    {
      tag: "VENUE EDGE",
      label: `${data.team_a.short_name} at ${venueShort}`,
      href: `/explore?mode=venue&venue=${encodeURIComponent(data.venue)}&team=${encodeURIComponent(data.team_a.short_name)}`,
    },
    {
      tag: "VENUE EDGE",
      label: `${data.team_b.short_name} at ${venueShort}`,
      href: `/explore?mode=venue&venue=${encodeURIComponent(data.venue)}&team=${encodeURIComponent(data.team_b.short_name)}`,
    },
  ];

  return (
    <section style={{ padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        EXPLORE THE NUMBERS
      </p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.15em",
                color: "var(--muted)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {link.tag}
            </p>
            <p style={{ fontSize: "14px", fontWeight: 600, margin: "2px 0 0" }}>{link.label}</p>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "16px" }}>→</span>
        </Link>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/explorer/ExploreQuicklinks.tsx
git commit -m "feat: ExploreQuicklinks — pre-filled deep-links from match page"
```

---

## Task 5: Wire ExploreQuicklinks into match page + add nav link

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Add ExploreQuicklinks to match page**

In `frontend/src/app/page.tsx`, add the import after the existing imports:

```typescript
import ExploreQuicklinks from "@/components/explorer/ExploreQuicklinks";
```

In the `return`, add `<ExploreQuicklinks>` immediately after `<MatchHero>`:

```tsx
      <MatchHero data={story} />
      <ExploreQuicklinks data={story} />
      {battle && <PlayerBattle data={battle} teamA={story.team_a} teamB={story.team_b} />}
```

- [ ] **Step 2: Add Explore link to nav**

In `frontend/src/app/layout.tsx`, add an "Explore" link next to the existing "Past Matches" link:

```tsx
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <Link href="/explore" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Explore
            </Link>
            <Link href="/archive" className="text-zinc-400 hover:text-white text-sm transition-colors">
              Past Matches
            </Link>
          </div>
```

Replace the single `<Link href="/archive">` with the above `<div>` wrapping both links.

- [ ] **Step 3: Verify in browser**

Start dev server if not running: `cd frontend && npm run dev`

Open `http://localhost:3000`. Confirm:
- 3 quicklink cards appear below the hero
- Nav shows "Explore" link alongside "Past Matches"
- Clicking a quicklink navigates to `/explore?mode=pvp&p1=...` (404 page is fine — page doesn't exist yet)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/layout.tsx
git commit -m "feat: wire ExploreQuicklinks into match page + add Explore nav link"
```

---

## Task 6: StatResult component

**Files:**
- Create: `frontend/src/components/explorer/StatResult.tsx`

Pure presentational component — no hooks, no `"use client"` needed.

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/explorer/StatResult.tsx
import type { BattleData, VenueTeamData } from "@/lib/api";

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "20px", fontWeight: 700 }}>{value}</div>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginTop: "2px",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "16px",
};

const breakdownStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid var(--border)",
};

type Props =
  | { mode: "pvp"; data: BattleData }
  | { mode: "venue"; data: VenueTeamData };

export default function StatResult(props: Props) {
  if (props.mode === "pvp") {
    const { data } = props;
    const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.batsman_val ?? 0;
    const balls = data.stats.find((s) => s.label === "BALLS FACED")?.batsman_val ?? 0;
    const sr = data.stats.find((s) => s.label === "STRIKE RATE / ECONOMY")?.batsman_val ?? 0;
    const dotPct = data.stats.find((s) => s.label === "DOT BALL %")?.batsman_val ?? 0;

    return (
      <div style={cardStyle}>
        <div
          style={{
            fontSize: "clamp(64px, 15vw, 96px)",
            fontWeight: 700,
            color: "var(--team-a)",
            lineHeight: 1,
          }}
        >
          {dismissals}
        </div>
        <p style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase", marginTop: "8px" }}>
          {data.bowler} has dismissed {data.batsman}
        </p>
        {dismissals >= 5 && (
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            More than any other bowler in IPL history
          </p>
        )}
        <div style={breakdownStyle}>
          <StatPill value={String(balls)} label="BALLS FACED" />
          <StatPill value={String(sr)} label="STRIKE RATE" />
          <StatPill value={`${dotPct}%`} label="DOT BALL %" />
        </div>
      </div>
    );
  }

  const { data } = props;
  const venueShort = data.venue.split(",")[0];

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: "clamp(64px, 15vw, 96px)",
          fontWeight: 700,
          color: "var(--team-a)",
          lineHeight: 1,
        }}
      >
        {data.win_pct}%
      </div>
      <p style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase", marginTop: "8px" }}>
        {data.team} win {data.win_pct}% at {venueShort}
      </p>
      <div style={breakdownStyle}>
        <StatPill value={String(data.matches_played)} label="MATCHES" />
        <StatPill value={String(data.avg_score)} label="AVG SCORE" />
        <StatPill value={`${data.chase_win_pct}%`} label="CHASE WIN %" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/explorer/StatResult.tsx
git commit -m "feat: StatResult — PvP and Venue stat display component"
```

---

## Task 7: PlayerPicker component

**Files:**
- Create: `frontend/src/components/explorer/PlayerPicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/explorer/PlayerPicker.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { api, type PlayerResult } from "@/lib/api";

type Props = {
  label: string;
  value: string;
  onSelect: (name: string) => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "var(--fg)",
  fontSize: "14px",
  fontFamily: "Space Grotesk, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

export default function PlayerPicker({ label, value, onSelect }: Props) {
  const [input, setInput] = useState(value);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    if (input.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await api.players(input);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (name: string) => {
    setInput(name);
    setResults([]);
    setOpen(false);
    onSelect(name);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Start typing..."
        style={inputStyle}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#111",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.name)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--border)",
                color: "var(--fg)",
                cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.1em" }}>
                {p.team}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/explorer/PlayerPicker.tsx
git commit -m "feat: PlayerPicker — debounced typeahead input"
```

---

## Task 8: ExplorerShareCard component

**Files:**
- Create: `frontend/src/components/explorer/ExplorerShareCard.tsx`

Follows the `ShockStatCard` pattern exactly: off-screen fixed div captured by `html-to-image`, then shared via `captureCard`/`shareCard` from `@/lib/share`.

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/explorer/ExplorerShareCard.tsx
"use client";
import { useRef, useState } from "react";
import { captureCard, shareCard } from "@/lib/share";
import type { BattleData, VenueTeamData } from "@/lib/api";

type Props =
  | { mode: "pvp"; data: BattleData }
  | { mode: "venue"; data: VenueTeamData };

export default function ExplorerShareCard(props: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  let bigNumber: string;
  let headline: string;
  let oneLiner: string;
  let subjectLine: string;

  if (props.mode === "pvp") {
    const { data } = props;
    const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.batsman_val ?? 0;
    const sr = data.stats.find((s) => s.label === "STRIKE RATE / ECONOMY")?.batsman_val ?? 0;
    bigNumber = String(dismissals);
    headline = "DISMISSALS. IPL RECORD.";
    oneLiner = `SR ${sr}. No answer.`;
    subjectLine = `${data.bowler} vs ${data.batsman}`;
  } else {
    const { data } = props;
    const venueShort = data.venue.split(",")[0];
    bigNumber = `${data.win_pct}%`;
    headline = `WIN RATE AT ${venueShort.toUpperCase()}`;
    oneLiner = `${data.matches_played} matches. Avg score ${data.avg_score}.`;
    subjectLine = `${data.team} at ${venueShort}`;
  }

  const handleShare = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const blob = await captureCard(cardRef.current);
      await shareCard(blob, "cricket-fan-stat.png");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      {/* Off-screen card — captured by html-to-image */}
      <div
        ref={cardRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: 540,
          height: 540,
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "32px",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#666",
              margin: 0,
            }}
          >
            THE CRICKET FAN
          </p>
          <p style={{ fontSize: "13px", color: "#aaa", margin: "8px 0 0" }}>{subjectLine}</p>
          <div style={{ width: "100%", height: "1px", background: "#222", marginTop: "12px" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "100px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "#f7a721",
              fontVariantNumeric: "tabular-nums",
              margin: 0,
            }}
          >
            {bigNumber}
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#fff",
              margin: "12px 0 0",
            }}
          >
            {headline}
          </p>
          <p style={{ fontSize: "13px", color: "#888", margin: "6px 0 0" }}>{oneLiner}</p>
        </div>
        <p
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            color: "#333",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          thecricketfan.in · Tap to explore
        </p>
      </div>

      <button
        onClick={handleShare}
        disabled={capturing}
        style={{
          width: "100%",
          padding: "14px",
          background: "#25D366",
          border: "none",
          borderRadius: "8px",
          color: "#fff",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: capturing ? "not-allowed" : "pointer",
          marginTop: "16px",
        }}
      >
        {capturing ? "CAPTURING..." : "📲 SHARE TO WHATSAPP"}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/explorer/ExplorerShareCard.tsx
git commit -m "feat: ExplorerShareCard — 1:1 image card capture + WhatsApp share"
```

---

## Task 9: StatExplorer client component

**Files:**
- Create: `frontend/src/components/explorer/StatExplorer.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/explorer/StatExplorer.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PlayerPicker from "./PlayerPicker";
import StatResult from "./StatResult";
import ExplorerShareCard from "./ExplorerShareCard";
import { api, type BattleData, type VenueTeamData } from "@/lib/api";

type Tab = "pvp" | "venue";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "pvp"; data: BattleData }
  | { status: "venue"; data: VenueTeamData }
  | { status: "error"; message: string };

export default function StatExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("mode") as Tab) ?? "pvp");
  const [p1, setP1] = useState(searchParams.get("p1") ?? "");    // batsman
  const [p2, setP2] = useState(searchParams.get("p2") ?? "");    // bowler
  const [venue, setVenue] = useState(searchParams.get("venue") ?? "");
  const [team, setTeam] = useState(searchParams.get("team") ?? "");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  // Auto-fetch on mount when params are pre-filled (quicklink navigation)
  useEffect(() => {
    if (tab === "pvp" && p1 && p2) fetchPvP(p1, p2);
    else if (tab === "venue" && venue && team) fetchVenue(venue, team);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushUrl = (params: Record<string, string>) => {
    router.replace(`/explore?${new URLSearchParams(params).toString()}`, { scroll: false });
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setFetchState({ status: "idle" });
    pushUrl({ mode: t });
  };

  const fetchPvP = async (batsman: string, bowler: string) => {
    setFetchState({ status: "loading" });
    try {
      const data = await api.battle(batsman, bowler);
      setFetchState({ status: "pvp", data });
    } catch {
      setFetchState({ status: "error", message: "No head-to-head data for this matchup yet." });
    }
  };

  const fetchVenue = async (v: string, t: string) => {
    setFetchState({ status: "loading" });
    try {
      const data = await api.venueTeam(v, t);
      setFetchState({ status: "venue", data });
    } catch {
      setFetchState({ status: "error", message: "No venue data for this team yet." });
    }
  };

  const handleGo = () => {
    if (tab === "pvp") {
      pushUrl({ mode: "pvp", p1, p2 });
      fetchPvP(p1, p2);
    } else {
      pushUrl({ mode: "venue", venue, team });
      fetchVenue(venue, team);
    }
  };

  const canGo = tab === "pvp" ? p1.length > 0 && p2.length > 0 : venue.length > 0 && team.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Stat Explorer
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>
          Find the stat your group chat hasn't seen yet
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {(["pvp", "venue"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                border: `1px solid ${tab === t ? "var(--team-a)" : "var(--border)"}`,
                background: tab === t ? "rgba(0,75,160,0.15)" : "transparent",
                color: tab === t ? "var(--fg)" : "var(--muted)",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}
            >
              {t === "pvp" ? "Player vs Player" : "Venue"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        {tab === "pvp" ? (
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
              alignItems: "flex-end",
            }}
          >
            <PlayerPicker label="Batsman" value={p1} onSelect={setP1} />
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                paddingBottom: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              VS
            </span>
            <PlayerPicker label="Bowler" value={p2} onSelect={setP2} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 2 }}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                VENUE
              </div>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Wankhede Stadium, Mumbai"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "var(--fg)",
                  fontSize: "14px",
                  fontFamily: "Space Grotesk, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                TEAM
              </div>
              <input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g. MI"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "var(--fg)",
                  fontSize: "14px",
                  fontFamily: "Space Grotesk, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleGo}
          disabled={!canGo || fetchState.status === "loading"}
          style={{
            width: "100%",
            padding: "14px",
            background: canGo ? "var(--team-a)" : "var(--border)",
            border: "none",
            borderRadius: "8px",
            color: canGo ? "#fff" : "var(--muted)",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canGo && fetchState.status !== "loading" ? "pointer" : "not-allowed",
            marginBottom: "24px",
          }}
        >
          {fetchState.status === "loading" ? "FINDING STAT..." : "GO →"}
        </button>

        {fetchState.status === "error" && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            {fetchState.message}
          </p>
        )}

        {fetchState.status === "pvp" && (
          <>
            <StatResult mode="pvp" data={fetchState.data} />
            <ExplorerShareCard mode="pvp" data={fetchState.data} />
          </>
        )}

        {fetchState.status === "venue" && (
          <>
            <StatResult mode="venue" data={fetchState.data} />
            <ExplorerShareCard mode="venue" data={fetchState.data} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/explorer/StatExplorer.tsx
git commit -m "feat: StatExplorer — tab orchestrator with URL state"
```

---

## Task 10: /explore server page

**Files:**
- Create: `frontend/src/app/explore/page.tsx`

> **Check first:** Read `frontend/node_modules/next/dist/docs/` for the current `searchParams` prop API in Next.js 16 server components before writing this file. The pattern below is correct for Next.js 15+ where `searchParams` is a Promise — verify it hasn't changed.

`useSearchParams()` in `StatExplorer` already handles URL params on the client. The server page just provides a `Suspense` boundary (required by Next.js whenever a client component uses `useSearchParams`).

- [ ] **Step 1: Create the page**

```typescript
// frontend/src/app/explore/page.tsx
import { Suspense } from "react";
import StatExplorer from "@/components/explorer/StatExplorer";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: "var(--muted)",
            fontSize: "13px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Loading...
        </div>
      }
    >
      <StatExplorer />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the full flow in browser**

With frontend dev server running (`npm run dev`):

1. Open `http://localhost:3000` — confirm quicklinks appear below hero
2. Click "Bumrah vs Abhishek →" quicklink
3. Confirm redirect to `/explore?mode=pvp&p1=Abhishek+Sharma&p2=DL+Chahar` with both pickers pre-filled and stat auto-loaded
4. Click "Venue" tab → confirm tab switches, result clears
5. Click a venue quicklink from the match page → confirm venue + team pre-filled and stat auto-loaded
6. Click "GO →" on a PvP result → confirm "Generate Share Card" / share button appears
7. On mobile or using browser DevTools device emulation: tap "📲 SHARE TO WHATSAPP" → confirm native share sheet opens

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/explore/page.tsx
git commit -m "feat: /explore page — Suspense wrapper for StatExplorer"
```

---

## Final smoke test

- [ ] Run backend tests: `cd backend && pytest -v` — all green
- [ ] Run frontend build: `cd frontend && npm run build` — no errors
- [ ] Manually verify success criteria from the spec:
  - [ ] Quicklink from match page → `/explore` pre-filled → stat loads automatically
  - [ ] Changing a picker and pressing GO fetches new result without page reload
  - [ ] "Share to WhatsApp" produces a PNG card via native share sheet on mobile
  - [ ] Cold URL `/explore?mode=pvp&p1=Jasprit+Bumrah&p2=Virat+Kohli` loads and auto-fetches the stat
