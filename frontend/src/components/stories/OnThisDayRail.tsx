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
          marginBottom: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--fg)",
            }}
          >
            On This Day
          </span>
          <span style={{ color: "var(--fg-muted)", fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Cricket Milestones</span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--fg-muted)",
          }}
        >
          Daily Archive
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          overflowX: "auto",
          paddingBottom: "var(--space-xs)",
          scrollbarWidth: "none",
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
              style={{ flex: "0 0 auto", minWidth: 320, maxWidth: 420 }}
              variants={{
                hidden: { opacity: 0, x: 12 },
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
                className="ds-card"
                style={{
                  height: "100%",
                  padding: "18px 20px",
                  background: "#ffffff",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
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
                    className="ds-badge"
                    style={{
                      color: isBirthday ? "#be185d" : "#b45309",
                      background: isBirthday ? "#fdf2f8" : "#fef3c7",
                      border: `1px solid ${isBirthday ? "rgba(236,72,153,0.2)" : "rgba(245,158,11,0.2)"}`,
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
                    className="ds-btn ds-btn-secondary"
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                    }}
                  >
                    {isExporting ? "Exporting…" : "Share Card"}
                  </button>
                </div>

                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--fg)",
                    lineHeight: 1.35,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {displayTitle}
                </h4>

                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 13,
                    color: "var(--fg-secondary)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {s.summary || s.segments?.[0]}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 10,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      textTransform: "capitalize",
                    }}
                  >
                    {s.source_type}
                  </span>
                  <Link
                    href={`/stories/${s.content_key}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--apple-blue)",
                      textDecoration: "none",
                    }}
                  >
                    Read Story →
                  </Link>
                </div>
              </div>

              {/* Hidden Canvas for Card Generation */}
              <div
                style={{
                  position: "fixed",
                  left: -9999,
                  top: -9999,
                  visibility: "hidden",
                }}
              >
                <div
                  ref={(el) => {
                    cardRefs.current[s.content_key] = el;
                  }}
                >
                  <OnThisDayCardImg
                    story={s}
                    dayStr={dayStr}
                    monthStr={monthStr}
                    isBirthday={isBirthday}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
