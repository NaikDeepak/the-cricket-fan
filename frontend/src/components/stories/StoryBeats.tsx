"use client";

import { motion } from "framer-motion";
import { SPRING_PRESET, prefersReducedMotion } from "@/lib/motion";

export default function StoryBeats({ segments }: { segments: string[] }) {
  const isReduced = prefersReducedMotion();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {segments.map((seg, i) => (
        <motion.div
          key={i}
          data-beat
          className="ds-card ds-quote"
          style={{
            position: "relative",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
          }}
          initial={isReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: i * 0.06,
            ease: [0.16, 1, 0.3, 1],
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
          {segments.length > 1 && (
            <span
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--fg-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p
            style={{
              margin: 0,
              paddingRight: segments.length > 1 ? 50 : 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--fg)",
              letterSpacing: "-0.01em",
            }}
          >
            {seg}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
