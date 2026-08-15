const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CardMeta = Record<string, unknown>;

export type Draft = {
  id: number;
  source: "bank" | "bot" | "llm" | "freeform";
  category: string | null;
  text: string;
  card_type:
    | "prediction"
    | "trivia"
    | "record"
    | "battle"
    | "milestone"
    | "quote"
    | "wire"
    | null;
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

export type LeagueAccuracyStats = {
  league: string;
  total: number;
  evaluated: number;
  correct: number;
  incorrect: number;
  accuracy_pct: number;
};

export type PredictionAccuracyStats = {
  total: number;
  evaluated: number;
  pending: number;
  correct: number;
  incorrect: number;
  void: number;
  accuracy_pct: number;
  streak: number;
  streak_type: "win" | "loss" | "none";
  recent_outcomes: string[];
  by_league: LeagueAccuracyStats[];
};

export type PredictionIn = {
  team_a: string;
  team_b: string;
  league?: string;
  venue?: string;
  prob_team_a: number;
  reasons?: string[];
  fixture_id?: number | null;
  actual_winner?: string | null;
  result_summary?: string | null;
  outcome?: "pending" | "correct" | "incorrect" | "void";
};

export type PredictionPatch = Partial<PredictionIn>;

export type PredictionResultIn = {
  actual_winner: string;
  result_summary?: string | null;
  outcome?: "correct" | "incorrect" | "void" | null;
};

export type Prediction = {
  id: number;
  fixture_id?: number | null;
  team_a: string;
  team_b: string;
  venue: string;
  league: string;
  start_time?: string | null;
  prob_team_a: number;
  reasons: string[];
  predicted_winner: string;
  actual_winner?: string | null;
  result_summary?: string | null;
  outcome: "pending" | "correct" | "incorrect" | "void";
  created_at: string;
  evaluated_at?: string | null;
};

export type TodayMatch = {
  fixture_id: number;
  team_a: string;
  team_b: string;
  league: string;
  venue: string;
  start_time: string | null;
  fixture_status: "upcoming" | "completed" | "void";
  winner: string | null;
  prediction: Prediction | null;
};

export type RunModelResult = {
  status: string;
  predictions_created: number;
  predictions_skipped: number;
  fixtures_found: number;
  errors: string[];
};

export type SettleFromApiResult = {
  status: string;
  settled_count: number;
  void_count: number;
  errors: string[];
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

export type MatchInput = {
  team_a: string;
  team_b: string;
  league?: string;
  venue?: string;
  toss_winner?: string | null;
  toss_decision?: "bat" | "field" | null;
  innings1_team?: string | null;
  innings1_runs?: number | null;
  innings1_wickets?: number | null;
  innings1_overs?: number | null;
  innings2_team?: string | null;
  innings2_runs?: number | null;
  innings2_wickets?: number | null;
  innings2_overs?: number | null;
  phase: "pre_match" | "innings_break" | "chase_in_progress" | "completed";
};

export type LivePredictionResult = {
  team_a: string;
  team_b: string;
  prob_team_a: number;
  reasons: string[];
  phase: string;
  score_projection: Record<string, unknown>;
  tweet_text: string;
  card_meta: CardMeta;
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

export type TeamColorThemeApi = {
  primary: string;
  secondary: string;
  accent?: string | null;
  gradient?: string | null;
  glow?: string | null;
  text_dark?: boolean;
};

export type TeamRecord = {
  id: number;
  name: string;
  short_name: string;
  league: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string | null;
  gradient: string | null;
  glow: string | null;
  text_dark: boolean;
  logo_url: string | null;
  aliases: string[];
  is_active: boolean;
  theme: TeamColorThemeApi;
};

export type TeamIn = {
  name: string;
  short_name: string;
  league: string;
  primary_color: string;
  secondary_color: string;
  accent_color?: string;
  gradient?: string;
  glow?: string;
  text_dark?: boolean;
  logo_url?: string;
  aliases?: string[];
  is_active?: boolean;
};

export type TeamPatch = Partial<TeamIn>;

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
  generateRecap: (team_a: string, team_b: string) =>
    req<Draft>("/generate/recap", {
      method: "POST",
      body: JSON.stringify({ team_a, team_b }),
    }),
  teams: (q: { league?: string; search?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<TeamRecord[]>(`/teams${p ? `?${p}` : ""}`);
  },
  createTeam: (body: TeamIn) =>
    req<TeamRecord>("/teams", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchTeam: (id: number, body: TeamPatch) =>
    req<TeamRecord>(`/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTeam: (id: number) => req<void>(`/teams/${id}`, { method: "DELETE" }),
  analytics: () => req<Analytics>("/analytics"),
  predictions: (q: { outcome?: string; league?: string; search?: string; limit?: number } = {}) => {
    const p = new URLSearchParams(
      Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<Prediction[]>(`/predictions${p ? `?${p}` : ""}`);
  },
  predictionAccuracy: () => req<PredictionAccuracyStats>("/predictions/accuracy"),
  createPrediction: (body: PredictionIn) =>
    req<Prediction>("/predictions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recordPredictionResult: (id: number, body: PredictionResultIn) =>
    req<Prediction>(`/predictions/${id}/result`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  settlePredictionFromText: (body: { raw_text?: string; url?: string }) =>
    req<Prediction>("/predictions/settle-from-text", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  syncPredictionResults: () =>
    req<{ status: string; settled_count: number }>("/predictions/sync-results", {
      method: "POST",
    }),
  patchPrediction: (id: number, body: PredictionPatch) =>
    req<Prediction>(`/predictions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePrediction: (id: number) =>
    req<void>(`/predictions/${id}`, { method: "DELETE" }),
  posts: (q: { state?: string; post_type?: string } = {}) => {
    const p = new URLSearchParams(q as Record<string, string>).toString();
    return req<Post[]>(`/posts${p ? `?${p}` : ""}`);
  },
  parseLiveMatch: (body: { raw_text?: string; url?: string }) =>
    req<MatchInput>("/live-predict/parse", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runLivePrediction: (body: MatchInput) =>
    req<LivePredictionResult>("/live-predict/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  todayMatches: () =>
    req<TodayMatch[]>("/predictions/today"),
  runModel: () =>
    req<RunModelResult>("/predictions/run-model", { method: "POST" }),
  settleFromApi: () =>
    req<SettleFromApiResult>("/predictions/settle-from-api", { method: "POST" }),
};

