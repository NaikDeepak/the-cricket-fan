"use client";

import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";
import { formatStoryTitle } from "@/lib/storiesApi";
import { SPRING_PRESET, prefersReducedMotion } from "@/lib/motion";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "Record",
  anecdote: "Anecdote",
  story: "Story",
  lore: "Lore",
};

const SOURCE_BADGES: Record<
  string,
  { label: string; bg: string; color: string; border: string; accent: string }
> = {
  reddit: {
    label: "r/Cricket Lore",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#ffedd5",
    accent: "#ea580c",
  },
  quora: {
    label: "Quora Banter",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fee2e2",
    accent: "#dc2626",
  },
  memoir: {
    label: "Dressing Room Memoir",
    bg: "#fefce8",
    color: "#a16207",
    border: "#fef08a",
    accent: "#ca8a04",
  },
  interview: {
    label: "Player Interview",
    bg: "#f0fdfa",
    color: "#0f766e",
    border: "#ccfbf1",
    accent: "#0d9488",
  },
  cricsheet: {
    label: "Match Thriller",
    bg: "#f0fdf4",
    color: "#15803d",
    border: "#dcfce7",
    accent: "#16a34a",
  },
  wikipedia: {
    label: "Wikipedia Archive",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#dbeafe",
    accent: "#2563eb",
  },
};

export default function StoryCard({
  story,
  featured = false,
}: {
  story: Story;
  featured?: boolean;
}) {
  const isReduced = prefersReducedMotion();
  const srcKey = (story.source_type || "").toLowerCase();
  const sourceInfo =
    SOURCE_BADGES[srcKey] ||
    (srcKey.includes("reddit")
      ? SOURCE_BADGES.reddit
      : srcKey.includes("quora")
      ? SOURCE_BADGES.quora
      : srcKey.includes("memoir")
      ? SOURCE_BADGES.memoir
      : srcKey.includes("interview")
      ? SOURCE_BADGES.interview
      : SOURCE_BADGES.wikipedia);

  const displayTitle = formatStoryTitle(story.title);

  if (featured) {
    return (
      <motion.div
        className="ds-editorial-card"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          borderColor: "#334155",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
          minHeight: 320,
        }}
        whileHover={
          isReduced
            ? undefined
            : {
                y: -3,
                transition: SPRING_PRESET,
              }
        }
      >
        {/* Subtle Gold Magazine Accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #d97706 0%, #f59e0b 50%, #3b82f6 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "rgba(217, 119, 6, 0.2)",
                color: "#fbbf24",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              FEATURED STORY
            </span>
            <span
              className="ds-source-pill"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              <span
                className="ds-source-dot"
                style={{ backgroundColor: sourceInfo.accent }}
              />
              Source · {sourceInfo.label}
            </span>
          </div>

          {story.year && (
            <span
              className="text-ledger-mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              {story.year}
            </span>
          )}
        </div>

        <h3
          className="text-editorial-serif"
          style={{
            fontSize: "clamp(22px, 2.5vw, 28px)",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 var(--space-sm) 0",
            lineHeight: 1.22,
            letterSpacing: "-0.01em",
          }}
        >
          {displayTitle}
        </h3>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "#cbd5e1",
            margin: "0 0 var(--space-lg) 0",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {story.summary}
        </p>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "var(--space-sm)",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "#fbbf24",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Read Story →
          </span>
          {story.teams && story.teams.length > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "#94a3b8",
                fontWeight: 500,
              }}
            >
              {story.teams.slice(0, 2).join(" vs ")}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="ds-bento-card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        padding: "22px 24px",
      }}
      whileHover={
        isReduced
          ? undefined
          : {
              y: -4,
              transition: SPRING_PRESET,
            }
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span
            className="ds-source-pill"
            style={{
              background: sourceInfo.bg,
              color: sourceInfo.color,
              borderColor: sourceInfo.border,
            }}
          >
            <span
              className="ds-source-dot"
              style={{ backgroundColor: sourceInfo.accent }}
            />
            Source · {sourceInfo.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "3px 9px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: "#475569",
            }}
          >
            {CATEGORY_LABEL[story.category] ?? story.category}
          </span>
        </div>
        {story.year && (
          <span
            className="text-ledger-mono"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#94a3b8",
            }}
          >
            {story.year}
          </span>
        )}
      </div>

      <h3
        className="text-editorial-serif"
        style={{
          margin: "0 0 8px 0",
          color: "#0f172a",
          fontSize: 19,
          fontWeight: 700,
          lineHeight: 1.28,
          letterSpacing: "-0.01em",
        }}
      >
        {displayTitle}
      </h3>

      <p
        style={{
          margin: "0 0 16px 0",
          fontSize: 14,
          lineHeight: 1.55,
          color: "#475569",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {story.summary}
      </p>

      {story.tags && story.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {story.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#0f172a",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Read Story →
        </span>
        {story.teams && story.teams.length > 0 && (
          <span
            style={{
              fontSize: 12,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            {story.teams.slice(0, 2).join(" vs ")}
          </span>
        )}
      </div>
    </motion.div>
  );
}
