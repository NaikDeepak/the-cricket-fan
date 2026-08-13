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
  id: number;
  content_key: string;
  category: string;
  format: string;
  segments: string[];
  source: string;
  last_used_days: number | null;
  event_month_day: string | null;
  on_this_day: boolean;
  is_published: boolean;
};

export type Analytics = {
  funnel: Record<string, number>;
  event_totals: Record<string, number>;
  by_category: { category: string | null; drafts: number }[];
  prediction_record: { correct: number; total: number };
};

export type Prediction = {
  id: number;
  fixture_id: number;
  team_a: string;
  team_b: string;
  venue: string;
  league: string;
  start_time: string;
  prob_team_a: number;
  reasons: string[];
  outcome: "pending" | "correct" | "incorrect" | "void";
  created_at: string;
};

export type Post = {
  id: number;
  fixture_id: number | null;
  post_type: "prediction" | "trivia" | "result" | "standalone_trivia";
  state: "scheduled" | "posted" | "partial" | "failed" | "abandoned";
  text: string | null;
  tweet_count: number;
  posted_at: string | null;
  team_a: string | null;
  team_b: string | null;
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
  deleteDraft: (id: number) => req<void>(`/drafts/${id}`, { method: "DELETE" }),
  logEvent: (id: number, body: EventIn) =>
    req<void>(`/drafts/${id}/event`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  contentBank: (category?: string) =>
    req<ContentBankItem[]>(
      `/content-bank${category ? `?category=${encodeURIComponent(category)}` : ""}`
    ),
  setBankPublished: (id: number, is_published: boolean) =>
    req<ContentBankItem>(`/content-bank/${id}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ is_published }),
    }),
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
  predictions: (q: { outcome?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<Prediction[]>(`/predictions${p ? `?${p}` : ""}`);
  },
  posts: (q: { state?: string; post_type?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<Post[]>(`/posts${p ? `?${p}` : ""}`);
  },
};
