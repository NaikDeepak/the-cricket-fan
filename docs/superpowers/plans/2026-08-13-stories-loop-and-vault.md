# Stories Loop & Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire harvest → content_bank → composer → posted → `/stories` into one visible loop, and rebuild the public `/stories` surface (vault, detail pages, share cards, motion) on the Press Box design system.

**Architecture:** Backend adds three small endpoints to the existing composer FastAPI app (`/stories/wire`, publish PATCH, `/generate/recap`) plus a schema-default fix in `bot/db.py`. Frontend rebuilds `/stories` (App Router) with Press Box tokens, adds a `/stories/[contentKey]` detail route replacing the modal, a `StoryCardImg` PNG export, and a GSAP motion pass.

**Tech Stack:** FastAPI + SQLAlchemy Core (sync) + pytest; Next.js 16 App Router + React 19 + Tailwind v4 tokens + vitest/happy-dom; `html-to-image` (already installed); GSAP (installed in Task 9).

**Spec:** `docs/superpowers/specs/2026-08-13-stories-loop-and-vault-design.md`

## Global Constraints

- Sync SQLAlchemy Core throughout composer/bot; never async ORM.
- Timestamps and defaults explicit at insert time; no `server_default` in table metadata.
- `bot` never imports `composer`; composer importing `bot` is fine.
- Python via `bot/.venv/bin/python` only. Ruff line length 99: `bot/.venv/bin/python -m ruff check composer/ bot/`.
- Backend tests: `bot/.venv/bin/python -m pytest composer/tests/ bot/tests/ -q`.
- Frontend: App Router only; check `frontend/node_modules/next/dist/docs/` before using unfamiliar Next.js APIs; Tailwind v4 CSS tokens from `frontend/src/app/globals.css` (`--wire-red`, `--floodlight-cyan`, `--space-*`, `--ease-out-quart`, `--duration-*`, `ds-*` classes); no raw data tables in UI.
- Frontend tests: `cd frontend && npx vitest run`.
- The composer test suite's sqlite engine must keep passing; Postgres-only DDL goes in the `conn.dialect.name == "postgresql"` branch of `ensure_schema`.
- Brand strings: `#TheCricketFan`, "THE CRICKET FAN". Date stamp format "13 AUG 2008".

---

### Task 1: Fix `is_published` server_default

**Files:**
- Modify: `bot/db.py` (column def ~line 126, `ensure_schema` story_cols ~line 223)
- Test: `bot/tests/test_db_schema.py` (create)

**Interfaces:**
- Produces: `content_bank.c.is_published` — `Boolean, nullable=False, default=True` (client-side default; inserts omitting it get `True`). Later tasks read/write this column.

- [ ] **Step 1: Write the failing test**

Create `bot/tests/test_db_schema.py`:

```python
import json
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.pool import StaticPool

from bot.db import content_bank, ensure_schema, metadata


def _engine():
    return sa.create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_is_published_has_no_server_default():
    # Convention: defaults explicit at insert time. server_default=sa.text("1")
    # also breaks Postgres (1 is not a boolean literal).
    assert content_bank.c.is_published.server_default is None
    assert content_bank.c.is_published.default is not None
    assert content_bank.c.is_published.default.arg is True


def test_insert_without_is_published_defaults_true():
    eng = _engine()
    metadata.create_all(eng)
    with eng.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:test",
                category="story",
                format="single",
                segments_json=json.dumps(["a"]),
                source="test",
                created_at=datetime.now(timezone.utc),
            )
        )
    with eng.connect() as conn:
        row = conn.execute(sa.select(content_bank)).one()
    assert row.is_published is True
    eng.dispose()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py -v`
Expected: `test_is_published_has_no_server_default` FAILS (server_default is set); second test passes today — that's fine, it pins behavior the fix must keep.

- [ ] **Step 3: Fix the column and the ALTER**

In `bot/db.py`, change the column definition:

```python
    sa.Column("is_published", sa.Boolean, nullable=False, default=True),
```

(was `nullable=False, server_default=sa.text("1")`).

In `ensure_schema`'s `story_cols` dict, change:

```python
        "is_published": "BOOLEAN NOT NULL DEFAULT TRUE",
```

(was `"BOOLEAN DEFAULT 1"` — `1` is not a valid Postgres boolean literal; `TRUE` is valid on both dialects, and SQLite's ALTER ADD COLUMN accepts NOT NULL when a default is present.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest bot/tests/test_db_schema.py composer/tests/ bot/tests/ -q`
Expected: all PASS (harvest/seed scripts already pass `is_published=True` explicitly; client default covers everything else).

- [ ] **Step 5: Lint and commit**

```bash
bot/.venv/bin/python -m ruff check bot/ composer/
git add bot/db.py bot/tests/test_db_schema.py
git commit -m "fix(db): replace invalid is_published server_default with client-side default"
```

---

### Task 2: `GET /stories/wire`

**Files:**
- Modify: `composer/routers/stories.py`, `composer/schemas.py`
- Test: `composer/tests/test_stories.py`

**Interfaces:**
- Consumes: `drafts` table from `bot.db` (`status`, `posted_at`, `category`, `text`, `content_key`).
- Produces: `GET /stories/wire?limit=12` → `list[WireItemOut]`; `WireItemOut(id: int, category: str | None, text: str, posted_at: datetime, content_key: str | None)`. Frontend Task 6 consumes this shape.

- [ ] **Step 1: Write the failing test**

Append to `composer/tests/test_stories.py`:

```python
def test_wire_returns_posted_drafts_newest_first(client, engine):
    from bot.db import drafts

    with engine.begin() as conn:
        ensure_schema(conn)
        for i, (status, posted_at) in enumerate(
            [
                ("draft", None),
                ("posted", datetime(2026, 8, 1, tzinfo=timezone.utc)),
                ("posted", datetime(2026, 8, 10, tzinfo=timezone.utc)),
            ]
        ):
            conn.execute(
                drafts.insert().values(
                    source="bank",
                    category="record",
                    text=f"tweet {i}",
                    status=status,
                    created_at=datetime(2026, 7, 30, tzinfo=timezone.utc),
                    posted_at=posted_at,
                )
            )

    res = client.get("/stories/wire")
    assert res.status_code == 200
    items = res.json()
    assert [i["text"] for i in items] == ["tweet 2", "tweet 1"]  # posted only, newest first
    assert items[0]["posted_at"] is not None

    res_limited = client.get("/stories/wire?limit=1")
    assert len(res_limited.json()) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_stories.py::test_wire_returns_posted_drafts_newest_first -v`
Expected: FAIL — `/stories/wire` currently matches the `/stories/{content_key}` route and returns 404 "Story not found".

- [ ] **Step 3: Implement**

In `composer/schemas.py`, after `StoryOut`:

```python
class WireItemOut(BaseModel):
    id: int
    category: str | None = None
    text: str
    posted_at: object
    content_key: str | None = None
```

(`posted_at: object` matches the existing `DraftOut` idiom in this file.)

In `composer/routers/stories.py`: add `drafts` to the `bot.db` import and `WireItemOut` to the schemas import, then add the route **above** `get_story_by_key` — FastAPI matches routes in declaration order, and `/stories/wire` must not be captured by `/stories/{content_key}`:

```python
@router.get("/stories/wire", response_model=list[WireItemOut])
def get_wire(limit: int = 12, conn=Depends(get_conn)) -> list[WireItemOut]:
    rows = conn.execute(
        sa.select(drafts)
        .where(drafts.c.status == "posted")
        .order_by(drafts.c.posted_at.desc(), drafts.c.id.desc())
        .limit(limit)
    ).all()
    return [
        WireItemOut(
            id=r.id,
            category=r.category,
            text=r.text,
            posted_at=r.posted_at,
            content_key=r.content_key,
        )
        for r in rows
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bot/.venv/bin/python -m pytest composer/tests/ -q`
Expected: all PASS (including existing `get_story_by_key` tests — route order preserved for `/stories/contextual` too).

- [ ] **Step 5: Lint and commit**

```bash
bot/.venv/bin/python -m ruff check composer/
git add composer/routers/stories.py composer/schemas.py composer/tests/test_stories.py
git commit -m "feat(composer): /stories/wire endpoint - public archive of posted drafts"
```

---

### Task 3: Publish toggle — PATCH endpoint, vault filtering, bank eye icon

**Files:**
- Modify: `composer/routers/content_bank.py`, `composer/routers/stories.py`, `composer/schemas.py`
- Modify: `frontend/src/lib/composerApi.ts`, `frontend/src/components/composer/SourceBar.tsx`
- Test: `composer/tests/test_content_bank.py` (append; create if missing), `composer/tests/test_stories.py`

**Interfaces:**
- Produces: `PATCH /content-bank/{id}/publish` body `{"is_published": bool}` → 200 `ContentBankOut`; 404 for unknown id. `ContentBankOut` gains `id: int` and `is_published: bool = True`. `GET /stories` and `/stories/contextual` exclude unpublished items; `GET /stories/{content_key}` still returns them (direct links keep working; only listings hide). Frontend: `composerApi.setBankPublished(id, is_published)`.

- [ ] **Step 1: Write the failing backend tests**

Append to `composer/tests/test_stories.py`:

```python
def _insert_bank_row(conn, key: str, published: bool = True) -> None:
    conn.execute(
        content_bank.insert().values(
            content_key=key,
            category="story",
            format="single",
            segments_json=json.dumps([f"segment for {key}"]),
            source="test",
            title=key,
            summary="s",
            created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
            is_published=published,
        )
    )


def test_unpublished_hidden_from_listings_but_direct_fetch_works(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        _insert_bank_row(conn, "story:visible", published=True)
        _insert_bank_row(conn, "story:hidden", published=False)

    keys = [s["content_key"] for s in client.get("/stories").json()]
    assert "story:visible" in keys
    assert "story:hidden" not in keys

    assert client.get("/stories/story:hidden").status_code == 200


def test_publish_patch_flips_flag(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        _insert_bank_row(conn, "story:flipme", published=True)

    items = client.get("/content-bank").json()
    item = next(i for i in items if i["content_key"] == "story:flipme")
    assert item["is_published"] is True

    res = client.patch(
        f"/content-bank/{item['id']}/publish", json={"is_published": False}
    )
    assert res.status_code == 200
    assert res.json()["is_published"] is False

    keys = [s["content_key"] for s in client.get("/stories").json()]
    assert "story:flipme" not in keys

    assert client.patch("/content-bank/99999/publish", json={"is_published": True}).status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_stories.py -v`
Expected: FAIL — no `id`/`is_published` in ContentBankOut, no PATCH route, listings don't filter.

- [ ] **Step 3: Implement backend**

`composer/schemas.py` — extend `ContentBankOut` and add the patch body:

```python
class ContentBankOut(BaseModel):
    id: int
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str
    last_used_days: int | None = None
    event_month_day: str | None = None
    on_this_day: bool = False
    is_published: bool = True


class PublishIn(BaseModel):
    is_published: bool
```

`composer/routers/content_bank.py` — in `list_content_bank`, pass the new fields when building each `ContentBankOut` (`id=r.id`, `is_published=bool(r.is_published) if r.is_published is not None else True`), then add:

```python
from fastapi import HTTPException

from ..schemas import ContentBankOut, PublishIn


@router.patch("/content-bank/{item_id}/publish", response_model=ContentBankOut)
def set_published(item_id: int, body: PublishIn, conn=Depends(get_conn)) -> ContentBankOut:
    row = conn.execute(
        sa.select(content_bank).where(content_bank.c.id == item_id)
    ).first()
    if row is None:
        raise HTTPException(404, f"content bank item {item_id} not found")
    conn.execute(
        sa.update(content_bank)
        .where(content_bank.c.id == item_id)
        .values(is_published=body.is_published)
    )
    conn.commit()
    r = conn.execute(
        sa.select(content_bank).where(content_bank.c.id == item_id)
    ).one()
    return ContentBankOut(
        id=r.id,
        content_key=r.content_key,
        category=r.category,
        format=r.format,
        segments=json.loads(r.segments_json),
        source=r.source,
        event_month_day=r.event_month_day,
        is_published=bool(r.is_published),
    )
```

`composer/routers/stories.py` — hide unpublished from both listings. In `list_stories`, add to the base query:

```python
    q = q.where(
        sa.or_(
            content_bank.c.is_published.is_(True),
            content_bank.c.is_published.is_(None),  # pre-migration rows count as published
        )
    )
```

In `get_contextual_stories`, apply the same `where` to its `sa.select(content_bank)`. Also harden `_row_to_story`:

```python
        is_published=bool(r.is_published) if r.is_published is not None else True,
```

- [ ] **Step 4: Run backend tests**

Run: `bot/.venv/bin/python -m pytest composer/tests/ -q`
Expected: all PASS.

- [ ] **Step 5: Frontend — API method and eye toggle**

`frontend/src/lib/composerApi.ts`: add `id: number;` and `is_published: boolean;` to `ContentBankItem`, and add to `composerApi`:

```ts
  setBankPublished: (id: number, is_published: boolean) =>
    req<ContentBankItem>(`/content-bank/${id}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ is_published }),
    }),
```

`frontend/src/components/composer/SourceBar.tsx`: inside the bank item button's header row (next to the chips), add an eye toggle. The bank item is currently one big `<button>`; nested buttons are invalid HTML — change the eye control to a `<span role="button">` with `onClick` that stops propagation:

```tsx
<span
  role="button"
  tabIndex={0}
  aria-label={item.is_published ? "Unpublish from vault" : "Publish to vault"}
  title={item.is_published ? "Visible in Vault — click to hide" : "Hidden from Vault — click to show"}
  onClick={async (e) => {
    e.stopPropagation();
    const updated = await composerApi.setBankPublished(item.id, !item.is_published);
    setBankItems((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, is_published: updated.is_published } : b))
    );
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (e.target as HTMLElement).click();
    }
  }}
  style={{
    marginLeft: "auto",
    cursor: "pointer",
    opacity: item.is_published ? 1 : 0.4,
    fontSize: 14,
  }}
>
  {item.is_published ? "👁" : "🚫"}
</span>
```

- [ ] **Step 6: Frontend test**

`frontend/src/components/composer/__tests__/SourceBar.test.tsx` already mocks `composerApi.contentBank`. Update its fixture items to include `id` and `is_published` (TypeScript will force this), and add:

```tsx
it("toggles bank item publish state via the eye control", async () => {
  // fixture: one item with id: 1, is_published: true
  vi.mocked(composerApi.setBankPublished).mockResolvedValue({
    ...bankItem,
    is_published: false,
  });
  render(<SourceBar onCreated={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /browse bank/i }));
  await screen.findByText(bankItem.segments[0]);
  fireEvent.click(screen.getByLabelText("Unpublish from vault"));
  await waitFor(() =>
    expect(composerApi.setBankPublished).toHaveBeenCalledWith(1, false)
  );
});
```

(Adapt fixture/mocking names to the file's existing style — it already renders the bank list in other tests.)

Run: `cd frontend && npx vitest run src/components/composer/__tests__/SourceBar.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
bot/.venv/bin/python -m ruff check composer/
git add composer/ frontend/src/lib/composerApi.ts frontend/src/components/composer/SourceBar.tsx frontend/src/components/composer/__tests__/SourceBar.test.tsx
git commit -m "feat(composer): publish toggle - curate what the vault shows"
```

---

### Task 4: RECAP source — `/generate/recap`, `/teams`, SourceBar button

**Files:**
- Modify: `composer/routers/generate.py`, `composer/schemas.py`
- Modify: `frontend/src/lib/composerApi.ts`, `frontend/src/components/composer/SourceBar.tsx`
- Test: `composer/tests/test_generate.py` (append; create if missing following `test_stories.py` fixtures)

**Interfaces:**
- Consumes: `bot.news_fetcher.get_match_recap_tweet(team_a: str, team_b: str) -> str` (exists, tested, has offline fallback); `create_draft(conn, DraftIn, log_generated=True)` from `composer/routers/drafts.py`.
- Produces: `POST /generate/recap` body `{"team_a": str, "team_b": str}` → 201 `DraftOut` with `category="recap"`, `source="bot"`. `GET /teams` → `list[str]` (sorted, distinct). Frontend: `composerApi.generateRecap(team_a, team_b)`, `composerApi.teams()`.

- [ ] **Step 1: Write the failing backend tests**

In `composer/tests/test_generate.py` (create with the same `client, engine` fixtures usage as `test_stories.py` if the file doesn't exist):

```python
from datetime import datetime, timezone
from unittest.mock import patch

import sqlalchemy as sa

from bot.db import ensure_schema, fixtures, team_matches


def test_generate_recap_creates_draft(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)

    with patch(
        "composer.routers.generate.get_match_recap_tweet",
        return_value="CSK vs MI: Dhoni finishes it! #TheCricketFan",
    ) as mock_fetch:
        res = client.post("/generate/recap", json={"team_a": "CSK", "team_b": "MI"})

    assert res.status_code == 201
    draft = res.json()
    assert draft["category"] == "recap"
    assert draft["source"] == "bot"
    assert "Dhoni" in draft["text"]
    mock_fetch.assert_called_once_with("CSK", "MI")


def test_generate_recap_survives_rss_outage(client, engine):
    # news_fetcher catches network errors internally and returns a fallback
    # tweet; the endpoint must return 201 even with requests.get exploding.
    with engine.begin() as conn:
        ensure_schema(conn)

    with patch("requests.get", side_effect=OSError("network down")):
        res = client.post("/generate/recap", json={"team_a": "RCB", "team_b": "KKR"})

    assert res.status_code == 201
    assert "RCB" in res.json()["text"]


def test_teams_lists_distinct_sorted_names(client, engine):
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            team_matches.insert(),
            [
                {
                    "team": t,
                    "opponent": o,
                    "date": now.date(),
                    "season": "2026",
                    "league": "IPL",
                    "venue": "V",
                    "won": True,
                    "dls": False,
                }
                for t, o in [("MI", "CSK"), ("CSK", "MI")]
            ],
        )
        conn.execute(
            fixtures.insert().values(
                team_a="RCB",
                team_b="MI",
                venue="V",
                league="IPL",
                start_time=now,
                status="upcoming",
            )
        )

    res = client.get("/teams")
    assert res.status_code == 200
    assert res.json() == ["CSK", "MI", "RCB"]
```

(If `fixtures` insert needs more NOT NULL columns, check `bot/db.py:40-53` and supply them.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bot/.venv/bin/python -m pytest composer/tests/test_generate.py -v`
Expected: FAIL with 404/405 — routes don't exist.

- [ ] **Step 3: Implement backend**

`composer/schemas.py`:

```python
class GenerateRecapIn(BaseModel):
    team_a: str
    team_b: str
```

`composer/routers/generate.py` — add imports:

```python
from bot.db import drafts, fixtures, team_matches
from bot.news_fetcher import get_match_recap_tweet

from ..schemas import DraftIn, DraftOut, GenerateBotIn, GenerateLlmIn, GenerateRecapIn
```

and routes:

```python
@router.post("/generate/recap", response_model=DraftOut, status_code=201)
def generate_recap(body: GenerateRecapIn, conn=Depends(get_conn)) -> DraftOut:
    text = get_match_recap_tweet(body.team_a, body.team_b)
    return create_draft(
        conn,
        DraftIn(source="bot", category="recap", text=text),
        log_generated=True,
    )


@router.get("/teams", response_model=list[str])
def list_teams(conn=Depends(get_conn)) -> list[str]:
    names: set[str] = set()
    names.update(r[0] for r in conn.execute(sa.select(team_matches.c.team).distinct()))
    names.update(r[0] for r in conn.execute(sa.select(fixtures.c.team_a).distinct()))
    names.update(r[0] for r in conn.execute(sa.select(fixtures.c.team_b).distinct()))
    return sorted(n for n in names if n)
```

- [ ] **Step 4: Run backend tests**

Run: `bot/.venv/bin/python -m pytest composer/tests/ bot/tests/ -q`
Expected: all PASS.

- [ ] **Step 5: Frontend — API methods and RECAP UI**

`frontend/src/lib/composerApi.ts`:

```ts
  generateRecap: (team_a: string, team_b: string) =>
    req<Draft>("/generate/recap", {
      method: "POST",
      body: JSON.stringify({ team_a, team_b }),
    }),
  teams: () => req<string[]>("/teams"),
```

`frontend/src/components/composer/SourceBar.tsx` — new state + a third control group after the bot-kind group:

```tsx
const [teamA, setTeamA] = useState("");
const [teamB, setTeamB] = useState("");
const [teamNames, setTeamNames] = useState<string[]>([]);

useEffect(() => {
  composerApi.teams().then(setTeamNames).catch(() => setTeamNames([]));
}, []);
```

```tsx
<div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
  <input
    placeholder="Team A"
    value={teamA}
    onChange={(e) => setTeamA(e.target.value)}
    aria-label="recap team a"
    list="team-names"
    className="ds-input"
    style={{ width: 110 }}
  />
  <input
    placeholder="Team B"
    value={teamB}
    onChange={(e) => setTeamB(e.target.value)}
    aria-label="recap team b"
    list="team-names"
    className="ds-input"
    style={{ width: 110 }}
  />
  <datalist id="team-names">
    {teamNames.map((t) => (
      <option key={t} value={t} />
    ))}
  </datalist>
  <button
    onClick={() => run(() => composerApi.generateRecap(teamA, teamB))}
    disabled={busy || !teamA || !teamB}
    className="ds-btn-secondary"
  >
    Recap
  </button>
</div>
```

Also extend the explainer `<p>` with: `<strong>Recap</strong>: fetches the latest match-report headline from Google News RSS (works offline with a fallback line).`

- [ ] **Step 6: Frontend test**

Append to `SourceBar.test.tsx` (mock `composerApi.teams` to resolve `["CSK", "MI"]` alongside the file's existing mocks):

```tsx
it("creates a recap draft from two team names", async () => {
  const onCreated = vi.fn();
  vi.mocked(composerApi.generateRecap).mockResolvedValue(draftFixture);
  render(<SourceBar onCreated={onCreated} />);
  fireEvent.change(screen.getByLabelText("recap team a"), { target: { value: "CSK" } });
  fireEvent.change(screen.getByLabelText("recap team b"), { target: { value: "MI" } });
  fireEvent.click(screen.getByRole("button", { name: /recap/i }));
  await waitFor(() => expect(composerApi.generateRecap).toHaveBeenCalledWith("CSK", "MI"));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
});
```

Run: `cd frontend && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
bot/.venv/bin/python -m ruff check composer/
git add composer/ frontend/src/lib/composerApi.ts frontend/src/components/composer/SourceBar.tsx frontend/src/components/composer/__tests__/SourceBar.test.tsx
git commit -m "feat(composer): RECAP source - news_fetcher wired into the product"
```

---

### Task 5: Vault restyle — Press Box system, URL filters, loading/empty states

**Files:**
- Create: `frontend/src/lib/storiesFilters.ts`, `frontend/src/components/stories/StoryCard.tsx`
- Modify: `frontend/src/app/stories/page.tsx` (full rewrite), `frontend/src/app/globals.css`
- Test: `frontend/src/lib/__tests__/storiesFilters.test.ts`

**Interfaces:**
- Consumes: `storiesApi.listStories`, `Story` type (unchanged this task).
- Produces: `VaultFilters = { q: string; tag: string | null }`; `filtersFromSearchParams(sp: URLSearchParams): VaultFilters`; `queryStringFromFilters(f: VaultFilters): string` (empty string when no filters). `StoryCard({ story }: { story: Story })` grid card component (wrapped in `next/link` by Task 7; this task renders it as a plain card). `.ds-skeleton` CSS class. Tasks 6/7/9 build on this page structure.

- [ ] **Step 1: Write the failing filter tests**

`frontend/src/lib/__tests__/storiesFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filtersFromSearchParams, queryStringFromFilters } from "../storiesFilters";

describe("storiesFilters", () => {
  it("reads q and tag from search params", () => {
    const sp = new URLSearchParams("q=laxman&tag=comeback");
    expect(filtersFromSearchParams(sp)).toEqual({ q: "laxman", tag: "comeback" });
  });

  it("defaults to empty filters", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({ q: "", tag: null });
  });

  it("round-trips filters to a query string", () => {
    expect(queryStringFromFilters({ q: "laxman", tag: "comeback" })).toBe(
      "?q=laxman&tag=comeback"
    );
    expect(queryStringFromFilters({ q: "", tag: null })).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/__tests__/storiesFilters.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `storiesFilters.ts`**

```ts
export type VaultFilters = { q: string; tag: string | null };

export function filtersFromSearchParams(sp: URLSearchParams): VaultFilters {
  return { q: sp.get("q") ?? "", tag: sp.get("tag") };
}

export function queryStringFromFilters(f: VaultFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tag) p.set("tag", f.tag);
  const s = p.toString();
  return s ? `?${s}` : "";
}
```

Run the test again: PASS.

- [ ] **Step 4: Add skeleton CSS**

Append to `frontend/src/app/globals.css` next to the other `ds-*` rules:

```css
.ds-skeleton {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-height: 148px;
  animation: ds-skeleton-pulse 1.2s ease-in-out infinite;
}
@keyframes ds-skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

(The global `prefers-reduced-motion` block already zeroes animation durations.)

- [ ] **Step 5: `StoryCard.tsx`**

```tsx
import type { Story } from "@/lib/storiesApi";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "Record",
  anecdote: "Anecdote",
  story: "Story",
};

export default function StoryCard({ story }: { story: Story }) {
  return (
    <div className="ds-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-sm)",
        }}
      >
        <span className="ds-chip ds-chip-category">
          {CATEGORY_LABEL[story.category] ?? story.category}
        </span>
        {story.year && (
          <span className="text-micro" style={{ margin: 0 }}>
            {story.year}
          </span>
        )}
      </div>
      <p className="text-title" style={{ margin: "0 0 var(--space-sm) 0", color: "var(--fg)" }}>
        {story.title}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {story.summary}
      </p>
      <span
        className="text-micro"
        style={{ marginTop: "auto", paddingTop: "var(--space-md)", color: "var(--floodlight-cyan)" }}
      >
        Read story →
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `stories/page.tsx`**

Key requirements (write the full file; structure below is normative):

- `"use client"`. `useSearchParams` requires a Suspense boundary in Next 16 client pages — export default a thin wrapper: `export default function StoriesPage() { return <Suspense fallback={null}><Vault /></Suspense>; }` with the real component private to the file. Verify against `frontend/node_modules/next/dist/docs/` (search for `useSearchParams` / `missing-suspense-with-csr-bailout`) before assuming.
- Filters live in the URL: read with `filtersFromSearchParams(useSearchParams())`; every change calls `router.replace("/stories" + queryStringFromFilters(next), { scroll: false })` (from `next/navigation` `useRouter`). No local filter state besides a debounced text-input buffer for `q` (300ms `setTimeout` in `useEffect`, same idiom as `useDebouncedSave.ts`).
- Data: `storiesApi.listStories({ search: q || undefined })` on debounced `q` change; tag filtering client-side as today.
- Masthead: `<span className="text-micro">THE CRICKET FAN</span>`, `<h1 className="text-tool-headline">The Vault</h1>`, one-line sub in `var(--muted)`, and a `<Link href="/composer" className="ds-nav-link">Composer →</Link>` right-aligned.
- Search input: `className="ds-input"`. Tag pills: `ds-chip` with active pill styled `background: var(--wire-red); color: #fff`.
- Grid: `display: grid; gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"; gap: "var(--space-md)"` — auto-fill already gives the 3→2→1 responsive collapse.
- Loading: render 6 `<div className="ds-skeleton" />` in the grid, no "Loading…" text. Empty: centered `text-micro` "NOTHING IN THE VAULT FOR THAT FILTER" plus a plain sentence suggesting clearing filters.
- Every hex color from the old file (`#ffcb05`, `#00e5ff`, `#030407`, `rgba(255,255,255,…)`) is gone — tokens only. Card click still opens `StoryCardModal` this task (modal dies in Task 7).

- [ ] **Step 7: Verify**

Run: `cd frontend && npx vitest run && npm run build`
Expected: tests pass; build succeeds (build catches the Suspense/useSearchParams contract).

Manual check (composer API running per CLAUDE.md): open `http://localhost:3000/stories?tag=comeback` — pill pre-selected from URL, search updates URL, skeletons flash on load.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/stories/page.tsx frontend/src/app/globals.css frontend/src/lib/storiesFilters.ts frontend/src/lib/__tests__/storiesFilters.test.ts frontend/src/components/stories/StoryCard.tsx
git commit -m "feat(stories): vault restyled onto Press Box system with URL-linkable filters"
```

---

### Task 6: On This Day rail + Wire strip

**Files:**
- Modify: `composer/routers/stories.py`, `composer/schemas.py` (expose `event_month_day`), `frontend/src/lib/storiesApi.ts`, `frontend/src/app/stories/page.tsx`
- Create: `frontend/src/components/stories/OnThisDayRail.tsx`, `frontend/src/components/stories/WireStrip.tsx`
- Test: `composer/tests/test_stories.py`, `frontend/src/components/stories/__tests__/rails.test.tsx`

**Interfaces:**
- Consumes: `GET /stories/wire` (Task 2), `Story` type, `filtersFromSearchParams` page structure (Task 5).
- Produces: `StoryOut`/`Story` gain `event_month_day: str | null`. `storiesApi.getWire(limit?: number): Promise<WireItem[]>` with `WireItem = { id: number; category: string | null; text: string; posted_at: string; content_key: string | null }`. `OnThisDayRail({ stories }: { stories: Story[] })` and `WireStrip({ items }: { items: WireItem[] })` — both render `null` when their list is empty. `formatDateStamp(iso: string): string` → `"13 AUG 2026"` exported from `storiesApi.ts`.

- [ ] **Step 1: Failing backend test — `event_month_day` in StoryOut**

Append to `composer/tests/test_stories.py`:

```python
def test_story_exposes_event_month_day(client, engine):
    with engine.begin() as conn:
        ensure_schema(conn)
        conn.execute(
            content_bank.insert().values(
                content_key="story:dated",
                category="story",
                format="single",
                segments_json=json.dumps(["a"]),
                source="test",
                title="Dated",
                summary="s",
                event_month_day="08-13",
                created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
            )
        )
    s = client.get("/stories/story:dated").json()
    assert s["event_month_day"] == "08-13"
```

Run: `bot/.venv/bin/python -m pytest composer/tests/test_stories.py::test_story_exposes_event_month_day -v` — FAIL (field missing).

- [ ] **Step 2: Implement backend**

`composer/schemas.py` `StoryOut`: add `event_month_day: str | None = None`.
`composer/routers/stories.py` `_row_to_story`: add `event_month_day=r.event_month_day,`.

Run full composer tests: PASS.

- [ ] **Step 3: Frontend API additions**

`frontend/src/lib/storiesApi.ts` — add to `Story`: `event_month_day: string | null;`. Add:

```ts
export type WireItem = {
  id: number;
  category: string | null;
  text: string;
  posted_at: string;
  content_key: string | null;
};

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function formatDateStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function todayMonthDay(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${m}-${d}`;
}
```

and to `storiesApi`:

```ts
  getWire: (limit = 12) => req<WireItem[]>(`/stories/wire?limit=${limit}`),
```

- [ ] **Step 4: Failing component tests**

`frontend/src/components/stories/__tests__/rails.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnThisDayRail from "../OnThisDayRail";
import WireStrip from "../WireStrip";
import type { Story, WireItem } from "@/lib/storiesApi";

const story = {
  content_key: "story:dated",
  category: "story",
  format: "single",
  segments: ["a"],
  source: "test",
  title: "The Dated Classic",
  summary: "s",
  source_type: "wikipedia",
  source_ref: "ref",
  teams: [],
  players: [],
  venue: null,
  year: 2008,
  match_format: "Test",
  tags: [],
  is_published: true,
  event_month_day: "08-13",
} satisfies Story;

const wireItem: WireItem = {
  id: 1,
  category: "record",
  text: "posted tweet text",
  posted_at: "2026-08-10T12:00:00Z",
  content_key: null,
};

describe("OnThisDayRail", () => {
  it("renders nothing when no stories match", () => {
    const { container } = render(<OnThisDayRail stories={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders matching stories with the date stamp", () => {
    render(<OnThisDayRail stories={[story]} />);
    expect(screen.getByText(/on this day/i)).toBeInTheDocument();
    expect(screen.getByText("The Dated Classic")).toBeInTheDocument();
  });
});

describe("WireStrip", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<WireStrip items={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders posted items with date", () => {
    render(<WireStrip items={[wireItem]} />);
    expect(screen.getByText(/the wire/i)).toBeInTheDocument();
    expect(screen.getByText(/posted tweet text/)).toBeInTheDocument();
    expect(screen.getByText(/10 AUG 2026/)).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx vitest run src/components/stories/__tests__/rails.test.tsx` — FAIL (components missing).

- [ ] **Step 5: Implement components**

`OnThisDayRail.tsx` — wire-red accent, horizontal scroll:

```tsx
import Link from "next/link";
import type { Story } from "@/lib/storiesApi";

export default function OnThisDayRail({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  return (
    <section data-rail="on-this-day" style={{ marginBottom: "var(--space-xl)" }}>
      <p className="text-micro" style={{ color: "var(--wire-red)", margin: "0 0 var(--space-sm) 0" }}>
        On this day
      </p>
      <div style={{ display: "flex", gap: "var(--space-md)", overflowX: "auto", paddingBottom: "var(--space-sm)" }}>
        {stories.map((s) => (
          <Link
            key={s.content_key}
            href={`/stories/${encodeURIComponent(s.content_key)}`}
            className="ds-card"
            style={{
              minWidth: 320,
              flex: "0 0 auto",
              borderLeft: "3px solid var(--wire-red)",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
              <span className="text-micro" style={{ color: "var(--wire-red)", margin: 0 }}>
                {s.event_month_day?.split("-")[1]}{" "}
                {["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][
                  Number(s.event_month_day?.split("-")[0]) - 1
                ]}
                {s.year ? ` ${s.year}` : ""}
              </span>
            </div>
            <p className="text-title" style={{ margin: 0, color: "var(--fg)" }}>{s.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

`WireStrip.tsx` — floodlight-cyan accent, same horizontal-scroll pattern; each card shows `ds-chip` category, `item.text.slice(0, 120)`, and `formatDateStamp(item.posted_at)` in `text-micro`; header `<p className="text-micro" style={{ color: "var(--floodlight-cyan)" }}>The Wire — recently posted</p>`. Plain `<div>` cards (no links — drafts have no detail page). No animation (static swipe strip per spec).

- [ ] **Step 6: Wire into the page**

In `stories/page.tsx` `Vault` component: fetch wire alongside stories (`storiesApi.getWire().catch(() => [])` — the rail is optional; an API error must not blank the vault). Compute `const onThisDay = stories.filter((s) => s.event_month_day === todayMonthDay());`. Render order: masthead → `<OnThisDayRail stories={onThisDay} />` → `<WireStrip items={wire} />` → search/tags → grid. The rail/strip render on unfiltered view only (`!filters.q && !filters.tag`) so filtering shows just the grid.

- [ ] **Step 7: Verify and commit**

Run: `cd frontend && npx vitest run && npm run build` and `bot/.venv/bin/python -m pytest composer/tests/ -q`
Expected: all PASS.

```bash
git add composer/ frontend/src/lib/storiesApi.ts frontend/src/components/stories/ frontend/src/app/stories/page.tsx
git commit -m "feat(stories): on-this-day rail + wire strip - the loop made visible"
```

---

### Task 7: Story detail route, modal removal

**Files:**
- Create: `frontend/src/app/stories/[contentKey]/page.tsx`
- Delete: `frontend/src/components/stories/StoryCardModal.tsx`
- Modify: `frontend/src/app/stories/page.tsx` (cards become links)
- Test: `frontend/src/components/stories/__tests__/StoryBeats.test.tsx`; Create: `frontend/src/components/stories/StoryBeats.tsx`

**Interfaces:**
- Consumes: `storiesApi.getStoryByKey`, `storiesApi.listStories`, `Story`, Task 5 grid.
- Produces: route `/stories/[contentKey]`. `StoryBeats({ segments }: { segments: string[] })` — numbered beat cards, `data-beat` attribute per beat (Task 9's ScrollTrigger hook). Grid `StoryCard`s wrapped in `<Link href={`/stories/${encodeURIComponent(story.content_key)}`}>`.

- [ ] **Step 1: Failing StoryBeats test**

`frontend/src/components/stories/__tests__/StoryBeats.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoryBeats from "../StoryBeats";

describe("StoryBeats", () => {
  it("renders each segment as a numbered beat", () => {
    render(<StoryBeats segments={["first beat", "second beat"]} />);
    expect(screen.getByText("first beat")).toBeInTheDocument();
    expect(screen.getByText("second beat")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });
  it("omits the counter for single-segment stories", () => {
    render(<StoryBeats segments={["only beat"]} />);
    expect(screen.queryByText("1/1")).toBeNull();
  });
});
```

Run: `cd frontend && npx vitest run src/components/stories/__tests__/StoryBeats.test.tsx` — FAIL.

- [ ] **Step 2: Implement `StoryBeats.tsx`**

```tsx
export default function StoryBeats({ segments }: { segments: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          data-beat
          className="card-container"
          style={{ padding: "var(--space-lg)", position: "relative" }}
        >
          {segments.length > 1 && (
            <span
              className="text-micro"
              style={{ position: "absolute", top: "var(--space-sm)", right: "var(--space-sm)", margin: 0 }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "var(--fg)" }}>{seg}</p>
        </div>
      ))}
    </div>
  );
}
```

Run test: PASS.

- [ ] **Step 3: Detail page**

`frontend/src/app/stories/[contentKey]/page.tsx`. In Next 16 App Router, a client page receives `params` as a Promise — unwrap with `React.use`. **Verify against `frontend/node_modules/next/dist/docs/` (dynamic route segments / `params` docs) before writing.** Structure:

```tsx
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Story, storiesApi } from "@/lib/storiesApi";
import StoryBeats from "@/components/stories/StoryBeats";

export default function StoryDetailPage({
  params,
}: {
  params: Promise<{ contentKey: string }>;
}) {
  const { contentKey } = use(params);
  const key = decodeURIComponent(contentKey);
  const [story, setStory] = useState<Story | null>(null);
  const [siblings, setSiblings] = useState<Story[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    storiesApi.getStoryByKey(key).then(setStory).catch(() => setNotFound(true));
    storiesApi.listStories().then(setSiblings).catch(() => setSiblings([]));
  }, [key]);

  if (notFound) { /* centered text-micro "STORY NOT FOUND" + Link back to /stories */ }
  if (!story) { /* single .ds-skeleton block, maxWidth 680 */ }
  // ... render below
}
```

Render (single column, `maxWidth: 680, margin: "0 auto", padding: "var(--space-xl) var(--space-lg)"`):

1. Back link `← The Vault` (`ds-nav-link`, `href="/stories"`).
2. Header row: `ds-chip ds-chip-category` (mapped label as Task 5), `match_format` chip if set, year in `text-micro`.
3. `<h1 className="text-tool-headline">{story.title}</h1>`; lede `<p>` `{story.summary}` at 16px `var(--muted)`.
4. `<StoryBeats segments={story.segments} />`.
5. Meta strip: teams + players + venue as plain `ds-chip`s; tags as `<Link href={`/stories?tag=${encodeURIComponent(t)}`} className="ds-chip">#{t}</Link>` (URL-param filters from Task 5 make these live).
6. Provenance footer: `text-micro` row — `Source: {story.source_type}` with `source_ref` as `<a href>` when it starts with `http`, plain text otherwise; right side `#TheCricketFan`.
7. Prev/next: compute `const idx = siblings.findIndex((s) => s.content_key === key);` — render two `ds-btn-secondary` Links to `siblings[idx - 1]` / `siblings[idx + 1]` when they exist, labeled with the neighbor title truncated to 40 chars.

- [ ] **Step 4: Kill the modal**

- Delete `frontend/src/components/stories/StoryCardModal.tsx`.
- In `stories/page.tsx`: remove `selectedStory` state, modal import/render; wrap each grid `StoryCard` in `<Link href={`/stories/${encodeURIComponent(story.content_key)}`} style={{ textDecoration: "none" }}>`.

- [ ] **Step 5: Verify**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS; build proves the dynamic route compiles.

Manual: click a vault card → detail page; tag chip → filtered vault; prev/next walks the list; unknown key shows not-found state.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/app/stories frontend/src/components/stories
git commit -m "feat(stories): deep-linkable story detail route replaces modal"
```

---

### Task 8: StoryCardImg share card + download

**Files:**
- Create: `frontend/src/components/stories/StoryCardImg.tsx`
- Modify: `frontend/src/app/stories/[contentKey]/page.tsx`
- Test: `frontend/src/components/stories/__tests__/StoryCardImg.test.tsx`

**Interfaces:**
- Consumes: `Story`; `captureCard(el) → Blob` and `downloadCard(blob, filename)` from `frontend/src/lib/share.ts` (exist, export-blank bug already fixed).
- Produces: `StoryCardImg({ story }: { story: Story })` — fixed 1080×1350 card, off-screen render + download button on the detail page.

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoryCardImg from "../StoryCardImg";
// reuse the `story` fixture shape from rails.test.tsx (copy it in; fixtures stay local per file)

describe("StoryCardImg", () => {
  it("renders title, key line, and branding", () => {
    render(<StoryCardImg story={{ ...story, segments: ["the key line"], venue: "Eden Gardens" }} />);
    expect(screen.getByText("The Dated Classic")).toBeInTheDocument();
    expect(screen.getByText("the key line")).toBeInTheDocument();
    expect(screen.getByText("#TheCricketFan")).toBeInTheDocument();
    expect(screen.getByText(/2008/)).toBeInTheDocument();
    expect(screen.getByText(/Eden Gardens/)).toBeInTheDocument();
  });
  it("falls back to summary when there are no segments", () => {
    render(<StoryCardImg story={{ ...story, segments: [], summary: "fallback line" }} />);
    expect(screen.getByText("fallback line")).toBeInTheDocument();
  });
});
```

Run — FAIL.

- [ ] **Step 2: Implement `StoryCardImg.tsx`**

Follow `RecordCardImg.tsx`'s pattern (fixed px, inline styles — html-to-image needs computed styles, tokens resolve fine in-browser but keep hard values for export safety, matching the existing cards):

```tsx
import type { Story } from "@/lib/storiesApi";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "RECORD",
  anecdote: "ANECDOTE",
  story: "STORY",
};

export default function StoryCardImg({ story }: { story: Story }) {
  const keyLine = story.segments[0] || story.summary || "";
  const stamp = [story.year, story.venue].filter(Boolean).join(" · ");
  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        background: "linear-gradient(160deg, #0a0a0a 0%, #1a0d0b 100%)",
        color: "#ffffff",
        padding: 64,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #2a2a2a",
          paddingBottom: 28,
        }}
      >
        <span style={{ fontSize: 26, letterSpacing: 4, fontWeight: 700, color: "#e8432e" }}>
          {CATEGORY_LABEL[story.category] ?? story.category.toUpperCase()}
        </span>
        {stamp && <span style={{ fontSize: 24, color: "#a3a3a3" }}>{stamp}</span>}
      </div>

      <div style={{ margin: "40px 0" }}>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 32 }}>
          {story.title}
        </div>
        <p style={{ fontSize: 34, lineHeight: 1.45, color: "#e5e5e5", margin: 0 }}>{keyLine}</p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "2px solid #2a2a2a",
          paddingTop: 28,
          fontSize: 24,
          color: "#a3a3a3",
        }}
      >
        <span>THE CRICKET FAN</span>
        <span style={{ color: "#5dc4d9" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
```

Run test: PASS.

- [ ] **Step 3: Detail page download button**

In `[contentKey]/page.tsx`:

```tsx
const cardRef = useRef<HTMLDivElement>(null);
const [exporting, setExporting] = useState(false);

async function handleDownload() {
  if (!cardRef.current || !story) return;
  setExporting(true);
  try {
    const blob = await captureCard(cardRef.current);
    await downloadCard(blob, `${story.content_key.replace(/[^a-z0-9]+/gi, "-")}.png`);
  } finally {
    setExporting(false);
  }
}
```

Render a `ds-btn-primary` "Download card" button near the provenance footer, and the off-screen card exactly as `CardPreview.tsx` does for export (fixed position off-viewport, not `display: none` — html-to-image can't capture undisplayed nodes; copy the existing off-screen wrapper style from `CardPreview.tsx`):

```tsx
<div style={{ position: "fixed", left: -20000, top: 0 }} aria-hidden>
  <div ref={cardRef}>
    <StoryCardImg story={story} />
  </div>
</div>
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && npx vitest run && npm run build` — PASS.
Manual: download from a detail page, open the PNG — 1080×1350, no blank regions.

```bash
git add frontend/src/components/stories/StoryCardImg.tsx frontend/src/components/stories/__tests__/StoryCardImg.test.tsx frontend/src/app/stories
git commit -m "feat(stories): 1080x1350 shareable story card export"
```

---

### Task 9: GSAP motion pass

**Files:**
- Modify: `frontend/package.json` (gsap), `frontend/src/app/stories/page.tsx`, `frontend/src/app/stories/[contentKey]/page.tsx`, `frontend/src/components/stories/OnThisDayRail.tsx`
- Create: `frontend/src/lib/motion.ts`

**Interfaces:**
- Produces: `prefersReducedMotion(): boolean` in `frontend/src/lib/motion.ts`. Three animations exactly: vault grid stagger, detail beat scroll-reveal, rail entrance. No other motion; hovers stay CSS.

- [ ] **Step 1: Install**

```bash
cd frontend && npm install gsap
```

- [ ] **Step 2: `motion.ts`**

```ts
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

- [ ] **Step 3: Vault grid stagger**

In `stories/page.tsx`, ref the grid container (`gridRef`) and run on stories/filter change:

```tsx
useEffect(() => {
  if (prefersReducedMotion() || !gridRef.current) return;
  const cards = gridRef.current.children;
  if (cards.length === 0) return;
  const ctx = gsap.context(() => {
    gsap.from(cards, {
      opacity: 0,
      y: 16,
      duration: 0.35,
      stagger: 0.04,
      ease: "power4.out",
      clearProps: "all",
    });
  }, gridRef);
  return () => ctx.revert();
}, [filteredStories]);
```

(`import gsap from "gsap";` — `power4.out` is GSAP's cubic-bezier(0.25,1,0.5,1)-family ease matching `--ease-out-quart` intent.)

- [ ] **Step 4: Detail beat scroll-reveal**

In `[contentKey]/page.tsx` after `story` loads:

```tsx
useEffect(() => {
  if (!story || prefersReducedMotion()) return;
  let ctx: gsap.Context | undefined;
  (async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    gsap.registerPlugin(ScrollTrigger);
    ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-beat]").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 20,
          duration: 0.45,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });
    });
  })();
  return () => ctx?.revert();
}, [story]);
```

(Dynamic import keeps ScrollTrigger out of the vault page bundle; `data-beat` was added in Task 7.)

- [ ] **Step 5: Rail entrance**

In `OnThisDayRail.tsx` (make it `"use client"`), one-shot slide on mount:

```tsx
const railRef = useRef<HTMLElement>(null);
useEffect(() => {
  if (prefersReducedMotion() || !railRef.current) return;
  const ctx = gsap.context(() => {
    gsap.from(railRef.current!.querySelectorAll("a"), {
      opacity: 0,
      x: 24,
      duration: 0.4,
      stagger: 0.06,
      ease: "power4.out",
      clearProps: "all",
    });
  }, railRef);
  return () => ctx.revert();
}, []);
```

Attach `ref={railRef}` to the `<section>`. No loops, no marquee.

- [ ] **Step 6: Verify and commit**

Run: `cd frontend && npx vitest run && npm run build` — PASS (existing rail/beat tests still pass because animations no-op in happy-dom via the reduced-motion guard — `matchMedia` in happy-dom returns non-matching; if `window.matchMedia` is undefined in the test env, add a `typeof window.matchMedia !== "function"` early-return `true` to `prefersReducedMotion`).

Manual with OS reduced-motion OFF: grid staggers in, beats reveal on scroll, rail slides once. With reduced-motion ON: everything appears instantly.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/motion.ts frontend/src/app/stories frontend/src/components/stories/OnThisDayRail.tsx
git commit -m "feat(stories): GSAP motion pass - grid stagger, beat reveal, rail entrance"
```

---

### Task 10: Metadata/OG + cross-links

**Files:**
- Create: `frontend/src/app/stories/layout.tsx`
- Modify: `frontend/src/app/composer/layout.tsx`, `frontend/src/components/composer/SourceBar.tsx`, `frontend/src/components/composer/Feed.tsx`
- Test: `frontend/src/components/composer/__tests__/SourceBar.test.tsx`

**Interfaces:**
- Consumes: everything prior.
- Produces: `/stories` metadata + OG tags; nav both directions; "View in Vault ↗" per bank item; "On the Wire" badge on posted drafts in Feed.

- [ ] **Step 1: Stories layout with metadata**

`frontend/src/app/stories/layout.tsx` (server component — no `"use client"`):

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "The Vault — The Cricket Fan",
  description:
    "Verified cricket folklore: historic comebacks, records, and legendary moments. 100% real, sourced stories.",
  openGraph: {
    title: "The Vault — The Cricket Fan",
    description:
      "Verified cricket folklore: historic comebacks, records, and legendary moments.",
    type: "website",
  },
};

export default function StoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
```

(Check `frontend/node_modules/next/dist/docs/` for the Metadata API shape in this Next version before writing.)

- [ ] **Step 2: Composer nav → Vault**

In `frontend/src/app/composer/layout.tsx`, append to `TABS`:

```tsx
  { href: "/stories", label: "Vault" },
```

(The `pathname === tab.href` active check just never matches under `/composer` — fine.)

- [ ] **Step 3: Bank item "View in Vault ↗"**

In `SourceBar.tsx`, next to the eye toggle inside the bank item header row:

```tsx
<a
  href={`/stories/${encodeURIComponent(item.content_key)}`}
  target="_blank"
  rel="noreferrer"
  onClick={(e) => e.stopPropagation()}
  className="text-micro"
  style={{ margin: 0, color: "var(--floodlight-cyan)", textDecoration: "none" }}
>
  View in Vault ↗
</a>
```

Add a SourceBar test asserting the link's `href` contains the encoded `content_key`.

- [ ] **Step 4: Feed "On the Wire" badge**

In `Feed.tsx`, replace the plain `posted` micro-text (lines 65-69) with:

```tsx
{d.status === "posted" && (
  <span
    className="ds-chip"
    style={{ color: "var(--floodlight-cyan)", borderColor: "var(--floodlight-cyan)" }}
    title="Visible on The Wire at /stories"
  >
    On the Wire
  </span>
)}
```

- [ ] **Step 5: Full verification sweep**

```bash
bot/.venv/bin/python -m pytest composer/tests/ bot/tests/ -q
bot/.venv/bin/python -m ruff check composer/ bot/
cd frontend && npx vitest run && npm run build && npm run lint
```

Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/stories/layout.tsx frontend/src/app/composer/layout.tsx frontend/src/components/composer/
git commit -m "feat(stories): page metadata + composer-vault cross-links close the loop"
```

---

## Post-plan notes for the executor

- Uncommitted WIP already on the branch (stories router, harvest scripts, `news_fetcher.py`, stories page) is the foundation these tasks modify — do not stash or revert it. Task 1 commits will naturally start including those files as tasks touch them; if a task's `git add` scope pulls in unrelated WIP files, add paths explicitly as written in each commit step.
- Composer API for manual checks: `bot/.venv/bin/python -m uvicorn composer.app:app --reload --port 8000`; frontend `cd frontend && npm run dev`; seed via `python -m bot.scripts.seed_content_bank` if the bank is empty.
- Backfilling real `event_month_day` values is explicitly out of scope (research task, no guessed dates) — the rail simply stays hidden until dated items exist. For manual rail verification, temporarily set one row's `event_month_day` to today in a local sqlite DB and revert.
