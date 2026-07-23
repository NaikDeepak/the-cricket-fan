# Composer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation of UI should also draw on the `frontend-design:frontend-design` skill for visual polish once structure is in place.

**Goal:** Build the Next.js composer UI — feed, editor, themed image cards, client-side PNG export (copy/download), and analytics — consuming the composer API (plan 1 of 2).

**Architecture:** A new `/composer` section in the existing Next.js 16 app. A typed client (`lib/composerApi.ts`) talks to the composer FastAPI. Content flows: feed (list drafts + 4 source entry points) → editor (autosave via PATCH) → card preview (3 themed cards rendered as off-screen twins) → export (extend the existing `lib/share.ts` `captureCard` with clipboard-copy). Reuses the proven scaffold patterns: `ShareDrawer`'s off-screen-twin capture, the CSS-variable theme, `lib/api.ts`'s fetch client shape.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19, Tailwind v4, GSAP, `html-to-image` (already installed), clsx + tailwind-merge, lucide-react. New dev deps: Vitest + @testing-library/react + happy-dom (no test framework exists yet).

**Depends on:** the composer API from `docs/superpowers/plans/2026-07-23-composer-api-plan.md` (endpoints `/drafts`, `/content-bank`, `/generate/bot`, `/generate/llm`, `/analytics`). Build/execute that plan first.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-manual-content-composer-design.md`. Implicit in every task.
- **This is NOT the Next.js in your training data.** Per `frontend/AGENTS.md`: before writing any Next.js routing/layout/server-component code, read the relevant guide in `frontend/node_modules/next/dist/docs/`. Mirror the existing working pages (`src/app/explore/page.tsx`, `src/app/match/[date]/page.tsx`) rather than inventing conventions.
- Client components (`"use client"`) for anything interactive (editor, cards, export, feed actions) — matches the scaffold (`ShareDrawer`, cards are all client).
- Theme via existing CSS variables (`--bg #030303`, `--surface`, `--fg`, `--muted`, `--border`, `--team-a #004ba0`, `--team-b #ffcb05`) and utility classes (`.card-container`, `.text-stat-hero`, `.text-section-headline`, `.text-micro`) from `globals.css`. Dark/stadium theme, cards not tables.
- Conditional classes via `clsx` + `tailwind-merge`; icons from `lucide-react`.
- API base from `process.env.NEXT_PUBLIC_API_URL` (default `http://localhost:8000`), same as `lib/api.ts`.
- **Image export same-origin rule:** any logo/texture/background *image* inside a card must be a local file under `public/` or an inline SVG — a cross-origin `<img>` taints the canvas and `toPng` throws. (Web fonts via `FontFace`/`document.fonts` are fine and already handled in `share.ts`.)
- Commands from `frontend/`: `npm run lint`, `npm run build`, `npm run test` (added in Task 1). Node/npm as installed.
- Do not touch the parked `lib/api.ts` endpoints (they target the parked `backend/app/`); add composer calls in a new `lib/composerApi.ts`.

---

## File Structure

```
frontend/
├── vitest.config.ts                    # NEW (Task 1)
├── vitest.setup.ts                     # NEW (mocks gsap; jest-dom)
├── src/
│   ├── lib/
│   │   ├── composerApi.ts              # NEW: typed composer client + types
│   │   └── share.ts                    # MODIFY: add copyImageToClipboard + sharp opts
│   ├── app/composer/
│   │   ├── layout.tsx                  # NEW: composer shell + nav
│   │   ├── page.tsx                    # NEW: feed (default view)
│   │   └── analytics/page.tsx          # NEW: analytics screen
│   └── components/composer/
│       ├── Feed.tsx                    # NEW: draft list + source entry points
│       ├── SourceBar.tsx               # NEW: bank/bot/llm/blank triggers
│       ├── Editor.tsx                  # NEW: textarea + counter + autosave
│       ├── useDebouncedSave.ts         # NEW: debounce hook
│       ├── CardPreview.tsx             # NEW: aspect switch + export actions + off-screen twins
│       └── cards/
│           ├── PredictionCardImg.tsx   # NEW themed card
│           ├── TriviaCardImg.tsx       # NEW themed card
│           └── RecordCardImg.tsx       # NEW themed card
└── src/lib/__tests__/                  # NEW: unit tests
```

---

### Task 1: Test harness + composer API client

**Files:**
- Create: `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`, `frontend/src/lib/composerApi.ts`, `frontend/src/lib/__tests__/composerApi.test.ts`
- Modify: `frontend/package.json` (dev deps + `test` script)

**Interfaces:**
- Produces: `lib/composerApi.ts` exporting types `Draft`, `ContentBankItem`, `Analytics`, and a `composerApi` object with methods: `listDrafts`, `createDraft`, `patchDraft`, `logEvent`, `contentBank`, `generateBot`, `generateLlm`, `analytics`. Types mirror the API's Pydantic models.

- [ ] **Step 1: Add dev deps + test script**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend
npm install -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 happy-dom@^15 @vitejs/plugin-react@^4
```

In `frontend/package.json` `scripts`, add:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Write `vitest.config.ts` and `vitest.setup.ts`**

`frontend/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`frontend/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// GSAP touches layout APIs happy-dom doesn't implement; stub it for tests.
vi.mock("@/lib/gsap", () => ({
  gsap: { to: vi.fn(), from: vi.fn(), set: vi.fn(), timeline: () => ({ to: vi.fn(), from: vi.fn() }) },
}));
```

- [ ] **Step 3: Write the failing test**

`frontend/src/lib/__tests__/composerApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

function mockFetch(json: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok, status, json: async () => json,
  } as Response);
}

describe("composerApi", () => {
  it("createDraft posts body and returns the draft", async () => {
    const draft = { id: 1, source: "freeform", category: null, text: "hi", card_type: null, card_meta: null, status: "draft", created_at: "t", posted_at: null };
    const f = mockFetch(draft, true, 201);
    const out = await composerApi.createDraft({ source: "freeform", text: "hi" });
    expect(out.id).toBe(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/drafts");
    expect(init?.method).toBe("POST");
  });

  it("generateLlm surfaces a 503 as a typed error", async () => {
    mockFetch({ detail: "LLM generation unavailable: GEMINI_API_KEY not configured" }, false, 503);
    await expect(composerApi.generateLlm({ prompt: "x" })).rejects.toThrow(/503/);
  });

  it("logEvent returns void on 204", async () => {
    mockFetch(null, true, 204);
    await expect(composerApi.logEvent(1, { action: "copied" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend && npm run test -- composerApi`
Expected: FAIL — `Cannot find module '@/lib/composerApi'`.

- [ ] **Step 5: Write `frontend/src/lib/composerApi.ts`**

```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CardMeta = Record<string, unknown>;

export type Draft = {
  id: number;
  source: "bank" | "bot" | "llm" | "freeform";
  category: string | null;
  text: string;
  card_type: "prediction" | "trivia" | "record" | null;
  card_meta: CardMeta | null;
  status: "draft" | "posted";
  created_at: string;
  posted_at: string | null;
};

export type ContentBankItem = {
  content_key: string;
  category: string;
  format: string;
  segments: string[];
  source: string;
};

export type Analytics = {
  funnel: Record<string, number>;
  event_totals: Record<string, number>;
  by_category: { category: string | null; drafts: number }[];
  prediction_record: { correct: number; total: number };
};

export type DraftIn = {
  source: Draft["source"];
  category?: string | null;
  text: string;
  card_type?: Draft["card_type"];
  card_meta?: CardMeta | null;
};

export type DraftPatch = Partial<Pick<Draft, "text" | "category" | "card_type" | "card_meta">>;
export type EventIn = { action: "generated" | "edited" | "copied" | "posted"; platform_hint?: string };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const composerApi = {
  listDrafts: (q: { status?: string; source?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<Draft[]>(`/drafts${p ? `?${p}` : ""}`);
  },
  createDraft: (body: DraftIn) => req<Draft>("/drafts", { method: "POST", body: JSON.stringify(body) }),
  patchDraft: (id: number, body: DraftPatch) =>
    req<Draft>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  logEvent: (id: number, body: EventIn) =>
    req<void>(`/drafts/${id}/event`, { method: "POST", body: JSON.stringify(body) }),
  contentBank: (category?: string) =>
    req<ContentBankItem[]>(`/content-bank${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  generateBot: (kind: string, fixtureId?: number) =>
    req<Draft>("/generate/bot", { method: "POST", body: JSON.stringify({ kind, fixture_id: fixtureId ?? null }) }),
  generateLlm: (body: { prompt: string; category?: string }) =>
    req<Draft>("/generate/llm", { method: "POST", body: JSON.stringify(body) }),
  analytics: () => req<Analytics>("/analytics"),
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend && npm run test -- composerApi`
Expected: PASS (3 tests).

- [ ] **Step 7: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/vitest.setup.ts frontend/src/lib/composerApi.ts frontend/src/lib/__tests__/composerApi.test.ts
git commit -m "feat(composer-ui): vitest harness + typed composer API client"
```

---

### Task 2: Composer route shell + navigation

**Files:**
- Create: `frontend/src/app/composer/layout.tsx`, `frontend/src/app/composer/page.tsx` (placeholder feed, filled in Task 3)

**Interfaces:**
- Consumes: nothing (route scaffold).
- Produces: a `/composer` route rendering under a shell with a header + nav links (Feed `/composer`, Analytics `/composer/analytics`). `page.tsx` is a client component that will host `<Feed/>`.

- [ ] **Step 1: Read the Next 16 routing/layout docs**

Before writing, read `frontend/node_modules/next/dist/docs/` for App Router layout/page conventions in this version, and open `src/app/explore/page.tsx` + `src/app/layout.tsx` to mirror the working pattern (client vs server component, metadata, imports).

- [ ] **Step 2: Write `frontend/src/app/composer/layout.tsx`**

Mirror the existing root layout structure. A minimal shell (adapt to the conventions you confirmed in Step 1):

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export default function ComposerLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <header
        className="flex items-center justify-between"
        style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-micro" style={{ color: "var(--fg)" }}>
          🏏 COMPOSER
        </span>
        <nav className="flex gap-6">
          <Link href="/composer" className="text-micro">FEED</Link>
          <Link href="/composer/analytics" className="text-micro">ANALYTICS</Link>
        </nav>
      </header>
      <main style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Write a placeholder `frontend/src/app/composer/page.tsx`**

```tsx
"use client";

export default function ComposerPage() {
  return <p className="text-micro">Feed loading…</p>;
}
```

- [ ] **Step 4: Verify it builds**

Run: `cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend && npm run build`
Expected: build succeeds; `/composer` route compiled. (If the build flags a Next 16 API mismatch, fix per the docs read in Step 1 — do not guess.)

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan/frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/app/composer/
git commit -m "feat(composer-ui): /composer route shell + nav"
```

---

### Task 3: Feed + source entry points

**Files:**
- Create: `frontend/src/components/composer/Feed.tsx`, `frontend/src/components/composer/SourceBar.tsx`, `frontend/src/components/composer/__tests__/SourceBar.test.tsx`
- Modify: `frontend/src/app/composer/page.tsx` (render `<Feed/>`)

**Interfaces:**
- Consumes: `composerApi` (Task 1).
- Produces:
  - `SourceBar({ onCreated }: { onCreated: (d: Draft) => void })` — four triggers: **Browse bank** (opens a list from `contentBank()`, clicking one calls `createDraft({source:"bank", text: item.segments[0], category: item.category})`), **Generate** (a `<select>` of kinds → `generateBot(kind)`), **LLM** (prompt input → `generateLlm`; disabled with a message when the call 503s), **Blank** (`createDraft({source:"freeform", text:""})`). Each resolves to a Draft passed to `onCreated`.
  - `Feed()` — lists drafts from `listDrafts()` as cards (text preview, source/category/status badges), renders `<SourceBar/>` on top; clicking a draft opens the editor (Task 4 wires the editor in; for this task, selecting sets local state and shows the raw text).

- [ ] **Step 1: Write the failing test**

`frontend/src/components/composer/__tests__/SourceBar.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SourceBar from "@/components/composer/SourceBar";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const draft = { id: 7, source: "freeform", category: null, text: "", card_type: null, card_meta: null, status: "draft", created_at: "t", posted_at: null } as const;

describe("SourceBar", () => {
  it("Blank creates a freeform draft and calls onCreated", async () => {
    vi.spyOn(composerApi, "createDraft").mockResolvedValue({ ...draft });
    const onCreated = vi.fn();
    render(<SourceBar onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: /blank/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 7 })));
  });

  it("LLM 503 shows a disabled message, no crash", async () => {
    vi.spyOn(composerApi, "generateLlm").mockRejectedValue(new Error("API /generate/llm → 503"));
    render(<SourceBar onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/prompt/i), { target: { value: "a fact" } });
    fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd .../frontend && npm run test -- SourceBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `frontend/src/components/composer/SourceBar.tsx`**

```tsx
"use client";
import { useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";

const BOT_KINDS = ["prediction", "trivia", "h2h", "venue", "record"];

export default function SourceBar({ onCreated }: { onCreated: (d: Draft) => void }) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState(BOT_KINDS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<Draft>) {
    setBusy(true);
    setError(null);
    try {
      onCreated(await fn());
    } catch (e) {
      setError(e instanceof Error && e.message.includes("503")
        ? "AI generation unavailable (GEMINI_API_KEY not configured)."
        : "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-container" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 12 }}>
      <button onClick={() => run(() => composerApi.createDraft({ source: "freeform", text: "" }))} disabled={busy} className="text-micro">
        + BLANK
      </button>
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="bot kind">
          {BOT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button onClick={() => run(() => composerApi.generateBot(kind))} disabled={busy} className="text-micro">
          GENERATE
        </button>
      </div>
      <div className="flex gap-2">
        <input
          placeholder="AI prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="prompt"
        />
        <button onClick={() => run(() => composerApi.generateLlm({ prompt }))} disabled={busy || !prompt} className="text-micro">
          GENERATE WITH AI
        </button>
      </div>
      {error && <p className="text-micro" style={{ color: "#ff6b6b", width: "100%" }}>{error}</p>}
    </div>
  );
}
```

(Browse-bank trigger: add a button that fetches `composerApi.contentBank()` and renders the returned items in a simple list; clicking one calls `createDraft({source:"bank", ...})`. Keep it a plain list — no modal library. Implement it alongside the above once the three simpler triggers pass; add a focused test that clicking a listed bank item calls `createDraft` with `source:"bank"`.)

- [ ] **Step 4: Write `frontend/src/components/composer/Feed.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

export default function Feed({ onSelect }: { onSelect: (d: Draft) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    composerApi.listDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, []);

  function handleCreated(d: Draft) {
    setDrafts((prev) => [d, ...prev]);
    onSelect(d);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SourceBar onCreated={handleCreated} />
      {drafts.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d)}
          className="card-container"
          style={{ padding: 16, textAlign: "left", cursor: "pointer" }}
        >
          <p className="text-micro">{d.source} · {d.category ?? "—"} · {d.status}</p>
          <p style={{ marginTop: 8 }}>{d.text.slice(0, 140) || "(empty)"}</p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire `Feed` into `frontend/src/app/composer/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import Feed from "@/components/composer/Feed";
import type { Draft } from "@/lib/composerApi";

export default function ComposerPage() {
  const [selected, setSelected] = useState<Draft | null>(null);
  // Editor + CardPreview mount here in later tasks; for now show the selection.
  return (
    <div>
      <Feed onSelect={setSelected} />
      {selected && <p className="text-micro" style={{ marginTop: 24 }}>Selected #{selected.id}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Run tests + build to verify**

Run: `cd .../frontend && npm run test -- SourceBar && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 7: Lint + commit**

```bash
cd .../frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/components/composer/ frontend/src/app/composer/page.tsx
git commit -m "feat(composer-ui): feed + four-source entry bar"
```

---

### Task 4: Editor — textarea, 280 counter, debounced autosave

**Files:**
- Create: `frontend/src/components/composer/useDebouncedSave.ts`, `frontend/src/components/composer/Editor.tsx`, `frontend/src/components/composer/__tests__/Editor.test.tsx`
- Modify: `frontend/src/app/composer/page.tsx` (mount `<Editor/>` for the selected draft)

**Interfaces:**
- Consumes: `composerApi.patchDraft`, `composerApi.logEvent`.
- Produces:
  - `useDebouncedSave<T>(value: T, onSave: (v: T) => void, delayMs = 500)` — fires `onSave` `delayMs` after `value` stops changing; never on mount.
  - `Editor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void })` — textarea bound to `draft.text`, a live char counter (soft-warns past 280, never blocks), a category input, a card-type select. On debounced change, calls `patchDraft(id, {text, category, card_type})` and lifts the returned draft via `onChange`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/composer/__tests__/Editor.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Editor from "@/components/composer/Editor";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const draft = { id: 3, source: "freeform", category: null, text: "hi", card_type: null, card_meta: null, status: "draft", created_at: "t", posted_at: null } as const;

describe("Editor", () => {
  it("counter warns past 280 without blocking input", () => {
    render(<Editor draft={{ ...draft, text: "x".repeat(285) }} onChange={vi.fn()} />);
    expect(screen.getByText(/285\s*\/\s*280/)).toBeInTheDocument();
    expect(screen.getByLabelText(/post text/i)).toHaveValue("x".repeat(285));
  });

  it("debounced edit calls patchDraft once", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(composerApi, "patchDraft").mockResolvedValue({ ...draft, text: "hiya" });
    render(<Editor draft={{ ...draft }} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/post text/i), { target: { value: "hiya" } });
    await vi.advanceTimersByTimeAsync(600);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(3, expect.objectContaining({ text: "hiya" }));
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd .../frontend && npm run test -- Editor`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `frontend/src/components/composer/useDebouncedSave.ts`**

```ts
import { useEffect, useRef } from "react";

export function useDebouncedSave<T>(value: T, onSave: (v: T) => void, delayMs = 500) {
  const mounted = useRef(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return; // never fire on initial mount
    }
    const id = setTimeout(() => saveRef.current(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
}
```

- [ ] **Step 4: Write `frontend/src/components/composer/Editor.tsx`**

```tsx
"use client";
import { useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import { useDebouncedSave } from "./useDebouncedSave";

const CARD_TYPES = ["prediction", "trivia", "record"] as const;

export default function Editor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const [text, setText] = useState(draft.text);
  const [category, setCategory] = useState(draft.category ?? "");
  const [cardType, setCardType] = useState(draft.card_type ?? "record");

  useDebouncedSave({ text, category, cardType }, async (v) => {
    const updated = await composerApi.patchDraft(draft.id, {
      text: v.text,
      category: v.category || null,
      card_type: v.cardType as Draft["card_type"],
    });
    onChange(updated);
  });

  const over = text.length > 280;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea
        aria-label="post text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        style={{ background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--border)", padding: 12, fontFamily: "inherit" }}
      />
      <div className="flex justify-between items-center">
        <span className="text-micro" style={{ color: over ? "#ffcb05" : "var(--muted)" }}>
          {text.length} / 280{over ? " (long for X)" : ""}
        </span>
        <div className="flex gap-2">
          <input aria-label="category" placeholder="category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <select aria-label="card type" value={cardType} onChange={(e) => setCardType(e.target.value)}>
            {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Mount the editor for the selected draft in `page.tsx`**

Replace the placeholder selection line with `<Editor draft={selected} onChange={setSelected} />` when `selected` is set. Keep `<Feed onSelect={setSelected} />` above it.

- [ ] **Step 6: Run tests + build to verify they pass**

Run: `cd .../frontend && npm run test -- Editor && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 7: Lint + commit**

```bash
cd .../frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/components/composer/ frontend/src/app/composer/page.tsx
git commit -m "feat(composer-ui): editor with 280 counter + 500ms debounced autosave"
```

---

### Task 5: Themed cards + preview with aspect switch

**Files:**
- Create: `frontend/src/components/composer/cards/PredictionCardImg.tsx`, `TriviaCardImg.tsx`, `RecordCardImg.tsx`, `frontend/src/components/composer/CardPreview.tsx`, `frontend/src/components/composer/__tests__/cards.test.tsx`

**Interfaces:**
- Consumes: `Draft` (`text`, `card_type`, `card_meta`).
- Produces:
  - Three card components, each `forwardRef<HTMLDivElement, { draft: Draft; ratio: Ratio }>` where `Ratio = "1:1" | "16:9" | "4:5"`, rendering a fixed-pixel branded card (dimensions per ratio: 1080×1080, 1200×675, 1080×1350) using the theme vars. `card_meta` supplies structured fields (prediction: team_a/team_b/prob_a; trivia: options; record: headline) with the `text` as fallback body.
  - `CardPreview({ draft }: { draft: Draft })` — picks the card by `draft.card_type` (default `record`), an on-screen scaled preview + a ratio selector; renders the full-size card as a hidden off-screen twin with a `ref` for export (mirrors `ShareDrawer`'s off-screen-twin approach). Export buttons are added in Task 6 (this task lands the components + selection; export wiring is Task 6).

- [ ] **Step 1: Read an existing card for the visual pattern**

Read `src/components/share/ShockStatCard.tsx` and `src/components/trivia/TriviaCard.tsx` to match ratio handling, `forwardRef`, fixed sizing, and theme usage. Mirror their structure.

- [ ] **Step 2: Write the failing test**

`frontend/src/components/composer/__tests__/cards.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardPreview from "@/components/composer/CardPreview";
import type { Draft } from "@/lib/composerApi";

const base: Draft = { id: 1, source: "bot", category: null, text: "body text", card_type: "record", card_meta: null, status: "draft", created_at: "t", posted_at: null };

describe("themed cards", () => {
  it("renders a prediction card with team + probability from card_meta", () => {
    render(<CardPreview draft={{ ...base, card_type: "prediction", card_meta: { team_a: "CSK", team_b: "MI", prob_a: 0.62 } }} />);
    expect(screen.getAllByText(/CSK/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/62%/).length).toBeGreaterThan(0);
  });

  it("renders a record card falling back to text when card_meta is null", () => {
    render(<CardPreview draft={{ ...base }} />);
    expect(screen.getAllByText(/body text/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Write the three card components**

Each is a fixed-size branded card. `PredictionCardImg.tsx` (mirror for the others with their fields):

```tsx
"use client";
import { forwardRef } from "react";
import type { Draft } from "@/lib/composerApi";

export type Ratio = "1:1" | "16:9" | "4:5";
export const DIMS: Record<Ratio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1200, h: 675 },
  "4:5": { w: 1080, h: 1350 },
};

const frame = (ratio: Ratio): React.CSSProperties => ({
  width: DIMS[ratio].w,
  height: DIMS[ratio].h,
  background: "var(--bg)",
  color: "var(--fg)",
  padding: 72,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  fontFamily: "Space Grotesk, sans-serif",
});

const PredictionCardImg = forwardRef<HTMLDivElement, { draft: Draft; ratio: Ratio }>(
  function PredictionCardImg({ draft, ratio }, ref) {
    const m = draft.card_meta ?? {};
    const teamA = String(m.team_a ?? "Team A");
    const teamB = String(m.team_b ?? "Team B");
    const probA = typeof m.prob_a === "number" ? m.prob_a : 0.5;
    const favPct = Math.round(Math.max(probA, 1 - probA) * 100);
    const fav = probA >= 0.5 ? teamA : teamB;
    return (
      <div ref={ref} style={frame(ratio)}>
        <span className="text-micro">🏏 THE CRICKET FAN · PREDICTION</span>
        <div>
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>{favPct}%</div>
          <div style={{ fontSize: 48, fontWeight: 600 }}>{fav} favoured</div>
          <div className="text-micro" style={{ marginTop: 16 }}>{teamA} vs {teamB}</div>
        </div>
        <span className="text-micro">#Cricket</span>
      </div>
    );
  }
);
export default PredictionCardImg;
```

`TriviaCardImg.tsx` — render `draft.text` as the question/body and `card_meta.options` (array) as up to four option rows; same frame. `RecordCardImg.tsx` — render `card_meta.headline` (fallback: first line of `draft.text`) big, and the rest of `draft.text` as the supporting line; same frame. Keep all three visually consistent (shared frame helper may be extracted into a `cardFrame.ts`).

- [ ] **Step 4: Write `frontend/src/components/composer/CardPreview.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import type { Draft } from "@/lib/composerApi";
import PredictionCardImg, { DIMS, type Ratio } from "./cards/PredictionCardImg";
import TriviaCardImg from "./cards/TriviaCardImg";
import RecordCardImg from "./cards/RecordCardImg";

const RATIOS: Ratio[] = ["1:1", "16:9", "4:5"];

export default function CardPreview({ draft }: { draft: Draft }) {
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const cardRef = useRef<HTMLDivElement>(null);
  const type = draft.card_type ?? "record";
  const Card = type === "prediction" ? PredictionCardImg : type === "trivia" ? TriviaCardImg : RecordCardImg;
  const dim = DIMS[ratio];
  const scale = 360 / dim.w;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flex gap-2">
        {RATIOS.map((r) => (
          <button key={r} onClick={() => setRatio(r)} className="text-micro"
            style={{ borderBottom: r === ratio ? "2px solid var(--team-b)" : "none" }}>
            {r}
          </button>
        ))}
      </div>
      {/* On-screen scaled preview */}
      <div style={{ width: dim.w * scale, height: dim.h * scale, overflow: "hidden" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <Card draft={draft} ratio={ratio} />
        </div>
      </div>
      {/* Off-screen full-size twin for export (Task 6 reads cardRef) */}
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <Card draft={draft} ratio={ratio} ref={cardRef} />
      </div>
      {/* Export actions injected in Task 6 */}
    </div>
  );
}
```

- [ ] **Step 5: Run tests + build to verify they pass**

Run: `cd .../frontend && npm run test -- cards && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 6: Lint + commit**

```bash
cd .../frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/components/composer/
git commit -m "feat(composer-ui): three themed image cards + preview with aspect switch"
```

---

### Task 6: Export actions — copy image/text, download, event logging

**Files:**
- Modify: `frontend/src/lib/share.ts` (add clipboard copy + sharp options), `frontend/src/components/composer/CardPreview.tsx` (export buttons)
- Create: `frontend/src/lib/__tests__/share.test.ts`, `frontend/src/components/composer/__tests__/exportActions.test.tsx`

**Interfaces:**
- Consumes: `captureCard` (existing), `html-to-image`, `composerApi.logEvent`.
- Produces:
  - In `share.ts`: `captureCard(el)` gains `{ cacheBust: true, fontEmbedCSS }` options; new `copyImageToClipboard(blob: Blob): Promise<void>` using `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`.
  - In `CardPreview`: **Copy image**, **Download image**, **Copy text** buttons; **Mark posted** button. Copy/download fire `composerApi.logEvent(draft.id, {action:"copied"})`; Mark posted fires `{action:"posted", platform_hint}`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/__tests__/share.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("html-to-image", () => ({ toPng: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }));

afterEach(() => vi.restoreAllMocks());

describe("copyImageToClipboard", () => {
  it("writes a ClipboardItem", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error partial mock
    globalThis.ClipboardItem = class { constructor(public items: unknown) {} };
    Object.assign(navigator, { clipboard: { write } });
    const { copyImageToClipboard } = await import("@/lib/share");
    await copyImageToClipboard(new Blob(["x"], { type: "image/png" }));
    expect(write).toHaveBeenCalledTimes(1);
  });
});
```

`frontend/src/components/composer/__tests__/exportActions.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/share", () => ({
  captureCard: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })),
  copyImageToClipboard: vi.fn().mockResolvedValue(undefined),
  shareCard: vi.fn().mockResolvedValue(undefined),
}));

import CardPreview from "@/components/composer/CardPreview";
import { composerApi } from "@/lib/composerApi";
import type { Draft } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());
const draft: Draft = { id: 5, source: "bot", category: null, text: "t", card_type: "record", card_meta: null, status: "draft", created_at: "t", posted_at: null };

describe("export actions", () => {
  it("Copy image logs a copied event", async () => {
    const spy = vi.spyOn(composerApi, "logEvent").mockResolvedValue(undefined);
    render(<CardPreview draft={draft} />);
    fireEvent.click(screen.getByRole("button", { name: /copy image/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(5, { action: "copied" }));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd .../frontend && npm run test -- share exportActions`
Expected: FAIL — `copyImageToClipboard` not exported / buttons absent.

- [ ] **Step 3: Extend `frontend/src/lib/share.ts`**

Add sharp options to `captureCard`'s `toPng` call — `cacheBust: true` (keep the existing `width`/`height`/`pixelRatio: 2`) — and append:

```ts
export async function copyImageToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
```

- [ ] **Step 4: Add export buttons to `CardPreview.tsx`**

At the "Export actions injected in Task 6" comment, add a row of buttons that operate on `cardRef.current`:

```tsx
      <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
        <button className="text-micro" onClick={async () => {
          if (!cardRef.current) return;
          const blob = await captureCard(cardRef.current);
          await copyImageToClipboard(blob);
          await composerApi.logEvent(draft.id, { action: "copied" });
        }}>COPY IMAGE</button>
        <button className="text-micro" onClick={async () => {
          if (!cardRef.current) return;
          const blob = await captureCard(cardRef.current);
          await shareCard(blob, `cricket-${draft.id}-${ratio.replace(":", "x")}.png`);
          await composerApi.logEvent(draft.id, { action: "copied" });
        }}>DOWNLOAD</button>
        <button className="text-micro" onClick={async () => {
          await navigator.clipboard.writeText(draft.text);
          await composerApi.logEvent(draft.id, { action: "copied" });
        }}>COPY TEXT</button>
        <button className="text-micro" onClick={() => composerApi.logEvent(draft.id, { action: "posted", platform_hint: "manual" })}>
          MARK POSTED
        </button>
      </div>
```

Add the imports at the top of `CardPreview.tsx`:

```tsx
import { captureCard, copyImageToClipboard, shareCard } from "@/lib/share";
import { composerApi } from "@/lib/composerApi";
```

- [ ] **Step 5: Run tests + build to verify they pass**

Run: `cd .../frontend && npm run test -- share exportActions && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 6: Lint + commit**

```bash
cd .../frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/lib/share.ts frontend/src/components/composer/
git commit -m "feat(composer-ui): copy/download/copy-text export + event logging"
```

---

### Task 7: Analytics screen

**Files:**
- Create: `frontend/src/app/composer/analytics/page.tsx`, `frontend/src/components/composer/AnalyticsView.tsx`, `frontend/src/components/composer/__tests__/analytics.test.tsx`

**Interfaces:**
- Consumes: `composerApi.analytics()`.
- Produces: `AnalyticsView()` — fetches analytics on mount; renders stat cards (no tables): funnel (generated → copied → posted, distinct-draft counts), a prediction season-record card (`correct/total` + %), and a per-category breakdown as cards. `analytics/page.tsx` renders `<AnalyticsView/>`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/composer/__tests__/analytics.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnalyticsView from "@/components/composer/AnalyticsView";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

describe("AnalyticsView", () => {
  it("shows funnel counts and prediction record", async () => {
    vi.spyOn(composerApi, "analytics").mockResolvedValue({
      funnel: { generated: 10, copied: 6, posted: 4 },
      event_totals: { generated: 10, copied: 9, posted: 4 },
      by_category: [{ category: "prediction", drafts: 5 }],
      prediction_record: { correct: 8, total: 13 },
    });
    render(<AnalyticsView />);
    await waitFor(() => expect(screen.getByText(/8\s*\/\s*13/)).toBeInTheDocument());
    expect(screen.getByText(/generated/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // posted
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd .../frontend && npm run test -- analytics`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `frontend/src/components/composer/AnalyticsView.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { composerApi, type Analytics } from "@/lib/composerApi";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-container" style={{ padding: 20, minWidth: 140 }}>
      <p className="text-micro">{label}</p>
      <p style={{ fontSize: 44, fontWeight: 700, marginTop: 8 }}>{value}</p>
    </div>
  );
}

export default function AnalyticsView() {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => { composerApi.analytics().then(setA).catch(() => setA(null)); }, []);
  if (!a) return <p className="text-micro">Loading…</p>;
  const { correct, total } = a.prediction_record;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <p className="text-micro" style={{ marginBottom: 12 }}>FUNNEL (DISTINCT DRAFTS)</p>
        <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
          <Stat label="generated" value={a.funnel.generated ?? 0} />
          <Stat label="copied" value={a.funnel.copied ?? 0} />
          <Stat label="posted" value={a.funnel.posted ?? 0} />
        </div>
      </section>
      <section>
        <p className="text-micro" style={{ marginBottom: 12 }}>PREDICTION RECORD</p>
        <Stat label={`season · ${pct}%`} value={`${correct} / ${total}`} />
      </section>
      <section>
        <p className="text-micro" style={{ marginBottom: 12 }}>BY CATEGORY</p>
        <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
          {a.by_category.map((c) => <Stat key={c.category ?? "none"} label={c.category ?? "—"} value={c.drafts} />)}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/app/composer/analytics/page.tsx`**

```tsx
"use client";
import AnalyticsView from "@/components/composer/AnalyticsView";

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
```

- [ ] **Step 5: Wire `CardPreview` into the page under the editor**

In `frontend/src/app/composer/page.tsx`, render `<CardPreview draft={selected} />` beside/under `<Editor/>` when a draft is selected, so the full compose→preview→export flow works on one screen.

- [ ] **Step 6: Run the full frontend test suite + build**

Run: `cd .../frontend && npm run test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 7: Lint + commit**

```bash
cd .../frontend && npm run lint
cd /Users/deepaknaik/Downloads/world-building/the-cricket-fan
git add frontend/src/app/composer/ frontend/src/components/composer/
git commit -m "feat(composer-ui): analytics screen + full compose→preview→export flow"
```

---

## Self-Review (completed against the spec)

**Spec coverage:**
- View/browse content + four source entry points (bank/bot/llm/blank) — Task 3 `SourceBar`/`Feed`. ✓
- Editor with 280 soft-warn counter + 500ms debounced autosave + edited-only-on-change (backend enforces) — Task 4. ✓
- Themed cards per content type (prediction/trivia/record) + aspect switch (1:1 / 16:9 / 4:5) — Task 5. ✓
- Client-side `html-to-image` export, copy PNG via `ClipboardItem`, download, copy text; `pixelRatio:2` + `cacheBust` + font handling; off-screen twin pattern reused from `ShareDrawer` — Tasks 5-6. ✓
- Event logging on copy/post feeding the funnel — Task 6. ✓
- Analytics screen: distinct-draft funnel + prediction record + by-category, cards not tables — Task 7. ✓
- Local-first (API base from `NEXT_PUBLIC_API_URL`), dark/stadium theme via existing CSS vars — Global Constraints + every task. ✓
- Same-origin image assets rule stated; Next 16 docs-read mandated before routing code — Global Constraints + Task 2. ✓

**Placeholder scan:** the browse-bank trigger (Task 3 Step 3) and the Trivia/Record card bodies (Task 5 Step 3) are described rather than fully coded, with exact prop/behavior specs and a pattern-reference to an existing file — deliberate, because they mirror a sibling that IS fully coded in the same step (the three simpler SourceBar triggers; the fully-coded `PredictionCardImg`). Not free-floating TODOs.

**Type consistency:** `Draft`/`ContentBankItem`/`Analytics`/`DraftIn`/`DraftPatch`/`EventIn` from `composerApi.ts` are used unchanged across Feed, Editor, cards, CardPreview, AnalyticsView. `Ratio`/`DIMS` defined in `PredictionCardImg.tsx`, imported by `CardPreview` and the sibling cards. `captureCard`/`copyImageToClipboard`/`shareCard` signatures in `share.ts` match their call sites.

**Sequence note:** execute the composer **API** plan first — every task here hits endpoints it defines. The two plans share no files (API is Python under `composer/`; UI is TypeScript under `frontend/`), so they can also be reviewed independently.
```
