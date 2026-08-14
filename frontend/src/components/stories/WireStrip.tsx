"use client";

import { motion } from "framer-motion";
import type { WireItem } from "@/lib/storiesApi";
import { formatDateStamp } from "@/lib/storiesApi";
import { SPRING_PRESET, STAGGER_CONTAINER_VARIANTS, prefersReducedMotion } from "@/lib/motion";

export default function WireStrip({ items }: { items: WireItem[] }) {
  if (items.length === 0) return null;
  const isReduced = prefersReducedMotion();

  return (
    <motion.section
      data-rail="the-wire"
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
            background: "#0071e3",
            boxShadow: "0 0 8px #0071e3",
          }}
        />
        <p className="text-micro" style={{ color: "#0071e3", margin: 0, fontWeight: 700 }}>
          The Wire — Live Feed Updates
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
        {items.map((item) => (
          <motion.div
            key={item.id}
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
            <div
              className="ds-card"
              style={{
                minWidth: 320,
                borderLeft: "4px solid #0071e3",
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
                {item.category && <span className="ds-chip ds-chip-category">{item.category}</span>}
                <span className="text-micro" style={{ margin: 0 }}>
                  {formatDateStamp(item.posted_at)}
                </span>
              </div>
              <p className="text-caption" style={{ margin: 0, fontSize: "var(--text-sm)", lineHeight: 1.5, color: "#1d1d1f" }}>
                {item.text.slice(0, 120)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
