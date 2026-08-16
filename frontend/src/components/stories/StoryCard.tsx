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
  { label: string; bg: string; color: string; border: string }
> = {
  reddit: {
    label: "r/Cricket Lore",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "rgba(194, 65, 12, 0.2)",
  },
  quora: {
    label: "Quora Banter",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "rgba(185, 28, 28, 0.2)",
  },
  memoir: {
    label: "Dressing Room Memoir",
    bg: "#fefce8",
    color: "#a16207",
    border: "rgba(161, 98, 7, 0.2)",
  },
  interview: {
    label: "Interview",
    bg: "#f0fdfa",
    color: "#0f766e",
    border: "rgba(15, 118, 110, 0.2)",
  },
  cricsheet: {
    label: "Match Thriller",
    bg: "#f0fdf4",
    color: "#15803d",
    border: "rgba(21, 128, 61, 0.2)",
  },
  wikipedia: {
    label: "Archive",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "rgba(29, 78, 216, 0.2)",
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
        className="ds-card"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "#09090b",
          color: "#ffffff",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          minHeight: 300,
        }}
        whileHover={
          isReduced
            ? undefined
            : {
                y: -2,
                transition: SPRING_PRESET,
              }
        }
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span
              className="ds-badge"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.16)",
              }}
            >
              FEATURED STORY
            </span>
            <span
              className="ds-badge"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "#d4d4d8",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {sourceInfo.label}
            </span>
          </div>

          {story.year && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#a1a1aa",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {story.year}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: "clamp(20px, 2.2vw, 26px)",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 var(--space-sm) 0",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          {displayTitle}
        </h3>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#a1a1aa",
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
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
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
                color: "#a1a1aa",
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
      className="ds-card"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        padding: "20px 22px",
        borderRadius: "var(--radius-lg)",
      }}
      whileHover={
        isReduced
          ? undefined
          : {
              y: -2,
              transition: SPRING_PRESET,
            }
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span
            className="ds-badge"
            style={{
              background: sourceInfo.bg,
              color: sourceInfo.color,
              border: `1px solid ${sourceInfo.border}`,
            }}
          >
            {sourceInfo.label}
          </span>
          <span
            className="ds-badge"
            style={{
              background: "var(--surface-tertiary)",
              color: "var(--fg-secondary)",
            }}
          >
            {CATEGORY_LABEL[story.category] ?? story.category}
          </span>
        </div>
        {story.year && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--fg-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {story.year}
          </span>
        )}
      </div>

      <h3
        style={{
          margin: "0 0 8px 0",
          color: "var(--fg)",
          fontSize: 17,
          fontWeight: 600,
          lineHeight: 1.32,
          letterSpacing: "-0.01em",
        }}
      >
        {displayTitle}
      </h3>

      <p
        style={{
          margin: "0 0 14px 0",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--fg-secondary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {story.summary}
      </p>

      {story.tags && story.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {story.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="ds-badge"
              style={{
                background: "var(--surface-tertiary)",
                color: "var(--fg-muted)",
                fontWeight: 500,
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
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg)",
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
              color: "var(--fg-muted)",
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
