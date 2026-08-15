"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";
import { SPRING_PRESET, STAGGER_CONTAINER_VARIANTS, prefersReducedMotion } from "@/lib/motion";
import OnThisDayCardImg from "./OnThisDayCardImg";
import { captureCard, downloadCard } from "@/lib/share";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export default function OnThisDayRail({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  const isReduced = prefersReducedMotion();

  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f59e0b",
              boxShadow: "0 0 10px #f59e0b",
            }}
          />
          <p className="text-micro" style={{ color: "#d97706", margin: 0, fontWeight: 800, letterSpacing: "0.08em" }}>
            ON THIS DAY IN CRICKET HISTORY
          </p>
        </div>
        <span className="text-micro" style={{ opacity: 0.6 }}>
          DAILY NOSTALGIA &amp; MILESTONES
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
                      y: -3,
                      transition: SPRING_PRESET,
                    }
              }
            >
              <div
                className="ds-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  borderLeft: isBirthday ? "4px solid #ec4899" : "4px solid #f59e0b",
                  borderRadius: 16,
                  padding: "var(--space-md)",
                  background: isBirthday
                    ? "linear-gradient(135deg, rgba(253, 242, 248, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%)"
                    : "linear-gradient(135deg, rgba(254, 243, 199, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-xs)" }}>
                  <span
                    className="text-micro"
                    style={{
                      color: isBirthday ? "#db2777" : "#b45309",
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    {isBirthday ? "🎂 " : "🏆 "}
                    {s.event_month_day?.split("-")[1]}{" "}
                    {MONTHS[Number(s.event_month_day?.split("-")[0]) - 1]}
                    {s.year ? ` · ${s.year}` : ""}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadShareCard(e, s)}
                    disabled={isExporting}
                    className="ds-btn-pill"
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      cursor: "pointer",
                      background: "rgba(0, 0, 0, 0.08)",
                      border: "none",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{isExporting ? "Exporting…" : "📸 Share Card"}</span>
                  </button>
                </div>

                <Link
                  href={`/stories/${encodeURIComponent(s.content_key)}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <p className="text-title" style={{ margin: "var(--space-xs) 0", fontSize: 16, color: "#1d1d1f" }}>
                    {s.title}
                  </p>
                  <p
                    className="text-caption"
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: "var(--fg-muted)",
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
