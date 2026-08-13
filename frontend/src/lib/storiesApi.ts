const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Story = {
  content_key: string;
  category: string;
  format: string;
  segments: string[];
  source: string;
  title: string;
  summary: string;
  source_type: string;
  source_ref: string;
  teams: string[];
  players: string[];
  venue: string | null;
  year: number | null;
  match_format: string | null;
  tags: string[];
  is_published: boolean;
};

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const storiesApi = {
  listStories: (params: {
    search?: string;
    category?: string;
    team?: string;
    player?: string;
    venue?: string;
    year?: number;
  } = {}) => {
    const p = new URLSearchParams();
    if (params.search) p.set("search", params.search);
    if (params.category) p.set("category", params.category);
    if (params.team) p.set("team", params.team);
    if (params.player) p.set("player", params.player);
    if (params.venue) p.set("venue", params.venue);
    if (params.year) p.set("year", params.year.toString());
    const query = p.toString();
    return req<Story[]>(`/stories${query ? `?${query}` : ""}`);
  },

  getContextualStories: (params: {
    fixture_id?: number;
    team_a?: string;
    team_b?: string;
    venue?: string;
  }) => {
    const p = new URLSearchParams();
    if (params.fixture_id) p.set("fixture_id", params.fixture_id.toString());
    if (params.team_a) p.set("team_a", params.team_a);
    if (params.team_b) p.set("team_b", params.team_b);
    if (params.venue) p.set("venue", params.venue);
    return req<Story[]>(`/stories/contextual?${p.toString()}`);
  },

  getStoryByKey: (content_key: string) => {
    return req<Story>(`/stories/${encodeURIComponent(content_key)}`);
  },
};
