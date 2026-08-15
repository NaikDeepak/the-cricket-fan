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
          className="ds-quote ds-editorial-card"
          style={{
            position: "relative",
            background: "#ffffff",
            borderLeft: "3px solid #d97706",
            padding: "20px 24px",
          }}
          initial={isReduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: i * 0.08,
            ease: [0.16, 1, 0.3, 1],
          }}
          whileHover={
            isReduced
              ? undefined
              : {
                  x: 3,
                  transition: SPRING_PRESET,
                }
          }
        >
          {segments.length > 1 && (
            <span
              className="text-ledger-mono"
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                letterSpacing: "0.08em",
              }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p
            className="text-editorial-serif"
            style={{
              margin: 0,
              paddingRight: segments.length > 1 ? 50 : 0,
              fontSize: 17,
              lineHeight: 1.65,
              color: "#1e293b",
            }}
          >
            {seg}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
