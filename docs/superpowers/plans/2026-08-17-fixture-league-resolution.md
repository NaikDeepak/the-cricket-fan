# Fixture League Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fixtures.league` hold a real canonical league label (e.g.
`"IPL"`) instead of a full match-description string, by resolving
CricAPI's `series_id` through its `series_info` endpoint and a curated
keyword table, cached in a new DB table so each tournament costs at most
1 API credit for its entire run.

**Architecture:** `CricApiProvider.fetch` (`bot/fixtures_provider.py`)
gains a DB-backed cache lookup + one-time `series_info` API call per
unseen `series_id`, feeding a keyword-matched canonical label back into
the existing `_resolve_league` fallback chain. Everything fails soft:
missing `series_id`, an unmatched tournament name, or an API error all
fall through to today's existing raw-name behavior — ingestion never
breaks on a resolution miss.

**Tech Stack:** Python 3.12, SQLAlchemy 2.0 Core (sync), httpx, pytest.

**Spec:** `docs/superpowers/specs/2026-08-17-fixture-league-resolution-design.md`

## Global Constraints

- Python line length: 99 chars (ruff enforced), per `CLAUDE.md`.
- No new external dependencies — `httpx` and `sqlalchemy` are already in
  `bot/requirements.txt`.
- `bot/fixtures_provider.py` stays fully synchronous (`httpx.Client`, not
  `AsyncClient`) — matches the existing file's convention; do not
  introduce `async def`.
- Follow existing test conventions exactly: `bot/tests/test_db_schema.py`
  uses the `_engine()` + `metadata.create_all` + `ensure_schema` pattern
  already in that file; `bot/tests/test_provider.py` uses
  `httpx.MockTransport` with a handler function passed to
  `CricApiProvider(..., client=httpx.Client(transport=httpx.MockTransport(handler)))`,
  and the `conn` fixture (from `engine`, seeds `aliases`, yields a live
  transaction) already defined at the top of that file — reuse it, don't
  redefine it.
- No backfill of `fixtures.league`/`predictions.league` on rows already
  ingested before this change — this plan only affects fixtures ingested
  after it lands.
- Out of scope, confirmed not touched: `composer/routers/predictions.py`
  (routing the override list into `run_model` already works — this plan
  only fixes the label it compares against), `bot/run.py::tick`,
  `composer/routers/generate.py`, `composer/routers/live_predict.py`
  (routing them through `league_elo_override` is a separate follow-up
  plan per the spec's Non-goals), `bot/gating.py`, `bot/elo.py`.
- `fetch()`'s existing `is_supported_format` check
  (`bot/fixtures_provider.py:74-82`) reads `m.get("series")`, which is
  also always absent in live payloads — making that half of the check
  dead code today. It doesn't cause incorrect filtering (matchType alone
  already discriminates correctly in observed live data) so it's left
  untouched; not a defect this plan introduces or is asked to fix.

---

### Task 1: `resolved_leagues` cache table

**Files:**
- Modify: `bot/db.py` (insert a new table definition after `aliases`,
  before `fixtures` — currently lines 38-40)
- Test: `bot/tests/test_db_schema.py`

**Interfaces:**
- Produces: `bot.db.resolved_leagues` — a `sa.Table` with columns
  `series_id` (str, primary key), `series_name` (str), `canonical_league`
  (str, nullable), `resolved_at` (datetime, tz-aware). Task 3 imports and
  uses this table directly; no other interface.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_db_schema.py`. First, add `resolved_leagues` to
the existing import line at the top of the file:

```python
from bot.db import content_bank, ensure_schema, metadata, predictions, resolved_leagues
```

Then add these two tests (append to the end of the file):

```python
def test_resolved_leagues_table_columns():
    assert {c.name for c in resolved_leagues.c} == {
        "series_id",
        "series_name",
        "canonical_league",
        "resolved_at",
    }
    assert resolved_leagues.c.series_id.primary_key is True
    assert resolved_leagues.c.canonical_league.nullable is True
    assert resolved_leagues.c.series_name.nullable is False


def test_resolved_leagues_created_by_ensure_schema_and_roundtrips():
    eng = _engine()
    metadata.create_all(eng)
    with eng.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            resolved_leagues.insert().values(
                series_id="s1",
                series_name="Indian Premier League 2026",
                canonical_league="IPL",
                resolved_at=datetime.now(timezone.utc),
            )
        )
        row = conn.execute(
            sa.select(resolved_leagues).where(resolved_leagues.c.series_id == "s1")
        ).first()
        assert row.canonical_league == "IPL"
        assert row.series_name == "Indian Premier League 2026"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py -v`
Expected: FAIL — `ImportError: cannot import name 'resolved_leagues' from
'bot.db'` (the table doesn't exist yet).

- [ ] **Step 3: Implement — add the table**

In `bot/db.py`, insert this table definition immediately after the
`aliases` table's closing `)` (currently line 38) and before the
`fixtures` table (currently line 40):

```python
resolved_leagues = sa.Table(
    "resolved_leagues",
    metadata,
    sa.Column("series_id", sa.String(64), primary_key=True),
    sa.Column("series_name", sa.String(256), nullable=False),
    # raw name from CricAPI's series_info, kept for debugging keyword misses
    sa.Column("canonical_league", sa.String(32), nullable=True),
    # NULL = series_info succeeded but no keyword matched (cached as a
    # confirmed miss, so it isn't re-fetched on the next ingestion run)
    sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=False),
)
```

No `ensure_schema` migration DDL is needed — `metadata.create_all(conn)`
(the first line of `ensure_schema`, `bot/db.py:210`) creates any new
table automatically on any dialect.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full bot test suite**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS (confirms nothing else broke).

- [ ] **Step 6: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/db.py bot/tests/test_db_schema.py && bot/.venv/bin/python -m ruff format --check bot/db.py bot/tests/test_db_schema.py`

- [ ] **Step 7: Commit**

```bash
git add bot/db.py bot/tests/test_db_schema.py
git commit -m "feat(bot): add resolved_leagues cache table for series_id resolution"
```

---

### Task 2: Keyword table + pure matcher function

**Files:**
- Create: `bot/league_keywords.py`
- Test: `bot/tests/test_league_keywords.py`

**Interfaces:**
- Consumes: nothing (pure function, no DB, no I/O).
- Produces: `bot.league_keywords.match_league_keyword(series_name: str) -> str | None`
  and `bot.league_keywords.LEAGUE_KEYWORDS: list[tuple[str, str]]`. Task 3
  imports `match_league_keyword` and calls it with the raw name string
  returned by CricAPI's `series_info` endpoint.

- [ ] **Step 1: Write the failing tests**

Create `bot/tests/test_league_keywords.py`:

```python
from bot.league_keywords import match_league_keyword


def test_matches_ipl():
    assert match_league_keyword("Indian Premier League 2026") == "IPL"


def test_matches_mens_t20_blast():
    assert match_league_keyword("Vitality T20 Blast 2026") == "T20 Blast"


def test_matches_womens_t20_blast_not_mens_keyword():
    # Regression: "women's t20 blast" contains "t20 blast" as a substring,
    # so ordering must put the women's entry first or this returns the
    # men's label instead.
    assert (
        match_league_keyword("Vitality Women's T20 Blast 2026")
        == "Women's T20 Blast"
    )


def test_matches_super_smash_women_not_mens_keyword():
    assert (
        match_league_keyword("Dream11 Super Smash Women 2026")
        == "Super Smash Women"
    )


def test_matches_mens_super_smash():
    assert match_league_keyword("Dream11 Super Smash 2026") == "Super Smash"


def test_case_insensitive():
    assert match_league_keyword("INDIAN PREMIER LEAGUE 2026") == "IPL"


def test_no_match_returns_none():
    assert (
        match_league_keyword("Women's T20I Quadrangular Series in Namibia 2026")
        is None
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_league_keywords.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'bot.league_keywords'`.

- [ ] **Step 3: Implement**

Create `bot/league_keywords.py`:

```python
"""Keyword table mapping CricAPI series_info tournament names to the
canonical short league labels bot/scripts/ingest_all_leagues.py's LEAGUES
list defines.

Ordering is load-bearing: a women's competition's keyword is checked
before its men's counterpart's keyword, because e.g. "women's t20 blast"
contains "t20 blast" as a substring and would otherwise match the men's
entry first.

Deliberately excludes (see docs/superpowers/specs/2026-08-17-fixture-
league-resolution-design.md's "Keyword table" section for why):
- "The Hundred" / "The Hundred Women" — handled by
  bot/fixtures_provider.py::_resolve_league's existing dedicated
  substring check against the match name, before this table is
  consulted at all.
- "T20I" / "WT20I" — no single stable series name across bilateral
  tours; the raw-name fallback already carries enough signal.
- "WSL" / "Women's T20 Challenge" — real-world CricAPI naming for these
  two wasn't confirmed at design time; add entries here once known,
  following the same (keyword, canonical_label) tuple shape.
"""

LEAGUE_KEYWORDS: list[tuple[str, str]] = [
    ("indian premier league", "IPL"),
    ("big bash league", "BBL"),
    ("pakistan super league", "PSL"),
    ("caribbean premier league", "CPL"),
    ("sa20", "SA20"),
    ("major league cricket", "MLC"),
    ("international league t20", "ILT20"),
    ("lanka premier league", "LPL"),
    ("bangladesh premier league", "BPL"),
    ("mzansi super league", "MSL"),
    ("nepal premier league", "NPL"),
    ("csa t20", "CSA T20"),
    ("syed mushtaq ali", "SMAT"),
    ("women's premier league", "WPL"),
    ("women's big bash", "WBBL"),
    ("women's caribbean premier league", "WCPL"),
    ("charlotte edwards cup", "Charlotte Edwards Cup"),
    ("women's t20 blast", "Women's T20 Blast"),  # before the bare entry below
    ("t20 blast", "T20 Blast"),
    ("super smash women", "Super Smash Women"),  # before the bare entry below
    ("super smash", "Super Smash"),
    ("fairbreak", "FairBreak"),
]


def match_league_keyword(series_name: str) -> str | None:
    """Case-insensitive substring match against LEAGUE_KEYWORDS, in order.
    Returns the first matching canonical label, or None if nothing
    matches — callers fall back to the existing raw-name behavior.
    """
    low = series_name.lower()
    for keyword, label in LEAGUE_KEYWORDS:
        if keyword in low:
            return label
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_league_keywords.py -v`
Expected: all 7 PASS.

- [ ] **Step 5: Run the full bot test suite**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS.

- [ ] **Step 6: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/league_keywords.py bot/tests/test_league_keywords.py && bot/.venv/bin/python -m ruff format --check bot/league_keywords.py bot/tests/test_league_keywords.py`

- [ ] **Step 7: Commit**

```bash
git add bot/league_keywords.py bot/tests/test_league_keywords.py
git commit -m "feat(bot): add curated league-keyword matcher for series_info resolution"
```

---

### Task 3: Wire `series_id` resolution into `_resolve_league` + `fetch()`

**Files:**
- Modify: `bot/fixtures_provider.py` (the `_resolve_league` function,
  currently lines 19-35, and its call site inside `fetch`, currently
  line 100)
- Modify: `bot/tests/data/provider_matches.json` (replace `"series"`
  fields with `"series_id"` to match live CricAPI shape)
- Test: `bot/tests/test_provider.py`

**Interfaces:**
- Consumes: `bot.db.resolved_leagues` (Task 1),
  `bot.league_keywords.match_league_keyword` (Task 2).
- Produces: `_resolve_league(conn, client, api_key, base_url, m: dict) -> str`
  (signature change — was `_resolve_league(m: dict) -> str`). No other
  module calls this function; its only call site is `fetch()` in the
  same file.

- [ ] **Step 1: Update the test data file**

Replace the contents of `bot/tests/data/provider_matches.json` — same
5 records, `"series"` fields replaced with `"series_id"` (matching the
live CricAPI shape confirmed in the spec; no test in
`bot/tests/test_provider.py` asserts `.league` on these specific
records, so this is a pure shape fix, not a behavior change):

```json
{
  "status": "success",
  "data": [
    {
      "id": "up-1",
      "name": "Royal Challengers Bangalore vs Chennai Super Kings",
      "matchType": "t20",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-20T14:00:00",
      "teams": ["Royal Challengers Bangalore", "Chennai Super Kings"],
      "series_id": "series-ipl-2026",
      "matchStarted": false,
      "matchEnded": false
    },
    {
      "id": "done-1",
      "name": "Mumbai Indians vs Kolkata Knight Riders",
      "matchType": "t20",
      "status": "Mumbai Indians won by 5 wkts",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-18T14:00:00",
      "teams": ["Mumbai Indians", "Kolkata Knight Riders"],
      "series_id": "series-ipl-2026",
      "matchStarted": true,
      "matchEnded": true,
      "matchWinner": "Mumbai Indians"
    },
    {
      "id": "nr-1",
      "name": "Delhi Capitals vs Punjab Kings",
      "matchType": "t20",
      "status": "Match abandoned due to rain",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-18T10:00:00",
      "teams": ["Delhi Capitals", "Punjab Kings"],
      "series_id": "series-ipl-2026",
      "matchStarted": true,
      "matchEnded": true
    },
    {
      "id": "unknown-1",
      "name": "Gotham Galacticos vs Chennai Super Kings",
      "matchType": "t20",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-21T14:00:00",
      "teams": ["Gotham Galacticos", "Chennai Super Kings"],
      "series_id": "series-ipl-2026",
      "matchStarted": false,
      "matchEnded": false
    },
    {
      "id": "odi-1",
      "name": "India vs Australia",
      "matchType": "odi",
      "status": "Match not started",
      "venue": "M.Chinnaswamy Stadium",
      "dateTimeGMT": "2026-07-22T09:00:00",
      "teams": ["India", "Australia"],
      "series_id": "series-odi-2026",
      "matchStarted": false,
      "matchEnded": false
    }
  ]
}
```

The `provider` fixture in `bot/tests/test_provider.py` (its handler
returns this same JSON for every request, regardless of URL) means
`series_info` calls triggered by these records will receive the
`currentMatches` list shape back — `resp.json()["data"]["info"]["name"]`
raises `KeyError` (`"data"` is a list here, not a dict), which Step 3's
implementation catches and falls back on. This is expected and does not
need a dedicated assertion — `test_fetch_resolves_and_splits` and
`test_unresolved_team_skipped_not_raised` (the two tests using this
fixture) don't assert `.league`, so behavior is unaffected; it
incidentally exercises the malformed-response fallback path already
covered explicitly by Step 2's new tests below.

- [ ] **Step 2: Write the failing tests**

Add to `bot/tests/test_provider.py`. First, update the imports at the
top of the file:

```python
from datetime import datetime, timezone
```

(add `datetime` to the existing `from datetime import timezone` line)
and add one more import line:

```python
import sqlalchemy as sa

from bot.db import resolved_leagues
```

Then append these five tests to the end of the file:

```python
def test_fetch_resolves_league_via_series_id_cache_hit(conn):
    conn.execute(
        resolved_leagues.insert().values(
            series_id="series-ipl-1",
            series_name="Indian Premier League 2026",
            canonical_league="IPL",
            resolved_at=datetime.now(timezone.utc),
        )
    )
    conn.commit()
    calls = {"series_info": 0}

    def handler(request):
        if "series_info" in str(request.url):
            calls["series_info"] += 1
            return httpx.Response(200, json={"data": {"info": {"name": "unused"}}})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "ipl-1",
                        "name": "Team A vs Team B",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-ipl-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert len(fixtures) == 1
    assert fixtures[0].league == "IPL"
    assert calls["series_info"] == 0


def test_fetch_resolves_league_via_series_id_cache_miss_matches_keyword(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(
                200,
                json={"data": {"info": {"name": "Pakistan Super League 2026"}}},
            )
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "psl-1",
                        "name": "Team A vs Team B",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-psl-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "PSL"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-psl-1"
        )
    ).first()
    assert row.canonical_league == "PSL"
    assert row.series_name == "Pakistan Super League 2026"


def test_fetch_resolves_league_via_series_id_cache_miss_no_keyword_match(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "data": {
                        "info": {
                            "name": "Womens T20I Quadrangular Series in Namibia 2026"
                        }
                    }
                },
            )
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "unmapped-1",
                        "name": "Team A vs Team B, Namibia Quadrangular",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-namibia-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Team A vs Team B, Namibia Quadrangular"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-namibia-1"
        )
    ).first()
    assert row.canonical_league is None


def test_fetch_uses_cached_null_without_recalling_series_info(conn):
    conn.execute(
        resolved_leagues.insert().values(
            series_id="series-unmapped-1",
            series_name="Some Unmapped Series 2026",
            canonical_league=None,
            resolved_at=datetime.now(timezone.utc),
        )
    )
    conn.commit()
    calls = {"series_info": 0}

    def handler(request):
        if "series_info" in str(request.url):
            calls["series_info"] += 1
            return httpx.Response(200, json={"data": {"info": {"name": "unused"}}})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "x-1",
                        "name": "Fallback Name String",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-unmapped-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Fallback Name String"
    assert calls["series_info"] == 0


def test_fetch_falls_back_when_series_info_call_fails(conn):
    def handler(request):
        if "series_info" in str(request.url):
            return httpx.Response(500, json={"error": "server error"})
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": [
                    {
                        "id": "err-1",
                        "name": "Some Match Description League 2026",
                        "matchType": "t20",
                        "teams": ["Chennai Super Kings", "Mumbai Indians"],
                        "venue": "M.Chinnaswamy Stadium",
                        "dateTimeGMT": "2026-08-14T14:00:00",
                        "series_id": "series-error-1",
                        "matchStarted": False,
                        "matchEnded": False,
                    }
                ],
            },
        )

    p = CricApiProvider(
        "https://api.example.com/v1",
        "k",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    fixtures, _ = p.fetch(conn)
    assert fixtures[0].league == "Some Match Description League 2026"

    row = conn.execute(
        sa.select(resolved_leagues).where(
            resolved_leagues.c.series_id == "series-error-1"
        )
    ).first()
    assert row is None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_provider.py -v`
Expected: FAIL — the 5 new tests fail (either `AttributeError` on
`fixtures[0].league` not matching, since `_resolve_league` doesn't yet
consult `resolved_leagues` or call `series_info`, or the assertions on
`row`/`calls["series_info"]` don't hold). The 4 pre-existing tests
should still PASS (their behavior is unaffected by the data file's
`series` → `series_id` rename, per Step 1's note).

- [ ] **Step 4: Implement — replace `_resolve_league` and update `fetch()`**

In `bot/fixtures_provider.py`, update the imports at the top of the file
(replace lines 1-16):

```python
"""Swappable adapter over a free cricket API (CricAPI currentMatches shape).

Hard-fail rule applied here: unresolved team/venue -> match skipped + logged.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
import sqlalchemy as sa

from .aliases import UnresolvedEntityError, resolve
from .db import resolved_leagues
from .league_keywords import match_league_keyword

logger = logging.getLogger(__name__)

ABANDONED_MARKERS = ("abandoned", "no result")
```

Replace `_resolve_league` (currently lines 19-35) with:

```python
def _resolve_league(
    conn, client: httpx.Client, api_key: str, base_url: str, m: dict
) -> str:
    """Resolves a fixture's league label.

    CricAPI omits `series` entirely from currentMatches (confirmed live,
    see docs/superpowers/specs/2026-08-17-fixture-league-resolution-design.md)
    — only `series_id` (a UUID) is present. This falls back to the raw
    match-description `name` string (with a dedicated substring check for
    The Hundred, whose competition name only appears in `name`, never in
    a resolvable series) unless `series_id` is present and resolvable via
    CricAPI's series_info endpoint + the curated keyword table in
    bot/league_keywords.py — cached in resolved_leagues so each
    tournament costs at most one series_info API call for its entire run,
    not one per match. Every failure mode (missing series_id, unmatched
    keyword, API error) falls through to the raw-name fallback —
    ingestion must never break on a resolution miss.
    """
    raw = m.get("series") or m.get("name") or ""
    low = raw.lower()
    if "hundred" in low:
        fallback = "The Hundred Women" if "women" in low else "The Hundred"
    else:
        fallback = raw or "T20"

    series_id = m.get("series_id")
    if not series_id:
        return fallback

    cached = conn.execute(
        sa.select(resolved_leagues.c.canonical_league).where(
            resolved_leagues.c.series_id == series_id
        )
    ).first()
    if cached is not None:
        return cached.canonical_league or fallback

    try:
        resp = client.get(
            f"{base_url}/series_info", params={"apikey": api_key, "id": series_id}
        )
        resp.raise_for_status()
        series_name = resp.json()["data"]["info"]["name"]
    except Exception as exc:
        logger.warning(
            "series_info lookup failed for series_id=%s: %s", series_id, exc
        )
        return fallback

    canonical = match_league_keyword(series_name)
    conn.execute(
        resolved_leagues.insert().values(
            series_id=series_id,
            series_name=series_name,
            canonical_league=canonical,
            resolved_at=datetime.now(timezone.utc),
        )
    )
    return canonical or fallback
```

Update the call site inside `fetch` (currently line 100, inside the
`Fixture(...)` construction) from:

```python
                        league=_resolve_league(m),
```

to:

```python
                        league=_resolve_league(
                            conn, self.client, self.api_key, self.base_url, m
                        ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/test_provider.py -v`
Expected: all 9 tests PASS (4 pre-existing + 5 new).

- [ ] **Step 6: Run the full bot test suite**

Run: `PYTHONPATH=. bot/.venv/bin/python -m pytest bot/tests/ -v`
Expected: all PASS.

- [ ] **Step 7: Lint**

Run: `bot/.venv/bin/python -m ruff check bot/fixtures_provider.py bot/tests/test_provider.py && bot/.venv/bin/python -m ruff format --check bot/fixtures_provider.py bot/tests/test_provider.py`

- [ ] **Step 8: Commit**

```bash
git add bot/fixtures_provider.py bot/tests/test_provider.py bot/tests/data/provider_matches.json
git commit -m "feat(bot): resolve fixtures.league via series_id + series_info, cached"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-08-17-fixture-league-resolution-design.md`):
- ✅ Data model (`resolved_leagues` table, exact columns/types) — Task 1.
- ✅ Keyword table (22 of 28 labels, ordered list not dict, women's-before-men's) — Task 2.
- ✅ Resolution flow (missing series_id, cache hit, cache miss + match,
  cache miss + no match, API error — all 5 branches) — Task 3.
- ✅ No `ensure_schema` migration DDL needed, relies on `create_all` —
  Task 1 confirms this explicitly rather than adding unneeded DDL.
- ✅ Testing: realistic `provider_matches.json` shape, no live network
  calls, cache-hit call-count assertion — Task 3.
- ✅ Rollout: no backfill — stated in Global Constraints, no task
  attempts one.
- ✅ Open question (re-resolve script for updated keyword entries) —
  resolved per spec's own default: not built, no task for it.

**Placeholder scan:** no `TBD`/`TODO`/"add appropriate" phrasing across
all 3 tasks; every step has complete, runnable code.

**Type consistency:** `_resolve_league`'s new signature
`(conn, client, api_key, base_url, m)` is used identically at its one
call site in Task 3 Step 4. `match_league_keyword(series_name: str) -> str | None`
(Task 2) is called with `series_name` from `resp.json()["data"]["info"]["name"]`
(a `str`) in Task 3 — consistent. `resolved_leagues.c.canonical_league`
is nullable (Task 1) and every read site in Task 3 handles the `None`
case (`cached.canonical_league or fallback`, `canonical or fallback`) —
consistent.

**Out of scope, confirmed not touched:** `composer/routers/predictions.py`,
`bot/run.py::tick`, `composer/routers/generate.py`,
`composer/routers/live_predict.py`, `bot/gating.py`, `bot/elo.py` — no
task modifies any of these.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-17-fixture-league-resolution.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
