"use client";

import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";
import { SPRING_PRESET, prefersReducedMotion } from "@/lib/motion";

const CATEGORY_LABEL: Record<string, string> = {
  wiki_record: "Record",
  anecdote: "Anecdote",
  story: "Story",
  lore: "Lore",
};

const SOURCE_BADGES: Record<
  string,
  { label: string; bg: string; color: string; border: string; icon: string }
> = {
  reddit: {
    label: "r/Cricket Lore",
    bg: "rgba(255, 69, 0, 0.12)",
    color: "#ff4500",
    border: "rgba(255, 69, 0, 0.25)",
    icon: "👾",
  },
  quora: {
    label: "Quora Banter",
    bg: "rgba(185, 43, 39, 0.12)",
    color: "#b92b27",
    border: "rgba(185, 43, 39, 0.25)",
    icon: "⚡",
  },
  memoir: {
    label: "Dressing Room Memoir",
    bg: "rgba(217, 119, 6, 0.12)",
    color: "#d97706",
    border: "rgba(217, 119, 6, 0.25)",
    icon: "📖",
  },
  interview: {
    label: "Player Interview",
    bg: "rgba(13, 148, 136, 0.12)",
    color: "#0d9488",
    border: "rgba(13, 148, 136, 0.25)",
    icon: "🎙️",
  },
  cricsheet: {
    label: "Match Thriller",
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.25)",
    icon: "🏏",
  },
  wikipedia: {
    label: "Wikipedia Archive",
    bg: "rgba(37, 99, 235, 0.12)",
    color: "#2563eb",
    border: "rgba(37, 99, 235, 0.25)",
    icon: "🏛️",
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

  if (featured) {
    return (
      <motion.div
        className="ds-spatial-card-dark"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          backgroundImage:
            "linear-gradient(135deg, rgba(10, 10, 16, 0.92) 0%, rgba(20, 20, 32, 0.88) 100%), url('/images/hero_action.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: 320,
        }}
        whileHover={
          isReduced
            ? undefined
            : {
                y: -4,
                scale: 1.005,
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
          <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                backdropFilter: "blur(10px)",
                padding: "4px 14px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              FEATURED STORY
            </span>
            <span
              style={{
                background: sourceInfo.bg,
                color: sourceInfo.color,
                border: `1px solid ${sourceInfo.border}`,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {sourceInfo.icon} {sourceInfo.label}
            </span>
          </div>

          {story.year && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.7)",
                letterSpacing: "0.1em",
              }}
            >
              {story.year}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 var(--space-sm) 0",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            maxWidth: "90%",
          }}
        >
          {story.title}
        </h3>

        <p
          style={{
            fontSize: "var(--text-base)",
            lineHeight: 1.55,
            color: "rgba(255, 255, 255, 0.8)",
            margin: "0 0 var(--space-lg) 0",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            maxWidth: "85%",
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
          }}
        >
          <span
            className="ds-btn-pill ds-btn-pill-accent"
            style={{ fontSize: 13, padding: "8px 18px" }}
          >
            Read Story ↗
          </span>
          {story.teams && story.teams.length > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "rgba(255, 255, 255, 0.5)",
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
          marginBottom: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: sourceInfo.bg,
              color: sourceInfo.color,
              border: `1px solid ${sourceInfo.border}`,
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {sourceInfo.icon} {sourceInfo.label}
          </span>
          <span className="ds-chip ds-chip-category">
            {CATEGORY_LABEL[story.category] ?? story.category}
          </span>
        </div>
        {story.year && (
          <span className="text-micro" style={{ margin: 0, fontWeight: 600 }}>
            {story.year}
          </span>
        )}
      </div>

      <p
        className="text-title"
        style={{ margin: "0 0 var(--space-sm) 0", color: "#1d1d1f" }}
      >
        {story.title}
      </p>

      <p
        className="text-caption"
        style={{
          margin: 0,
          fontSize: "var(--text-sm)",
          lineHeight: 1.5,
          color: "var(--fg-muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {story.summary}
      </p>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "var(--space-md)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#000000",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Read story ↗
        </span>
        {story.teams && story.teams.length > 0 && (
          <span className="text-micro" style={{ opacity: 0.6 }}>
            {story.teams.slice(0, 2).join(" vs ")}
          </span>
        )}
      </div>
    </motion.div>
  );
}
