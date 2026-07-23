# Manual Content Composer — Design

## Problem

The automated bot posts predictions/trivia to X on a cron via the official
API. It has no path for the richer, human-in-the-loop content the owner wants
to publish by hand: styled image cards, anecdotes/stories, memes, and captions
posted across platforms the bot doesn't touch (X image posts, Facebook,
Instagram, WhatsApp groups, Telegram). Those platforms either have no free
posting API or are image-first, and automating their web sessions is a ToS/ban
risk that was explicitly ruled out.

Goal: a **local-first composer UI** that does all the heavy lifting — surface
existing content, generate new content, edit it, and render a branded image
card — leaving only the final post as a manual copy-paste the owner performs.
No browser automation, no API posting, no scraping.

## Non-goals

- **No posting automation of any kind.** No Playwright/Puppeteer sessions, no
  share-intent deep links, no platform SDKs. The tool's last step is always a
  human copy-paste.
- **No engagement scraping.** Platform likes/impressions are never pulled
  programmatically. (See Analytics for what "our own analytics" means instead.)
- **No auth in v1.** Runs local-only; a later deploy pass adds auth (designed
  for, not built now).
- **No manual engagement entry in v1** (deferred; funnel + prediction accuracy
  only).
- **Does not touch the automated bot's posting path.** The bot keeps
  auto-posting to X unchanged. This tool is a complementary, separate channel.
- **Does not revive `backend/app/`** (the parked Cricsheet web app). The
  composer builds on the live `bot/` package.

## Architecture

Two local processes, matching the documented monorepo tiers but wired to the
live bot data — not the parked web app:

```
frontend (Next.js 16, localhost:3000)   composer API (FastAPI, localhost:8000)
  composer UI + client-side image  <-->    reuses bot/: db, compose,
  rendering (html-to-image)                trivia_standalone, predict
                                           + thin Gemini client
                                                 |
                                           Neon Postgres (the bot's DB)
                                           content_bank, predictions,
                                           drafts (new), content_events (new)
```

**Key decision — build on `bot/`, not `backend/app/`.** The live content
(`content_bank`, `predictions`) and the generators (`compose.py`,
`trivia_standalone.py`, `predict.py`) already exist in the `bot/` package
(sync SQLAlchemy Core, Neon). The composer API **imports and reuses** those
modules rather than reimplementing generation or defining a second ORM over the
same tables. `backend/app/` (async ORM, Cricsheet story domain) stays parked
and untouched.

**Composer API location & deps.** A new top-level package `composer/`
(FastAPI) that depends on `bot` as a library. `bot` does **not** depend on
`composer`, so the GitHub Actions cron stays lean (FastAPI/uvicorn deps live in
`composer/requirements.txt`, never added to `bot/requirements.txt`). The
composer uses sync endpoints (`def`, offloaded via FastAPI's threadpool) since
`bot` is sync Core.

**Schema source of truth stays in `bot/db.py`.** The two new tables (`drafts`,
`content_events`) are added to `bot/db.py`'s existing `metadata`, created by the
existing idempotent `ensure_schema` — the same pattern `content_bank` followed.
The cron harmlessly creates two unused tables; the composer reuses the one
metadata. No second schema definition.

**Local-first, deploy-later.** v1 binds to localhost with no auth. Config
(DB URL, Gemini key, CORS origin, API base URL) comes from env, and the
frontend reads the API base from `NEXT_PUBLIC_API_URL` — so a later Vercel
deploy + auth gate is a config/middleware pass, not a rewrite.

## Content sources (all four)

The composer feed is populated from four independent sources, each producing a
draft the owner can edit:

| Source | Backing | Notes |
|---|---|---|
| `bank` | `content_bank` rows | Browse seeded anecdotes/stories/wiki_records. Read-only pull into a draft. |
| `bot` | `compose.py` / `trivia_standalone.py` / `predict.py` | Regenerate the same content the bot makes (prediction, trivia, H2H, venue, records) for manual posting. Reuse, no reimplementation. |
| `llm` | Gemini (thin client) | "Generate" from a prompt → anecdote/meme/caption text. New runtime LLM path (cost — see below). |
| `freeform` | none | Blank editor; type or paste anything. |

## Data model

**Reused unchanged:** `content_bank`, `predictions` (from `bot/db.py`).

**New tables (added to `bot/db.py` metadata):**

```python
drafts = sa.Table(
    "drafts", metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("source", sa.String(16), nullable=False),
    # 'bank' | 'bot' | 'llm' | 'freeform'
    sa.Column("category", sa.String(24), nullable=True),
    # e.g. 'prediction' | 'trivia' | 'anecdote' | 'record' | 'meme' | null
    sa.Column("text", sa.Text, nullable=False),
    sa.Column("card_type", sa.String(16), nullable=True),
    # which themed card the UI last used: 'prediction'|'trivia'|'record'|null
    sa.Column("card_meta_json", sa.Text, nullable=True),
    # optional structured fields a themed card needs (team names, win %, Q/A)
    sa.Column("status", sa.String(12), nullable=False, default="draft"),
    # 'draft' | 'posted'
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
)

content_events = sa.Table(
    "content_events", metadata,
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
    # free-text tag the owner optionally sets when marking posted (x/ig/fb/...)
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
```

`drafts` is the "content created" store the UI lists. `content_events` is the
funnel. Both created via `ensure_schema` on any dialect (no dialect-specific
migration; unlike `content_bank`'s live-table history, these are brand-new).
`content_events.draft_id` cascades on draft delete so events never orphan.

**Timestamps stay explicit, not `server_default`.** Every insert in `bot/`
passes `created_at=now`/`posted_at=now` with `now` injected into `tick(now)`,
and tests assert on that injected value (`trivia_log.posted_at == now`). The
composer handlers follow the same convention — pass `datetime.now(timezone.utc)`
at each insert (one line) — so timestamps stay deterministic under test and
consistent with the rest of the package. No DB-clock `server_default`.

**JSON boundary — `card_meta_json` (text) ↔ `card_meta` (object).** The DB
column stores JSON text, but the API never exposes escaped strings: Pydantic
response/request models carry `card_meta: dict | None`, serializing to/from the
`card_meta_json` column at the API boundary. The frontend sends and receives
plain objects (e.g. `{"team_a": "IND", "team_b": "AUS", "prob": 0.65}`).

## API endpoints (composer FastAPI)

| Method + path | Purpose |
|---|---|
| `GET /content-bank` | List `content_bank` rows (paginated, filter by category) to pull into a draft. |
| `POST /generate/bot` | Body `{kind, fixture_id?}` (kind: prediction/trivia/h2h/venue/record) → generated text (+ `card_meta`) via the bot generators. `fixture_id` targets a specific upcoming match; when omitted, the handler picks the next upcoming fixture (matchup-based kinds need a fixture — `compose.prediction_post` consumes team_a/team_b/prob/etc.). Creates a `draft` (source=`bot`), logs `generated`. |
| `POST /generate/llm` | Body `{prompt, category}` → Gemini **structured JSON** `{text, card_meta?}` (headline/body fields so themed cards auto-populate). Creates a `draft` (source=`llm`), logs `generated`. |
| `POST /drafts` | Create a draft (source=`freeform` or from a `bank` pull). |
| `GET /drafts` | List drafts (filter by status/source/category). |
| `PATCH /drafts/{id}` | Edit text/category/card fields; logs `edited`. |
| `POST /drafts/{id}/event` | Body `{action, platform_hint?}` — log `copied` or `posted`; `posted` also sets `drafts.status='posted'` + `posted_at`. |
| `GET /analytics` | Funnel counts (by action/category/day) + prediction season record (from `predictions.outcome`). |

All response/request shapes are Pydantic v2 models. Sync handlers reusing
`bot` modules; DB access via `bot.db` tables and a per-request connection.

## Frontend (Next.js 16 composer)

Revive the parked scaffold into a composer. App Router, dark/stadium theme,
GSAP micro-interactions, cards not tables (per project frontend standards).

**Screens / flow:**
1. **Feed** — lists drafts + entry points to the four sources (browse bank,
   generate-bot dropdown, LLM prompt box, new blank). Each card shows text
   preview, source/category, status.
2. **Editor** — textarea with a live **280-char counter** (soft warning past
   280, since some target platforms allow more — never blocks), category tag,
   card-type selector. Autosaves via `PATCH /drafts/{id}`, **debounced 500ms**
   so a keystroke doesn't fire a request per character. The backend logs an
   `edited` event only when `text` or `card_type`/`card_meta` actually differ
   from the stored row — a no-op PATCH records nothing.
3. **Card preview** — renders the themed card (below) live; aspect switch
   **1:1 / 16:9 / portrait 4:5**; buttons **Copy text**, **Copy image**,
   **Download image**. Copy/marked-posted fire `POST /drafts/{id}/event`.
4. **Analytics** — funnel + prediction season record, rendered as
   stat/gradient cards.

## Image rendering (approach A — client-side)

The themed card is a real styled React component. A hidden, correctly-sized
node renders it; `html-to-image` (`toPng`) snapshots it. **Copy image** writes
the PNG blob to the clipboard via `navigator.clipboard.write([new
ClipboardItem({'image/png': blob})])`; **Download image** saves it. No server
render path. Aspect ratio = the card node's fixed dimensions per selection
(1080×1080, 1200×675, 1080×1350).

Export options and asset rules (all failure modes html-to-image is prone to):
- `toPng(node, { pixelRatio: 2, cacheBust: true, fontEmbedCSS: <embedded> })`
  — `pixelRatio: 2` renders retina-sharp (e.g. 2160×2160 for a 1080 card);
  `cacheBust` dodges stale image caching; embedding font CSS prevents a
  fallback-font snapshot.
- Await `document.fonts.ready` before the snapshot (font-swap glitch).
- All card assets — logo mark, watermark, background textures — are **local
  static files under `public/` or inline SVG**, never remote URLs. A
  cross-origin `<img>` taints the canvas and makes `toPng` throw; keeping
  assets same-origin avoids the CORS failure entirely.

## Themed cards (per content type)

Three card layouts in v1, each a component consuming `{text, card_meta}`:
- **prediction** — two teams + win-% split (from `card_meta`: team_a, team_b,
  prob), reasoning line.
- **trivia** — question + four options (+ optional revealed answer).
- **record / anecdote** — headline stat/number + subject + supporting line.

All share the branded frame (logo mark, dark/stadium palette, `#Cricket`
footer). `card_type` + `card_meta_json` persist on the draft so a reopened
draft re-renders the same card. Freeform/LLM drafts default to the
record/anecdote card unless the owner picks another.

## Analytics (v1: automatic only)

- **Tool funnel** — aggregate `content_events` by action × category × day:
  how many pieces generated → copied → posted. First-party, automatic.
  Conversion counts use `COUNT(DISTINCT draft_id)` per action, so a draft
  copied five times counts as one copied draft — copy/post rates can't exceed
  the generated count. Raw event totals stay available separately (activity
  volume vs. conversion are different questions).
- **Prediction accuracy** — season record from `predictions.outcome`
  (correct/total), reusing the bot's existing `_season_record` logic. Both a
  credibility stat and postable content ("we're 62% this season").

No manual engagement entry, no scraping (deferred / out of scope).

## Gemini LLM path

Reuse the existing `GEMINI_API_KEY` (already configured for the parked web
app's story service). The composer adds a **thin, self-contained Gemini
client** (not a dependency on `backend/app/services`, which is async-ORM
coupled) called only on explicit `POST /generate/llm`. Cost control: it fires
only on a button press (never per page load), and the generated text persists
as a `draft` so re-opening never regenerates. Missing key → the LLM source is
disabled in the UI with a clear message; the other three sources work without
it.

## Testing

**Composer API (pytest, sync, SQLite in-memory reusing `bot.db` metadata):**
- `/content-bank` lists + filters seeded rows.
- `/generate/bot` returns text for each kind and creates a `draft` + a
  `generated` event (bot generators exercised, not mocked); with `fixture_id`
  omitted it targets the next upcoming fixture, and with an explicit
  `fixture_id` it targets that match.
- `/generate/llm` with the Gemini client mocked: parses the structured
  `{text, card_meta}` into an `llm` draft; and with no key, returns a clear
  disabled response (no crash).
- `card_meta` boundary: a draft saved with a `card_meta` object round-trips —
  stored as `card_meta_json` text, returned as an object, never an escaped
  string.
- drafts CRUD: create/list/patch; a patch that changes text logs one `edited`
  event; a no-op patch (identical text/card) logs **no** event.
- `/drafts/{id}/event`: `copied` logs an event; `posted` also flips status +
  sets `posted_at`.
- `/analytics`: funnel over a mix of events — a draft copied 3× counts once in
  the `COUNT(DISTINCT draft_id)` conversion, raw totals stay separate — and the
  prediction record matches `_season_record` on seeded outcomes.

**Frontend:**
- Each themed card renders for its content type with representative
  `card_meta`.
- Image-export smoke test: `toPng` on a card node returns a non-empty PNG
  data URL (jsdom/happy-dom + mocked `html-to-image`).
- A `copied` event POST fires when Copy text/image is clicked.
- Char counter shows the soft warning past 280 without blocking.

## Out of scope (future phases)

- Auth + Vercel deploy (designed-for, not built).
- Manual engagement entry; any platform metric ingestion.
- Additional card themes beyond the three; per-post custom colors/fonts.
- Scheduling/queue of drafts (v1 is compose-then-copy, no time dimension).
- Meme image compositing beyond the text card (image uploads/overlays).

## Locked decisions (from brainstorming)

1. Complement the automated bot — bot's X posting is untouched.
2. Copy-only, platform-agnostic — no share intents, no per-platform API.
3. All four content sources (bank / bot / llm / freeform).
4. v1 analytics = tool funnel + prediction accuracy, both automatic.
5. Local-first v1, designed for later auth + deploy.
6. Themed cards per content type (prediction / trivia / record-anecdote),
   multiple aspect ratios.
7. Client-side `html-to-image` for PNG (approach A).
8. Build on `bot/` (reuse db + generators); `backend/app/` stays parked.
