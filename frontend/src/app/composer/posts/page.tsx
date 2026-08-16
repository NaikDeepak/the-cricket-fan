"use client";

import { useEffect, useState } from "react";
import { type Post, composerApi } from "@/lib/composerApi";
import TeamBadge from "@/components/common/TeamBadge";

const STATE_BADGE: Record<Post["state"], { label: string; className: string }> = {
  posted: { label: "Posted", className: "ds-badge ds-badge-success" },
  scheduled: { label: "Scheduled", className: "ds-badge ds-badge-neutral" },
  partial: { label: "Partial", className: "ds-badge ds-badge-warning" },
  failed: { label: "Failed", className: "ds-badge ds-badge-danger" },
  abandoned: { label: "Abandoned", className: "ds-badge ds-badge-neutral" },
};

const TYPE_LABEL: Record<Post["post_type"], string> = {
  prediction: "Prediction",
  trivia: "Trivia",
  result: "Match Result",
  standalone_trivia: "Trivia",
};

function formatWhen(iso: string | null) {
  if (!iso) return "Not yet published";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PostRow({ post }: { post: Post }) {
  const badge = STATE_BADGE[post.state] ?? { label: post.state, className: "ds-badge ds-badge-neutral" };
  return (
    <div className="ds-card" style={{ padding: "16px 18px", background: "#ffffff", cursor: "default" }}>
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
          <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
            {TYPE_LABEL[post.post_type]}
          </span>
          {post.team_a && post.team_b && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TeamBadge team={post.team_a} size={18} />
              <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>vs</span>
              <TeamBadge team={post.team_b} size={18} />
            </div>
          )}
        </div>
        <span className={badge.className}>
          {badge.label}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", lineHeight: 1.5 }}>
        {post.text || "(no text)"}
      </p>

      <p style={{ margin: "var(--space-sm) 0 0 0", fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
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
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--fg)", letterSpacing: "-0.02em" }}>
          Automated Dispatches
        </h1>
        <p className="text-caption" style={{ margin: "4px 0 0" }}>
          Track automated social dispatches, status logs, and thread delivery metrics.
        </p>
      </div>

      {loading && (
        <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
          Loading dispatches…
        </div>
      )}

      {!loading && error && (
        <div
          className="ds-card"
          style={{
            padding: "10px 14px",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            {/* State Filter Tabs */}
            <div className="ds-segmented-control">
              {["all", "posted", "failed", "scheduled", "partial", "abandoned"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`ds-segmented-item ${filter === s ? "ds-segmented-item--active" : ""}`}
                  style={{ fontSize: 11, padding: "3px 10px", textTransform: "capitalize" }}
                >
                  {s} {s !== "all" ? `(${counts[s] ?? 0})` : `(${posts.length})`}
                </button>
              ))}
            </div>

            {/* Post Type Filter Tabs */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {["all", "prediction", "trivia", "result"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`ds-filter-tab ${typeFilter === t ? "ds-filter-tab--active" : ""}`}
                  style={{ fontSize: 11, padding: "3px 8px", textTransform: "capitalize" }}
                >
                  {t} {t !== "all" ? `(${typeCounts[t] ?? 0})` : `(${posts.length})`}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="ds-card" style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13, background: "#ffffff" }}>
              No dispatches match the selected filter.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
