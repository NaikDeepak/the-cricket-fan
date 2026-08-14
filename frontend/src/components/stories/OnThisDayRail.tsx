"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";
import { SPRING_PRESET, STAGGER_CONTAINER_VARIANTS, prefersReducedMotion } from "@/lib/motion";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export default function OnThisDayRail({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  const isReduced = prefersReducedMotion();

  return (
    <motion.section
      data-rail="on-this-day"
      style={{ marginBottom: "var(--space-xl)" }}
      variants={STAGGER_CONTAINER_VARIANTS}
      initial={isReduced ? "visible" : "hidden"}
      animate="visible"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--wire-red)",
            boxShadow: "0 0 8px var(--wire-red)",
          }}
        />
        <p className="text-micro" style={{ color: "var(--wire-red)", margin: 0, fontWeight: 700 }}>
          On this day in cricket history
        </p>
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
        {stories.map((s) => (
          <motion.div
            key={s.content_key}
            style={{ flex: "0 0 auto", minWidth: 320 }}
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
            <Link
              href={`/stories/${encodeURIComponent(s.content_key)}`}
              className="ds-card"
              style={{
                display: "block",
                minWidth: 320,
                borderLeft: "4px solid var(--wire-red)",
                textDecoration: "none",
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
                <span className="text-micro" style={{ color: "var(--wire-red)", margin: 0, fontWeight: 700 }}>
                  {s.event_month_day?.split("-")[1]}{" "}
                  {MONTHS[Number(s.event_month_day?.split("-")[0]) - 1]}
                  {s.year ? ` ${s.year}` : ""}
                </span>
                <span className="text-micro" style={{ opacity: 0.6 }}>
                  Match Day ↗
                </span>
              </div>
              <p className="text-title" style={{ margin: 0, color: "#1d1d1f" }}>
                {s.title}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
