# Composer API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend for the manual content composer — a new `composer/` package that reuses `bot/`'s DB and generators to browse/generate/edit drafts, render nothing (image is the frontend's job), and serve funnel + prediction analytics.

**Architecture:** A `composer/` FastAPI app depends on `bot` as a library (one-way: `bot` never imports `composer`). It reuses `bot.db` (adding two tables), `bot.compose`/`bot.trivia_standalone`/`bot.predict`/`bot.features`/`bot.run` helpers for generation, and a thin Gemini client for LLM. Sync SQLAlchemy Core throughout; sync FastAPI handlers with a per-request connection dependency.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 Core (sync), google-generativeai (Gemini), pytest + FastAPI `TestClient` on SQLite in-memory.

**Scope note:** This is plan 1 of 2 for the composer. The Next.js UI (feed, editor, themed cards, html-to-image export, analytics screen) gets its own plan against the endpoints built here. This plan produces a fully testable API on its own.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-manual-content-composer-design.md`. Every task's requirements implicitly include it.
- Sync SQLAlchemy 2.0 **Core** only (mirrors `bot/`), never async ORM.
- Line length 99; `ruff check`/`ruff format` must pass.
- `bot` must NOT gain a dependency on `composer` or on FastAPI/uvicorn. Composer web deps live only in `composer/requirements.txt`.
- Single schema source: `drafts` and `content_events` are defined in `bot/db.py`'s existing `metadata` and created by the existing `ensure_schema`. No second schema definition, no dialect-specific migration (both tables are brand-new).
- **Timestamps are explicit, not `server_default`.** Every handler passes `datetime.now(timezone.utc)` at insert time — matches `bot/`'s injected-`now` convention and keeps tests deterministic.
- **`card_meta` JSON boundary:** stored as `card_meta_json` TEXT; exposed by the API as `card_meta: dict | None`. Never return an escaped JSON string.
- Python for all commands: `bot/.venv/bin/python` (the repo venv; bare `python`/`python3` lack deps). Composer deps get installed into this same venv.
- Run tests from repo root: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/...`.
- Reuse, don't reimplement: generation goes through the existing `bot` functions (`compose.prediction_post`, `compose.trivia_post`, `trivia_standalone.build_candidates`, `predict.predict`, `features.build_features`, `run._load_team_matches`/`_home_team_at_venue`/`_season_record`).

---

## File Structure

```
composer/
├── __init__.py
├── config.py          # env-driven Settings (DB URL, gemini key, CORS origin)
├── deps.py            # engine + get_conn per-request connection dependency
├── schemas.py         # Pydantic v2 request/response models
├── gemini.py          # thin Gemini client (structured JSON, key-optional)
├── app.py             # create_app(): FastAPI, CORS, lifespan (schema+artifact), routers
├── routers/
│   ├── __init__.py
│   ├── drafts.py      # /drafts CRUD + /drafts/{id}/event
│   ├── content_bank.py# /content-bank browse
│   ├── generate.py    # /generate/bot, /generate/llm
│   └── analytics.py   # /analytics
├── requirements.txt
└── tests/
    ├── __init__.py
    ├── conftest.py    # SQLite StaticPool engine + dependency override + TestClient
    ├── test_drafts.py
    ├── test_content_bank.py
    ├── test_generate_bot.py
    ├── test_generate_llm.py
    └── test_analytics.py
```

`bot/db.py` is modified (two tables). Everything else is new under `composer/`.

---

### Task 1: Schema — `drafts` + `content_events` tables

**Files:**
- Modify: `bot/db.py`
- Test: `bot/tests/test_db.py`

**Interfaces:**
- Produces: `bot.db.drafts`, `bot.db.content_events` tables on the shared `metadata`; created by existing `ensure_schema`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Add to `bot/tests/test_db.py`:

```python
def test_drafts_and_events_roundtrip_with_cascade(engine):
    from datetime import datetime, timezone

    from bot.db import content_events, drafts

    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    with engine.begin() as conn:
        conn.execute(sa.text("PRAGMA foreign_keys=ON"))
        did = conn.execute(
            drafts.insert().values(
                source="freeform",
                category="anecdote",
                text="a fine fact",
                status="draft",
                created_at=now,
            )
        ).inserted_primary_key[0]
        conn.execute(
            content_events.insert().values(
                draft_id=did, action="generated", created_at=now
            )
        )
        assert conn.execute(sa.select(sa.func.count()).select_from(content_events)).scalar_one() == 1
        conn.execute(drafts.delete().where(drafts.c.id == did))
        # FK cascade removes the orphan event (SQLite enforces only with PRAGMA on)
        assert conn.execute(sa.select(sa.func.count()).select_from(content_events)).scalar_one() == 0


def test_drafts_defaults(engine):
    from datetime import datetime, timezone

    from bot.db import drafts

    with engine.begin() as conn:
        did = conn.execute(
            drafts.insert().values(
                source="llm", text="x", created_at=datetime(2026, 7, 23, tzinfo=timezone.utc)
            )
        ).inserted_primary_key[0]
        row = conn.execute(sa.select(drafts).where(drafts.c.id == did)).one()
    assert row.status == "draft"
    assert row.category is None
    assert row.card_meta_json is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest bot/tests/test_db.py -v`
Expected: FAIL — `ImportError: cannot import name 'drafts'`.

- [ ] **Step 3: Add the two tables**

In `bot/db.py`, after the `content_bank` table definition, add:

```python
drafts = sa.Table(
    "drafts",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("source", sa.String(16), nullable=False),
    # 'bank' | 'bot' | 'llm' | 'freeform'
    sa.Column("category", sa.String(24), nullable=True),
    sa.Column("text", sa.Text, nullable=False),
    sa.Column("card_type", sa.String(16), nullable=True),
    # 'prediction' | 'trivia' | 'record' | null
    sa.Column("card_meta_json", sa.Text, nullable=True),
    sa.Column("status", sa.String(12), nullable=False, default="draft"),
    # 'draft' | 'posted'
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
)

content_events = sa.Table(
    "content_events",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column(
        "draft_id",
        sa.Integer,
        sa.ForeignKey("drafts.id", ondelete="CASCADE"),
        nullable=False,
    ),
    sa.Column("action", sa.String(12), nullable=False),
    # 'generated' | 'edited' | 'copied' | 'posted'
    sa.Column("platform_hint", sa.String(16), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
```

`metadata.create_all` in the existing `ensure_schema` creates both on any dialect — no edit to `ensure_schema` needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest bot/tests/test_db.py -v`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check bot/db.py bot/tests/test_db.py
bot/.venv/bin/python -m ruff format bot/db.py bot/tests/test_db.py
git add bot/db.py bot/tests/test_db.py
git commit -m "feat(composer): add drafts and content_events tables to bot schema"
```

---

### Task 2: Composer package scaffold — config, deps, app, test harness

**Files:**
- Create: `composer/__init__.py`, `composer/config.py`, `composer/deps.py`, `composer/app.py`, `composer/routers/__init__.py`, `composer/requirements.txt`
- Create: `composer/tests/__init__.py`, `composer/tests/conftest.py`, `composer/tests/test_health.py`

**Interfaces:**
- Consumes: `bot.db` (`metadata`, `ensure_schema`, `drafts`, `content_events`, `content_bank`, `predictions`, `fixtures`).
- Produces:
  - `composer.config.Settings` + `get_settings()` — fields `database_url: str`, `gemini_api_key: str`, `cors_origin: str`.
  - `composer.deps.get_engine(url)`, module-level lazy `engine`, and `get_conn()` FastAPI dependency yielding a sync `Connection`.
  - `composer.app.create_app() -> FastAPI` with CORS, a lifespan that runs `ensure_schema` + loads the model artifact onto `app.state.artifact`, and mounts routers. Exposes `GET /health -> {"status": "ok"}`.
  - Test fixtures: `conn` (a live SQLite connection with schema) and `client` (a `TestClient` whose `get_conn` is overridden to that connection).

- [ ] **Step 1: Write `composer/requirements.txt`**

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.7.0
google-generativeai>=0.7.0
httpx>=0.27.0
```

Install into the repo venv:

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/pip install -r composer/requirements.txt
```

- [ ] **Step 2: Write the failing test**

`composer/tests/test_health.py`:

```python
def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'composer'` / no `client` fixture.

- [ ] **Step 4: Create the package files**

`composer/__init__.py`: empty.
`composer/routers/__init__.py`: empty.

`composer/config.py`:

```python
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    gemini_api_key: str
    cors_origin: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.environ.get(
                "COMPOSER_DATABASE_URL", os.environ.get("BOT_DATABASE_URL", "")
            ),
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            cors_origin=os.environ.get("COMPOSER_CORS_ORIGIN", "http://localhost:3000"),
        )


def get_settings() -> Settings:
    return Settings.from_env()
```

`composer/deps.py`:

```python
from collections.abc import Iterator

import sqlalchemy as sa

from bot.db import get_engine as _bot_get_engine

_engine: sa.Engine | None = None


def get_engine(url: str) -> sa.Engine:
    return _bot_get_engine(url)


def init_engine(url: str) -> sa.Engine:
    global _engine
    _engine = get_engine(url)
    return _engine


def get_conn() -> Iterator[sa.Connection]:
    assert _engine is not None, "engine not initialised; call init_engine in lifespan"
    with _engine.connect() as conn:
        yield conn
```

`composer/app.py`:

```python
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bot.db import ensure_schema
from bot.predict import load_artifact

from .config import get_settings
from .deps import init_engine

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = init_engine(settings.database_url)
        with engine.connect() as conn:
            ensure_schema(conn)
            conn.commit()
        try:
            app.state.artifact = load_artifact(
                Path(__file__).resolve().parent.parent / "bot" / "artifacts" / "model.pkl"
            )
        except Exception:
            logger.warning("model artifact not loaded; /generate/bot prediction disabled")
            app.state.artifact = None
        yield

    app = FastAPI(title="Cricket Composer API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

`composer/tests/__init__.py`: empty.

`composer/tests/conftest.py`:

```python
import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

from bot.db import metadata
from composer.app import create_app
from composer.deps import get_conn


@pytest.fixture
def engine():
    eng = sa.create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def conn(engine):
    with engine.connect() as c:
        yield c


@pytest.fixture
def client(conn):
    app = create_app()
    app.state.artifact = None

    def _override() -> object:
        yield conn

    app.dependency_overrides[get_conn] = _override
    # Skip the real lifespan (no live DB / no artifact) by not using a context manager.
    return TestClient(app)
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): scaffold FastAPI app, config, deps, test harness"
```

---

### Task 3: Drafts router — CRUD + event logging

**Files:**
- Create: `composer/schemas.py`, `composer/routers/drafts.py`
- Modify: `composer/app.py` (mount router)
- Test: `composer/tests/test_drafts.py`

**Interfaces:**
- Consumes: `get_conn` (Task 2); `bot.db.drafts`, `bot.db.content_events`.
- Produces (Pydantic v2, in `schemas.py`):
  - `DraftIn`: `source: str`, `category: str | None = None`, `text: str`, `card_type: str | None = None`, `card_meta: dict | None = None`.
  - `DraftPatch`: `text: str | None = None`, `category: str | None = None`, `card_type: str | None = None`, `card_meta: dict | None = None`.
  - `DraftOut`: `id, source, category, text, card_type, card_meta: dict | None, status, created_at, posted_at`.
  - `EventIn`: `action: str`, `platform_hint: str | None = None`.
  - A `_row_to_out(row) -> DraftOut` helper that deserializes `card_meta_json`.
- Produces endpoints: `POST /drafts`, `GET /drafts`, `PATCH /drafts/{id}`, `POST /drafts/{id}/event`.

- [ ] **Step 1: Write the failing tests**

`composer/tests/test_drafts.py`:

```python
import sqlalchemy as sa

from bot.db import content_events


def test_create_and_list_draft_roundtrips_card_meta(client):
    body = {
        "source": "freeform",
        "category": "prediction",
        "text": "CSK favoured",
        "card_type": "prediction",
        "card_meta": {"team_a": "CSK", "team_b": "MI", "prob": 0.62},
    }
    r = client.post("/drafts", json=body)
    assert r.status_code == 201
    out = r.json()
    assert out["card_meta"] == {"team_a": "CSK", "team_b": "MI", "prob": 0.62}
    assert out["status"] == "draft"
    listed = client.get("/drafts").json()
    assert [d["id"] for d in listed] == [out["id"]]
    assert listed[0]["card_meta"] == body["card_meta"]  # object, not escaped string


def test_patch_changing_text_logs_one_edited_event(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "one"}).json()["id"]
    r = client.patch(f"/drafts/{did}", json={"text": "two"})
    assert r.status_code == 200
    assert r.json()["text"] == "two"
    n = conn.execute(
        sa.select(sa.func.count())
        .select_from(content_events)
        .where(content_events.c.action == "edited")
    ).scalar_one()
    assert n == 1


def test_patch_noop_logs_no_event(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "same"}).json()["id"]
    client.patch(f"/drafts/{did}", json={"text": "same"})  # identical
    n = conn.execute(
        sa.select(sa.func.count())
        .select_from(content_events)
        .where(content_events.c.action == "edited")
    ).scalar_one()
    assert n == 0


def test_copied_event_logs_without_status_change(client, conn):
    did = client.post("/drafts", json={"source": "freeform", "text": "x"}).json()["id"]
    r = client.post(f"/drafts/{did}/event", json={"action": "copied"})
    assert r.status_code == 204
    row = conn.execute(sa.select(content_events).where(content_events.c.draft_id == did)).one()
    assert row.action == "copied"
    draft = client.get("/drafts").json()[0]
    assert draft["status"] == "draft"  # copy does not post


def test_posted_event_flips_status_and_sets_posted_at(client):
    did = client.post("/drafts", json={"source": "freeform", "text": "x"}).json()["id"]
    client.post(f"/drafts/{did}/event", json={"action": "posted", "platform_hint": "x"})
    draft = client.get("/drafts").json()[0]
    assert draft["status"] == "posted"
    assert draft["posted_at"] is not None
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_drafts.py -v`
Expected: FAIL — 404s (router not mounted).

- [ ] **Step 3: Write `composer/schemas.py`**

```python
import json

from pydantic import BaseModel


class DraftIn(BaseModel):
    source: str
    category: str | None = None
    text: str
    card_type: str | None = None
    card_meta: dict | None = None


class DraftPatch(BaseModel):
    text: str | None = None
    category: str | None = None
    card_type: str | None = None
    card_meta: dict | None = None


class DraftOut(BaseModel):
    id: int
    source: str
    category: str | None
    text: str
    card_type: str | None
    card_meta: dict | None
    status: str
    created_at: object
    posted_at: object


class EventIn(BaseModel):
    action: str
    platform_hint: str | None = None


def row_to_out(row) -> DraftOut:
    return DraftOut(
        id=row.id,
        source=row.source,
        category=row.category,
        text=row.text,
        card_type=row.card_type,
        card_meta=json.loads(row.card_meta_json) if row.card_meta_json else None,
        status=row.status,
        created_at=row.created_at,
        posted_at=row.posted_at,
    )
```

- [ ] **Step 4: Write `composer/routers/drafts.py`**

```python
import json
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response

from bot.db import content_events, drafts

from ..deps import get_conn
from ..schemas import DraftIn, DraftOut, DraftPatch, EventIn, row_to_out

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def log_event(conn, draft_id, action, platform_hint=None) -> None:
    conn.execute(
        content_events.insert().values(
            draft_id=draft_id,
            action=action,
            platform_hint=platform_hint,
            created_at=_now(),
        )
    )


def create_draft(conn, body: DraftIn, log_generated: bool = False) -> DraftOut:
    """Shared insert used by this router and the generate router."""
    did = conn.execute(
        drafts.insert().values(
            source=body.source,
            category=body.category,
            text=body.text,
            card_type=body.card_type,
            card_meta_json=json.dumps(body.card_meta) if body.card_meta is not None else None,
            status="draft",
            created_at=_now(),
        )
    ).inserted_primary_key[0]
    if log_generated:
        log_event(conn, did, "generated")
    conn.commit()
    row = conn.execute(sa.select(drafts).where(drafts.c.id == did)).one()
    return row_to_out(row)


@router.post("/drafts", response_model=DraftOut, status_code=201)
def post_draft(body: DraftIn, conn=Depends(get_conn)) -> DraftOut:
    return create_draft(conn, body)


@router.get("/drafts", response_model=list[DraftOut])
def list_drafts(
    status: str | None = None,
    source: str | None = None,
    conn=Depends(get_conn),
) -> list[DraftOut]:
    q = sa.select(drafts).order_by(drafts.c.created_at.desc(), drafts.c.id.desc())
    if status:
        q = q.where(drafts.c.status == status)
    if source:
        q = q.where(drafts.c.source == source)
    return [row_to_out(r) for r in conn.execute(q).all()]


@router.patch("/drafts/{draft_id}", response_model=DraftOut)
def patch_draft(draft_id: int, body: DraftPatch, conn=Depends(get_conn)) -> DraftOut:
    row = conn.execute(sa.select(drafts).where(drafts.c.id == draft_id)).first()
    if row is None:
        raise HTTPException(404, "draft not found")
    updates: dict = {}
    if body.text is not None and body.text != row.text:
        updates["text"] = body.text
    if body.category is not None and body.category != row.category:
        updates["category"] = body.category
    if body.card_type is not None and body.card_type != row.card_type:
        updates["card_type"] = body.card_type
    if body.card_meta is not None:
        new_meta = json.dumps(body.card_meta)
        if new_meta != (row.card_meta_json or ""):
            updates["card_meta_json"] = new_meta
    if updates:
        conn.execute(drafts.update().where(drafts.c.id == draft_id).values(**updates))
        log_event(conn, draft_id, "edited")
        conn.commit()
    row = conn.execute(sa.select(drafts).where(drafts.c.id == draft_id)).one()
    return row_to_out(row)


@router.post("/drafts/{draft_id}/event", status_code=204)
def post_event(draft_id: int, body: EventIn, conn=Depends(get_conn)) -> Response:
    row = conn.execute(sa.select(drafts.c.id).where(drafts.c.id == draft_id)).first()
    if row is None:
        raise HTTPException(404, "draft not found")
    log_event(conn, draft_id, body.action, body.platform_hint)
    if body.action == "posted":
        conn.execute(
            drafts.update()
            .where(drafts.c.id == draft_id)
            .values(status="posted", posted_at=_now())
        )
    conn.commit()
    return Response(status_code=204)
```

- [ ] **Step 5: Mount the router in `composer/app.py`**

Add the import and mount inside `create_app`, before `return app`:

```python
    from .routers import drafts as drafts_router

    app.include_router(drafts_router.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_drafts.py -v`
Expected: PASS (5 tests).

- [ ] **Step 7: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): drafts CRUD + event logging with card_meta JSON boundary"
```

---

### Task 4: Content-bank browse endpoint

**Files:**
- Create: `composer/routers/content_bank.py`
- Modify: `composer/app.py` (mount)
- Test: `composer/tests/test_content_bank.py`

**Interfaces:**
- Consumes: `get_conn`; `bot.db.content_bank`.
- Produces: `GET /content-bank?category=&limit=&offset=` → `list[ContentBankOut]` where `ContentBankOut`: `content_key, category, format, segments: list[str], source`. Add `ContentBankOut` to `schemas.py`.

- [ ] **Step 1: Write the failing test**

`composer/tests/test_content_bank.py`:

```python
from datetime import datetime, timezone

from bot.db import content_bank


def _seed(conn):
    conn.execute(
        content_bank.insert().values(
            category="anecdote",
            format="single",
            segments_json='["Bodyline changed cricket."]',
            content_key="anecdote:bodyline",
            source="wikipedia:Bodyline",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )
    conn.execute(
        content_bank.insert().values(
            category="wiki_record",
            format="single",
            segments_json='["800 Test wickets."]',
            content_key="wiki_record:test:most-wickets",
            source="wikipedia:List_of_Test_cricket_records",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    )
    conn.commit()


def test_content_bank_lists_and_parses_segments(client, conn):
    _seed(conn)
    rows = client.get("/content-bank").json()
    keys = {r["content_key"] for r in rows}
    assert keys == {"anecdote:bodyline", "wiki_record:test:most-wickets"}
    bodyline = next(r for r in rows if r["content_key"] == "anecdote:bodyline")
    assert bodyline["segments"] == ["Bodyline changed cricket."]


def test_content_bank_filters_by_category(client, conn):
    _seed(conn)
    rows = client.get("/content-bank", params={"category": "anecdote"}).json()
    assert [r["content_key"] for r in rows] == ["anecdote:bodyline"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_content_bank.py -v`
Expected: FAIL — 404 (router not mounted).

- [ ] **Step 3: Add `ContentBankOut` to `composer/schemas.py`**

```python
class ContentBankOut(BaseModel):
    content_key: str
    category: str
    format: str
    segments: list[str]
    source: str
```

- [ ] **Step 4: Write `composer/routers/content_bank.py`**

```python
import json

import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import content_bank

from ..deps import get_conn
from ..schemas import ContentBankOut

router = APIRouter()


@router.get("/content-bank", response_model=list[ContentBankOut])
def list_content_bank(
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
    conn=Depends(get_conn),
) -> list[ContentBankOut]:
    q = sa.select(content_bank).order_by(content_bank.c.id.desc())
    if category:
        q = q.where(content_bank.c.category == category)
    q = q.limit(limit).offset(offset)
    return [
        ContentBankOut(
            content_key=r.content_key,
            category=r.category,
            format=r.format,
            segments=json.loads(r.segments_json),
            source=r.source,
        )
        for r in conn.execute(q).all()
    ]
```

- [ ] **Step 5: Mount in `composer/app.py`**

```python
    from .routers import content_bank as content_bank_router

    app.include_router(content_bank_router.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_content_bank.py -v`
Expected: PASS.

- [ ] **Step 7: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): content-bank browse endpoint"
```

---

### Task 5: `/generate/bot` — reuse bot generators

**Files:**
- Create: `composer/routers/generate.py` (bot half; llm half added in Task 6)
- Modify: `composer/app.py` (mount), `composer/schemas.py`
- Test: `composer/tests/test_generate_bot.py`

**Interfaces:**
- Consumes: `get_conn`; `app.state.artifact`; `bot.run._load_team_matches`, `bot.run._home_team_at_venue`; `bot.features.build_features`; `bot.predict.predict`; `bot.compose.prediction_post`, `bot.compose.trivia_post`; `bot.trivia_standalone.build_candidates`; `bot.db.fixtures`; `composer.routers.drafts.create_draft`.
- Produces: `POST /generate/bot` body `GenerateBotIn` (`kind: str`, `fixture_id: int | None = None`) → `DraftOut`. `kind` ∈ {prediction, trivia, h2h, venue, record}. prediction/trivia resolve a fixture (given id, else next upcoming by `start_time`, status `upcoming`); h2h/venue/record pick a matching `build_candidates` entry by key prefix. Add `GenerateBotIn` to `schemas.py`.

- [ ] **Step 1: Write the failing tests**

`composer/tests/test_generate_bot.py`:

```python
from datetime import date, datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from bot.aliases import seed_aliases
from bot.db import fixtures, team_matches
from bot.predict import load_artifact
from bot.tests.test_predict import _artifact

pytestmark = pytest.mark.filterwarnings("ignore:LightGBM binary classifier.*:UserWarning")

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)


def _seed_matches_and_fixture(conn):
    seed_aliases(conn)
    for i in range(6):
        conn.execute(team_matches.insert().values(
            team="Chennai Super Kings", opponent="Mumbai Indians",
            date=date(2026, 6, 1 + i), season="2026", league="IPL",
            venue="Wankhede Stadium, Mumbai", won=i % 2 == 0, dls=False,
            runs_scored=160.0, overs_faced=20.0, runs_conceded=155.0,
            overs_bowled=20.0, home=False,
        ))
        conn.execute(team_matches.insert().values(
            team="Mumbai Indians", opponent="Chennai Super Kings",
            date=date(2026, 6, 1 + i), season="2026", league="IPL",
            venue="Wankhede Stadium, Mumbai", won=i % 2 == 1, dls=False,
            runs_scored=155.0, overs_faced=20.0, runs_conceded=160.0,
            overs_bowled=20.0, home=True,
        ))
    fid = conn.execute(fixtures.insert().values(
        provider_match_id="m1", team_a="Chennai Super Kings", team_b="Mumbai Indians",
        venue="Wankhede Stadium, Mumbai", league="IPL",
        start_time=NOW + timedelta(hours=5), status="upcoming",
    )).inserted_primary_key[0]
    conn.commit()
    return fid


def test_generate_prediction_uses_next_fixture(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 201
    out = r.json()
    assert out["source"] == "bot"
    assert out["card_type"] == "prediction"
    assert set(out["card_meta"]) >= {"team_a", "team_b", "prob_a"}
    assert "%" in out["text"]


def test_generate_prediction_with_explicit_fixture_id(client, conn, tmp_path):
    fid = _seed_matches_and_fixture(conn)
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction", "fixture_id": fid})
    assert r.status_code == 201


def test_generate_trivia_returns_text(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    r = client.post("/generate/bot", json={"kind": "trivia"})
    assert r.status_code == 201
    assert r.json()["card_type"] == "trivia"


def test_generate_record_from_candidate_pool(client, conn, tmp_path):
    _seed_matches_and_fixture(conn)
    r = client.post("/generate/bot", json={"kind": "record"})
    assert r.status_code == 201
    assert r.json()["source"] == "bot"


def test_generate_prediction_no_fixture_returns_409(client, conn, tmp_path):
    from bot.aliases import seed_aliases
    seed_aliases(conn)
    conn.commit()
    client.app.state.artifact = load_artifact(_artifact(tmp_path))
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 409  # no upcoming fixture to predict


def test_generate_prediction_without_artifact_returns_503(client, conn):
    _seed_matches_and_fixture(conn)
    client.app.state.artifact = None
    r = client.post("/generate/bot", json={"kind": "prediction"})
    assert r.status_code == 503
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_generate_bot.py -v`
Expected: FAIL — 404 (router not mounted).

- [ ] **Step 3: Add `GenerateBotIn` to `composer/schemas.py`**

```python
class GenerateBotIn(BaseModel):
    kind: str  # 'prediction' | 'trivia' | 'h2h' | 'venue' | 'record'
    fixture_id: int | None = None
```

- [ ] **Step 4: Write `composer/routers/generate.py`**

```python
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request

from bot.compose import prediction_post, trivia_post
from bot.db import fixtures
from bot.features import build_features
from bot.predict import predict
from bot.run import _home_team_at_venue, _load_team_matches
from bot.trivia_standalone import build_candidates

from ..deps import get_conn
from ..schemas import DraftIn, DraftOut, GenerateBotIn
from .drafts import create_draft

router = APIRouter()

MATCHUP_KINDS = {"prediction", "trivia"}
POOL_PREFIX = {"h2h": "h2h:", "venue": "venue:", "record": "record:"}


def _resolve_fixture(conn, fixture_id: int | None):
    if fixture_id is not None:
        row = conn.execute(sa.select(fixtures).where(fixtures.c.id == fixture_id)).first()
        if row is None:
            raise HTTPException(404, f"fixture {fixture_id} not found")
        return row
    row = conn.execute(
        sa.select(fixtures)
        .where(fixtures.c.status == "upcoming")
        .order_by(fixtures.c.start_time.asc())
    ).first()
    if row is None:
        raise HTTPException(409, "no upcoming fixture to generate from")
    return row


@router.post("/generate/bot", response_model=DraftOut, status_code=201)
def generate_bot(body: GenerateBotIn, request: Request, conn=Depends(get_conn)) -> DraftOut:
    df = _load_team_matches(conn)
    if body.kind in MATCHUP_KINDS:
        fx = _resolve_fixture(conn, body.fixture_id)
        if body.kind == "prediction":
            artifact = getattr(request.app.state, "artifact", None)
            if artifact is None:
                raise HTTPException(503, "prediction model artifact not loaded")
            home = _home_team_at_venue(df, fx.venue, fx.team_a, fx.team_b)
            feats = build_features(
                df, fx.team_a, fx.team_b, fx.venue,
                datetime.now(timezone.utc).date(), home_team=home,
            )
            prob, reasons = predict(artifact, feats)
            text = prediction_post(fx.team_a, fx.team_b, prob, reasons, fx.league)
            meta = {"team_a": fx.team_a, "team_b": fx.team_b, "prob_a": prob, "reasons": reasons}
            return create_draft(
                conn,
                DraftIn(source="bot", category="prediction", text=text,
                        card_type="prediction", card_meta=meta),
                log_generated=True,
            )
        text = trivia_post(df, fx.team_a, fx.team_b, fx.venue)
        meta = {"team_a": fx.team_a, "team_b": fx.team_b}
        return create_draft(
            conn,
            DraftIn(source="bot", category="trivia", text=text,
                    card_type="trivia", card_meta=meta),
            log_generated=True,
        )
    prefix = POOL_PREFIX.get(body.kind)
    if prefix is None:
        raise HTTPException(422, f"unknown kind {body.kind!r}")
    matches = [c for c in build_candidates(df) if c[0].startswith(prefix)]
    if not matches:
        raise HTTPException(409, f"no {body.kind} candidate available from current data")
    key, _fmt, segments = matches[0]
    return create_draft(
        conn,
        DraftIn(source="bot", category=body.kind, text=segments[0], card_type="record"),
        log_generated=True,
    )
```

- [ ] **Step 5: Mount in `composer/app.py`**

```python
    from .routers import generate as generate_router

    app.include_router(generate_router.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_generate_bot.py -v`
Expected: PASS (6 tests).

- [ ] **Step 7: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): /generate/bot reusing bot generators + fixture resolution"
```

---

### Task 6: `/generate/llm` — thin Gemini client

**Files:**
- Create: `composer/gemini.py`
- Modify: `composer/routers/generate.py`, `composer/schemas.py`
- Test: `composer/tests/test_generate_llm.py`

**Interfaces:**
- Consumes: `composer.config.get_settings().gemini_api_key`; `create_draft`.
- Produces:
  - `composer.gemini.generate_content(prompt, category, api_key) -> dict` returning `{"text": str, "card_meta": dict | None}`; raises `GeminiUnavailable` when `api_key` is empty.
  - `POST /generate/llm` body `GenerateLlmIn` (`prompt: str`, `category: str | None = None`) → `DraftOut` (source=`llm`); returns 503 when no key. Add `GenerateLlmIn` to `schemas.py`.

- [ ] **Step 1: Write the failing tests**

`composer/tests/test_generate_llm.py`:

```python
import composer.routers.generate as gen


class _FakeGemini:
    def __init__(self, payload):
        self.payload = payload

    def __call__(self, prompt, category, api_key):
        return self.payload


def test_generate_llm_creates_draft(client, monkeypatch):
    monkeypatch.setattr(
        gen, "gemini_generate",
        _FakeGemini({"text": "Bradman averaged 99.94.", "card_meta": {"headline": "99.94"}}),
    )
    monkeypatch.setattr(gen, "_gemini_key", lambda: "test-key")
    r = client.post("/generate/llm", json={"prompt": "a Bradman fact", "category": "anecdote"})
    assert r.status_code == 201
    out = r.json()
    assert out["source"] == "llm"
    assert out["text"] == "Bradman averaged 99.94."
    assert out["card_meta"] == {"headline": "99.94"}


def test_generate_llm_without_key_returns_503(client, monkeypatch):
    monkeypatch.setattr(gen, "_gemini_key", lambda: "")
    r = client.post("/generate/llm", json={"prompt": "x"})
    assert r.status_code == 503
    assert "GEMINI" in r.json()["detail"]
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_generate_llm.py -v`
Expected: FAIL — 404 / missing attributes.

- [ ] **Step 3: Write `composer/gemini.py`**

```python
import json


class GeminiUnavailable(RuntimeError):
    pass


_SCHEMA_HINT = (
    "Return ONLY a JSON object with keys 'text' (a single cricket social-media "
    "post, own words, <=280 chars) and optional 'card_meta' (a flat object of "
    "short display fields like headline/subject). No markdown, no prose outside JSON."
)


def generate_content(prompt: str, category: str | None, api_key: str) -> dict:
    if not api_key:
        raise GeminiUnavailable("GEMINI_API_KEY not configured")
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    full = f"{_SCHEMA_HINT}\nCategory: {category or 'anecdote'}\nRequest: {prompt}"
    resp = model.generate_content(
        full, generation_config={"response_mime_type": "application/json"}
    )
    try:
        data = json.loads(resp.text)
        return {"text": data["text"], "card_meta": data.get("card_meta")}
    except (json.JSONDecodeError, KeyError, AttributeError):
        return {"text": (resp.text or "").strip(), "card_meta": None}
```

- [ ] **Step 4: Extend `composer/routers/generate.py`**

Add near the top (after existing imports):

```python
from ..config import get_settings
from ..gemini import GeminiUnavailable
from ..gemini import generate_content as gemini_generate
from ..schemas import GenerateLlmIn


def _gemini_key() -> str:
    return get_settings().gemini_api_key
```

Add the endpoint at the end of the file:

```python
@router.post("/generate/llm", response_model=DraftOut, status_code=201)
def generate_llm(body: GenerateLlmIn, conn=Depends(get_conn)) -> DraftOut:
    key = _gemini_key()
    try:
        result = gemini_generate(body.prompt, body.category, key)
    except GeminiUnavailable as e:
        raise HTTPException(503, f"LLM generation unavailable: {e}") from e
    return create_draft(
        conn,
        DraftIn(source="llm", category=body.category, text=result["text"],
                card_type="record", card_meta=result.get("card_meta")),
        log_generated=True,
    )
```

Add `GenerateLlmIn` to `composer/schemas.py`:

```python
class GenerateLlmIn(BaseModel):
    prompt: str
    category: str | None = None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_generate_llm.py -v`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): /generate/llm thin Gemini client, structured output, key-optional"
```

---

### Task 7: `/analytics` — funnel + prediction record

**Files:**
- Create: `composer/routers/analytics.py`
- Modify: `composer/app.py` (mount), `composer/schemas.py`
- Test: `composer/tests/test_analytics.py`

**Interfaces:**
- Consumes: `get_conn`; `bot.db.content_events`, `bot.db.drafts`; `bot.run._season_record`.
- Produces: `GET /analytics` → `AnalyticsOut`:
  - `funnel`: `{"generated": int, "copied": int, "posted": int}` using `COUNT(DISTINCT draft_id)` per action.
  - `event_totals`: `{"generated": int, "copied": int, "posted": int}` raw counts.
  - `by_category`: `list[{category: str|None, drafts: int}]`.
  - `prediction_record`: `{"correct": int, "total": int}` from `_season_record`.
  Add `AnalyticsOut` to `schemas.py`.

- [ ] **Step 1: Write the failing tests**

`composer/tests/test_analytics.py`:

```python
from datetime import datetime, timezone

import sqlalchemy as sa

from bot.db import content_events, drafts, predictions


def _mk_draft(conn, category="anecdote"):
    return conn.execute(
        drafts.insert().values(
            source="freeform", category=category, text="x", status="draft",
            created_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
    ).inserted_primary_key[0]


def test_funnel_counts_distinct_drafts(client, conn):
    d1 = _mk_draft(conn)
    d2 = _mk_draft(conn)
    for d in (d1, d2):
        conn.execute(content_events.insert().values(
            draft_id=d, action="generated", created_at=datetime(2026, 7, 23, tzinfo=timezone.utc)))
    # d1 copied 3 times -> counts once in the distinct funnel, 3 in raw totals
    for _ in range(3):
        conn.execute(content_events.insert().values(
            draft_id=d1, action="copied", created_at=datetime(2026, 7, 23, tzinfo=timezone.utc)))
    conn.commit()
    a = client.get("/analytics").json()
    assert a["funnel"] == {"generated": 2, "copied": 1, "posted": 0}
    assert a["event_totals"]["copied"] == 3


def test_prediction_record_matches_season_record(client, conn):
    conn.execute(predictions.insert().values(
        fixture_id=1, prob_team_a=0.6, reasons_json="[]", features_json="{}",
        created_at=datetime(2026, 7, 1, tzinfo=timezone.utc), outcome="correct"))
    conn.execute(predictions.insert().values(
        fixture_id=2, prob_team_a=0.6, reasons_json="[]", features_json="{}",
        created_at=datetime(2026, 7, 2, tzinfo=timezone.utc), outcome="incorrect"))
    conn.commit()
    a = client.get("/analytics").json()
    assert a["prediction_record"] == {"correct": 1, "total": 2}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/tests/test_analytics.py -v`
Expected: FAIL — 404.

- [ ] **Step 3: Add `AnalyticsOut` to `composer/schemas.py`**

```python
class CategoryCount(BaseModel):
    category: str | None
    drafts: int


class AnalyticsOut(BaseModel):
    funnel: dict[str, int]
    event_totals: dict[str, int]
    by_category: list[CategoryCount]
    prediction_record: dict[str, int]
```

- [ ] **Step 4: Write `composer/routers/analytics.py`**

```python
import sqlalchemy as sa
from fastapi import APIRouter, Depends

from bot.db import content_events, drafts
from bot.run import _season_record

from ..deps import get_conn
from ..schemas import AnalyticsOut, CategoryCount

router = APIRouter()

_ACTIONS = ("generated", "copied", "posted")


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(conn=Depends(get_conn)) -> AnalyticsOut:
    funnel: dict[str, int] = {}
    totals: dict[str, int] = {}
    for action in _ACTIONS:
        funnel[action] = conn.execute(
            sa.select(sa.func.count(sa.distinct(content_events.c.draft_id)))
            .where(content_events.c.action == action)
        ).scalar_one()
        totals[action] = conn.execute(
            sa.select(sa.func.count())
            .select_from(content_events)
            .where(content_events.c.action == action)
        ).scalar_one()
    cats = conn.execute(
        sa.select(drafts.c.category, sa.func.count())
        .group_by(drafts.c.category)
        .order_by(sa.func.count().desc())
    ).all()
    correct, total = _season_record(conn)
    return AnalyticsOut(
        funnel=funnel,
        event_totals=totals,
        by_category=[CategoryCount(category=c, drafts=n) for c, n in cats],
        prediction_record={"correct": correct, "total": total},
    )
```

- [ ] **Step 5: Mount in `composer/app.py`**

```python
    from .routers import analytics as analytics_router

    app.include_router(analytics_router.router)
```

- [ ] **Step 6: Run the full composer suite to verify everything passes**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan && bot/.venv/bin/python -m pytest composer/ bot/tests/test_db.py -q`
Expected: PASS (all composer tests + the schema tests).

- [ ] **Step 7: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
bot/.venv/bin/python -m ruff check composer/ && bot/.venv/bin/python -m ruff format composer/
git add composer/ && git commit -m "feat(composer): analytics endpoint (distinct funnel + prediction record)"
```

---

## Self-Review (completed against the spec)

**Spec coverage:**
- `drafts` + `content_events` in `bot/db.py` metadata, FK cascade, created by `ensure_schema` — Task 1. ✓
- `composer/` package depends on `bot`, one-way; web deps isolated in `composer/requirements.txt` — Task 2. ✓
- Local-first config (DB URL, Gemini key, CORS) from env; artifact loaded in lifespan — Task 2. ✓
- Four content sources: bank (Task 4), bot (Task 5), llm (Task 6), freeform (Task 3 `POST /drafts`). ✓
- `card_meta` JSON boundary (dict at API, text in DB) — Task 3 `row_to_out`/`create_draft`. ✓
- Explicit-now timestamps everywhere — Tasks 3/5/6 use `_now()`. ✓
- Debounce is a frontend concern; the backend half — `edited` only on real change — is Task 3. ✓
- `/generate/bot` optional `fixture_id`, next-upcoming default, matchup vs pool kinds — Task 5. ✓
- Gemini structured `{text, card_meta}`, 503 when no key — Task 6. ✓
- Analytics funnel `COUNT(DISTINCT draft_id)` + raw totals + prediction record — Task 7. ✓
- All tests on SQLite in-memory reusing `bot.db` metadata; Gemini mocked; bot generators exercised, not mocked — every task's test step. ✓

**Placeholder scan:** none — every step carries complete code.

**Type consistency:** `DraftOut`/`DraftIn`/`DraftPatch`/`EventIn`/`ContentBankOut`/`GenerateBotIn`/`GenerateLlmIn`/`AnalyticsOut`/`CategoryCount` defined in `schemas.py`; `create_draft(conn, DraftIn, log_generated=False) -> DraftOut` and `log_event`/`_now` in `drafts.py` are reused by `generate.py`; `get_conn` yields a `sa.Connection` overridden in tests. Consistent across tasks.

**Deferred to the UI plan (plan 2 of 2):** feed screen, editor + 280 counter + 500ms debounce, three themed cards, `html-to-image` export (pixelRatio 2 / cacheBust / font-embed / same-origin assets), copy-text/copy-image/download, analytics screen. These consume the endpoints above.
