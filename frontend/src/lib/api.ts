const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type StatRow = { value: string; label: string; color: "team_a" | "team_b" | "muted" };
export type TeamInfo = { name: string; short_name: string; color: string };

export type StoryData = {
  headline: string;
  shock_stat: { value: string; label: string; one_liner: string };
  team_a: TeamInfo;
  team_b: TeamInfo;
  venue: string;
  match_time: string;
  stats_row: StatRow[];
  scroll_bait: string;
};

export type PvPStat = { label: string; batsman_val: number; bowler_val: number };
export type BattleData = { batsman: string; bowler: string; stats: PvPStat[] };

export type TriviaData = {
  question: string;
  options: string[];
  correct_index: number;
  emphasis: string;
  fact: string;
};

export type EvidenceItem = { label: string; detail: string };
export type PredictionData = {
  team: string;
  probability: number;
  evidence: EvidenceItem[];
  team_color: string;
};

export type TeamSummary = { short_name: string; name: string; primary_color: string };
export type MatchSummary = {
  date: string;
  team_a: TeamSummary;
  team_b: TeamSummary;
  venue: string;
  match_time: string;
  has_story: boolean;
  headline: string | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  story: () => get<StoryData>("/match-story/today"),
  battle: (a: string, b: string) =>
    get<BattleData>(`/stats/player-vs-player?player_a=${encodeURIComponent(a)}&player_b=${encodeURIComponent(b)}`),
  trivia: () => get<TriviaData>("/trivia/today"),
  prediction: () => get<PredictionData>("/prediction/today"),
  matches: () => get<MatchSummary[]>("/matches"),
  storyFor: (date: string) => get<StoryData>(`/match-story/${date}`),
  triviaFor: (date: string) => get<TriviaData>(`/trivia/${date}`),
  predictionFor: (date: string) => get<PredictionData>(`/prediction/${date}`),
};
