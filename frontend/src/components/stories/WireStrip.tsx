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
              backgroundColor: "#0284c7",
              boxShadow: "0 0 0 3px rgba(2, 132, 199, 0.15)",
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#0369a1",
              margin: 0,
            }}
          >
            The Wire — Live Feed Updates
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
          Live Matchday Feed
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
        {items.map((item) => (
          <motion.div
            key={item.id}
            style={{ flex: "0 0 auto", minWidth: 320, maxWidth: 420 }}
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
                padding: "16px 20px",
                borderLeft: "3px solid #0284c7",
                background: "#ffffff",
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
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f0f9ff",
                      color: "#0369a1",
                      border: "1px solid #e0f2fe",
                    }}
                  >
                    {item.category}
                  </span>
                )}
                <span
                  className="text-ledger-mono"
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    marginLeft: "auto",
                  }}
                >
                  {formatDateStamp(item.posted_at)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "#334155",
                }}
              >
                {item.text.slice(0, 140)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
