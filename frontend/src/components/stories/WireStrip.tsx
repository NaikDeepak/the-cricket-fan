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
            The Wire
          </span>
          <span style={{ color: "var(--fg-muted)", fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Live Updates</span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--fg-muted)",
          }}
        >
          Matchday Dispatch
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
        {items.map((item) => (
          <motion.div
            key={item.id}
            style={{ flex: "0 0 auto", minWidth: 300, maxWidth: 380 }}
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
                padding: "16px 18px",
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
                  marginBottom: 8,
                }}
              >
                {item.category && (
                  <span
                    className="ds-badge"
                    style={{
                      background: "var(--surface-tertiary)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    {item.category}
                  </span>
                )}
                {item.posted_at && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDateStamp(item.posted_at)}
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--fg)",
                  lineHeight: 1.5,
                }}
              >
                {item.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
