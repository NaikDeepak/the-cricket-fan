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
          className="ds-quote ds-card"
          style={{ position: "relative", background: "#ffffff", borderRadius: 16 }}
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
                  x: 4,
                  transition: SPRING_PRESET,
                }
          }
        >
          {segments.length > 1 && (
            <span
              className="text-micro"
              style={{ position: "absolute", top: "var(--space-md)", right: "var(--space-md)", margin: 0, color: "var(--wire-red)" }}
            >
              {i + 1}/{segments.length}
            </span>
          )}
          <p className="text-body-default" style={{ margin: 0, paddingRight: segments.length > 1 ? 60 : 0, fontSize: 16, lineHeight: 1.6 }}>
            {seg}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
