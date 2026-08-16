"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";
import { formatStoryTitle } from "@/lib/storiesApi";
import { SPRING_PRESET, STAGGER_CONTAINER_VARIANTS, prefersReducedMotion } from "@/lib/motion";
import OnThisDayCardImg from "./OnThisDayCardImg";
import { captureCard, downloadCard } from "@/lib/share";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export default function OnThisDayRail({ stories }: { stories: Story[] }) {
  const isReduced = prefersReducedMotion();
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  if (stories.length === 0) return null;

  async function handleDownloadShareCard(e: React.MouseEvent, story: Story) {
    e.preventDefault();
    e.stopPropagation();
    const el = cardRefs.current[story.content_key];
    if (!el) return;

    setExportingKey(story.content_key);
    try {
      const blob = await captureCard(el);
      const filename = `on-this-day-${story.event_month_day || "today"}-${story.content_key.replace(/[^a-z0-9]+/gi, "-")}.png`;
      await downloadCard(blob, filename);
    } catch (err) {
      console.error("Failed to export On-This-Day card:", err);
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <motion.section
      data-rail="on-this-day"
      style={{ marginBottom: "var(--space-xl)" }}
      variants={STAGGER_CONTAINER_VARIANTS}
      initial={isReduced ? "visible" : "hidden"}
      animate="visible"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#d97706",
              boxShadow: "0 0 0 3px rgba(217, 119, 6, 0.15)",
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#b45309",
              margin: 0,
            }}
          >
            On This Day in Cricket History
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 600,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Daily Nostalgia &amp; Milestones
        </span>
      </div>

      <div
        className="ds-tag-scroll"
        style={{
          display: "flex",
          gap: "var(--space-md)",
          overflowX: "auto",
          paddingBottom: "var(--space-sm)",
        }}
      >
        {stories.map((s) => {
          const isExporting = exportingKey === s.content_key;
          const isBirthday = (s.tags || []).includes("birthday") || s.title.toLowerCase().includes("birthday");
          const monthIdx = Number(s.event_month_day?.split("-")[0]) - 1;
          const monthStr = MONTHS[monthIdx] || "";
          const dayStr = s.event_month_day?.split("-")[1] || "";
          const displayTitle = formatStoryTitle(s.title);

          return (
            <motion.div
              key={s.content_key}
              style={{ flex: "0 0 auto", minWidth: 340, maxWidth: 440 }}
              variants={{
                hidden: { opacity: 0, x: 20 },
                visible: { opacity: 1, x: 0 },
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
                className="ds-editorial-card"
                style={{
                  height: "100%",
                  padding: "20px 22px",
                  background: isBirthday ? "#fffafc" : "#ffffff",
                  borderLeft: isBirthday ? "3px solid #ec4899" : "3px solid #f59e0b",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: isBirthday ? "#be185d" : "#b45309",
                      background: isBirthday ? "#fdf2f8" : "#fef3c7",
                      border: `1px solid ${isBirthday ? "#fbcfe8" : "#fde68a"}`,
                      padding: "3px 10px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                    }}
                  >
                    {isBirthday ? "Anniversary · " : "On This Day · "}
                    {dayStr} {monthStr}
                    {s.year ? ` (${s.year})` : ""}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadShareCard(e, s)}
                    disabled={isExporting}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      cursor: "pointer",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 999,
                      color: "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isExporting ? "Exporting…" : "Share Card ↗"}
                  </button>
                </div>

                <Link
                  href={`/stories/${encodeURIComponent(s.content_key)}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <h4
                    className="text-editorial-serif"
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: 17,
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.3,
                    }}
                  >
                    {displayTitle}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: "#475569",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {s.summary}
                  </p>
                </Link>

                {/* Offscreen element for high-res PNG export */}
                <div
                  style={{
                    position: "fixed",
                    left: -9999,
                    top: -9999,
                    width: 1080,
                    height: 1350,
                    pointerEvents: "none",
                  }}
                >
                  <div ref={(el) => { cardRefs.current[s.content_key] = el; }}>
                    <OnThisDayCardImg story={s} />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
