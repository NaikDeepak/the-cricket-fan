"use client";
import { useEffect, useState } from "react";
import { type Post, composerApi } from "@/lib/composerApi";
import TeamBadge from "@/components/common/TeamBadge";

const STATE_STYLE: Record<Post["state"], { label: string; color: string }> = {
  posted: { label: "posted", color: "var(--floodlight-cyan)" },
  scheduled: { label: "scheduled", color: "var(--muted)" },
  partial: { label: "partial", color: "var(--wire-red)" },
  failed: { label: "failed", color: "var(--wire-red)" },
  abandoned: { label: "abandoned", color: "var(--muted)" },
};

const TYPE_LABEL: Record<Post["post_type"], string> = {
  prediction: "prediction",
  trivia: "trivia",
  result: "result",
  standalone_trivia: "trivia",
};

function formatWhen(iso: string | null) {
  if (!iso) return "not yet posted";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PostRow({ post }: { post: Post }) {
  const state = STATE_STYLE[post.state];
  return (
    <div className="ds-card" style={{ cursor: "default" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-sm)",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span className="ds-chip ds-chip-category">
            {TYPE_LABEL[post.post_type]}
          </span>
          {post.team_a && post.team_b && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TeamBadge team={post.team_a} size={20} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>vs</span>
              <TeamBadge team={post.team_b} size={20} />
            </div>
          )}
        </div>
        <span className="text-micro" style={{ margin: 0, color: state.color }}>
          {state.label}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg)", lineHeight: 1.5 }}>
        {post.text || "(no text)"}
      </p>

      <p style={{ margin: "var(--space-sm) 0 0 0", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
        {formatWhen(post.posted_at)}
        {post.tweet_count > 1 ? ` · ${post.tweet_count} tweets` : ""}
      </p>
    </div>
  );
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    composerApi
      .posts()
      .then(setPosts)
      .catch(() =>
        setError(
          "Could not reach the composer API. Is it running on the URL in NEXT_PUBLIC_API_URL?"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts
    .filter((p) => filter === "all" || p.state === filter)
    .filter((p) => typeFilter === "all" || p.post_type === typeFilter);
  const counts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.state] = (acc[p.state] ?? 0) + 1;
    return acc;
  }, {});
  const typeCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.post_type] = (acc[p.post_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <h1 className="text-tool-headline" style={{ margin: 0 }}>
        Automated Posts
      </h1>

      {loading && <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>Loading posts…</p>}

      {!loading && error && (
        <p style={{ color: "var(--wire-red)", fontSize: "var(--text-sm)" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            {["all", "posted", "failed", "scheduled", "partial", "abandoned"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className="ds-btn-secondary"
                  aria-pressed={filter === s}
                  style={{
                    padding: "6px 14px",
                    fontSize: 11,
                    borderColor: filter === s ? "var(--floodlight-cyan)" : undefined,
                  }}
                >
                  {s} {s !== "all" ? `(${counts[s] ?? 0})` : `(${posts.length})`}
                </button>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            {["all", "prediction", "trivia", "result", "standalone_trivia"].map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className="ds-btn-secondary"
                  aria-pressed={typeFilter === t}
                  style={{
                    padding: "6px 14px",
                    fontSize: 11,
                    borderColor:
                      typeFilter === t ? "var(--floodlight-cyan)" : undefined,
                  }}
                >
                  {t === "all" ? "all" : TYPE_LABEL[t as Post["post_type"]]}{" "}
                  {t !== "all" ? `(${typeCounts[t] ?? 0})` : `(${posts.length})`}
                </button>
              )
            )}
          </div>

          {filtered.length === 0 && (
            <div className="ds-card" style={{ cursor: "default", padding: "var(--space-xl)" }}>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                No {filter === "all" ? "" : filter} posts yet.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {filtered.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
