# Design Spec: Real Match Schedule + Match Archive

**Date:** 2026-04-24  
**Project:** The Cricket Fan  
**Scope:** Replace hardcoded MI vs CSK seed with full IPL 2026 fixture table; add match archive list and per-date match pages.

---

## Problem

The app is hardcoded to a single MI vs CSK match via `seed_match.py`. `Match.is_today` is a manually managed boolean flag. There is no way to browse past matches.

---

## Goals

1. Today's match resolves automatically from `match_date == date.today()` — no daily ops.
2. All IPL 2026 fixtures are seeded once; the app stays correct for the full season.
3. Users can browse a list of past matches and view the full story/trivia/prediction for any past date.

---

## Non-Goals

- Real-time scores or live match updates
- Admin UI for managing fixtures
- Fixing the hardcoded Rohit/Jadeja player battle (pre-existing TODO, separate scope)

---

## Data Model Changes

### Drop `Match.is_today`

Remove the `is_today: Mapped[bool]` column from `Match`. It is a derived value (`match_date == date.today()`) and storing it creates stale-state risk.

**Before:**
```python
match = await session.scalar(select(Match).where(Match.is_today == True))
```

**After:**
```python
from datetime import date
match = await session.scalar(select(Match).where(Match.match_date == date.today()))
```

All three handlers (`story.py`, `trivia.py`, `prediction.py`) get this change.

### No other schema changes

`DailyCache`, `Team`, `Player`, `PlayerVsPlayer`, `VenueStats` are unchanged.

---

## Fixture Seeding

### `scripts/seed_schedule.py` (replaces `seed_match.py`)

Seeds all 10 IPL 2026 teams and all 74 league fixtures. Safe to re-run (clears and re-seeds).

**Teams seeded:**

| Short | Name | Primary color |
|---|---|---|
| MI | Mumbai Indians | #004BA0 |
| CSK | Chennai Super Kings | #FFCB05 |
| RCB | Royal Challengers Bengaluru | #EC1C24 |
| KKR | Kolkata Knight Riders | #3A225D |
| SRH | Sunrisers Hyderabad | #F7A721 |
| DC | Delhi Capitals | #0078BC |
| PBKS | Punjab Kings | #ED1B24 |
| RR | Rajasthan Royals | #254AA5 |
| GT | Gujarat Titans | #1C1C1C |
| LSG | Lucknow Super Giants | #A4C2F4 |

**Fixture list:** A `FIXTURES` Python list of dicts — `{date, team_a, team_b, venue, time}` — covering all 74 matches. Sourced from the official IPL 2026 schedule at implementation time.

---

## Backend Changes

### Existing `/today` endpoints — query change only

`story.py`, `trivia.py`, `prediction.py`: change `WHERE is_today == True` → `WHERE match_date == date.today()`. No other logic changes.

### New: `GET /matches`

File: `backend/app/api/matches.py`

Returns all matches where `match_date <= today`, sorted by date descending.

```
GET /matches
Response: [
  {
    "date": "2026-04-24",
    "team_a": {"short_name": "MI", "name": "Mumbai Indians", "primary_color": "#004BA0"},
    "team_b": {"short_name": "CSK", "name": "Chennai Super Kings", "primary_color": "#FFCB05"},
    "venue": "Wankhede Stadium",
    "match_time": "7:30 PM",
    "has_story": true
  },
  ...
]
```

`has_story` is derived by checking whether `DailyCache` contains a row with `cache_key = "story_{date}"`.

### New: date-parameterised story/trivia/prediction endpoints

Three new endpoints, one per domain:

```
GET /match-story/{date}     e.g. /match-story/2026-04-20
GET /trivia/{date}
GET /prediction/{date}
```

**Behaviour (same for all three):**
1. Parse `date` param as `YYYY-MM-DD`; return 400 if malformed or future date.
2. Check `DailyCache` for `{type}_{date}` — return if found.
3. Query `Match` where `match_date == date`; return 404 if no fixture.
4. Generate via Gemini (same service functions as `/today` endpoints).
5. Cache result in `DailyCache` and return.

The `/today` endpoints are kept as-is for the frontend homepage — they call `date.today()` internally and delegate to the same service functions.

### Router registration

`matches.py` router registered in `main.py` alongside the existing routers.

---

## Frontend Changes

### New route: `/archive`

File: `frontend/src/app/archive/page.tsx`

Calls `GET /matches`. Renders a vertical list of `MatchArchiveCard` components (new: `src/components/archive/MatchArchiveCard.tsx`) — one per past match. Each card shows:
- Date (formatted: "Thu, Apr 24")
- Team A badge + short name vs Team B badge + short name
- Venue name
- Headline text if `has_story === true`, otherwise a muted "—"
- Entire card is a link to `/match/{date}`

### New dynamic route: `/match/[date]`

File: `frontend/src/app/match/[date]/page.tsx`

Same component tree as the homepage — `MatchHero`, `PlayerBattle`, `TriviaCard`, `PredictionCard` — but fetches from the date-specific endpoints:
- `/match-story/{date}`
- `/trivia/{date}`
- `/prediction/{date}`

The homepage (`/`) is unchanged and continues calling the `/today` endpoints.

### Navigation

A "Past Matches" link added to the page layout (`layout.tsx`) pointing to `/archive`.

---

## Error States

| Scenario | Behaviour |
|---|---|
| No fixture for today's date | All `/today` endpoints return 404. Homepage shows a "No match today" state. |
| Past date requested with no fixture | Date endpoints return 404. `/match/[date]` shows a "No match found" message. |
| Future date requested | Date endpoints return 400. |
| Past fixture exists but no Gemini story yet | Generated on-demand, cached, returned. |

---

## Testing

- `tests/test_api.py`: add tests for `GET /matches`, `GET /match-story/{date}` (cache hit, cache miss, 404, 400 for future date)
- `tests/test_services.py`: no new service logic — existing tests cover `generate_story`, `generate_trivia`
- Manual smoke test: seed schedule, hit `/matches`, click through to a past date
