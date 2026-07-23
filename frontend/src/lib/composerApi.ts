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
  content_key: string | null;
};

export type ContentBankItem = {
  content_key: string;
  category: string;
  format: string;
  segments: string[];
  source: string;
  used: boolean;
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
  content_key?: string | null;
};

export type DraftPatch = Partial<
  Pick<Draft, "text" | "category" | "card_type" | "card_meta">
>;
export type EventIn = {
  action: "generated" | "edited" | "copied" | "posted";
  platform_hint?: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // body not JSON or empty — fall through with no detail
    }
    throw new Error(`API ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const composerApi = {
  listDrafts: (q: { status?: string; source?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<Draft[]>(`/drafts${p ? `?${p}` : ""}`);
  },
  createDraft: (body: DraftIn) =>
    req<Draft>("/drafts", { method: "POST", body: JSON.stringify(body) }),
  patchDraft: (id: number, body: DraftPatch) =>
    req<Draft>(`/drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  logEvent: (id: number, body: EventIn) =>
    req<void>(`/drafts/${id}/event`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  contentBank: (category?: string) =>
    req<ContentBankItem[]>(
      `/content-bank${category ? `?category=${encodeURIComponent(category)}` : ""}`
    ),
  generateBot: (kind: string, fixtureId?: number) =>
    req<Draft>("/generate/bot", {
      method: "POST",
      body: JSON.stringify({ kind, fixture_id: fixtureId ?? null }),
    }),
  generateLlm: (body: { prompt: string; category?: string }) =>
    req<Draft>("/generate/llm", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  analytics: () => req<Analytics>("/analytics"),
};
