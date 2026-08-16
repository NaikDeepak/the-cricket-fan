"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Prediction } from "@/lib/composerApi";
import { formatDateStamp } from "@/lib/storiesApi";
import TeamBadge from "@/components/common/TeamBadge";
import { prefersReducedMotion } from "@/lib/motion";
import PredictionShareModal from "./PredictionShareModal";

const OUTCOME_DISPLAY: Record<
  Prediction["outcome"],
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Upcoming", color: "var(--fg-muted)", bg: "var(--surface)" },
  correct: { label: "Correct", color: "var(--success)", bg: "var(--success-tint)" },
  incorrect: { label: "Incorrect", color: "var(--warning)", bg: "var(--warning-tint)" },
  void: { label: "No Result", color: "var(--fg-muted)", bg: "var(--surface)" },
};

export default function PredictionTrackCard({ prediction }: { prediction: Prediction }) {
  const [showShare, setShowShare] = useState(false);
  const isReduced = prefersReducedMotion();
  const pct = Math.round(
    (prediction.predicted_winner === prediction.team_a
      ? prediction.prob_team_a
      : 1 - prediction.prob_team_a) * 100
  );
  const outcomeInfo = OUTCOME_DISPLAY[prediction.outcome];

  return (
    <>
      <motion.div
        className="ds-bento-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
          padding: "22px 24px",
        }}
        whileHover={isReduced ? undefined : { y: -3 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
            }}
          >
            {prediction.league}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: outcomeInfo.color,
              background: outcomeInfo.bg,
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {outcomeInfo.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <TeamBadge team={prediction.predicted_winner} size={32} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--text-base)", color: "var(--fg)" }}>
              {prediction.predicted_winner} · {pct}%
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
              {prediction.team_a} vs {prediction.team_b} · {prediction.venue}
            </p>
          </div>
        </div>

        {prediction.actual_winner && (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg)" }}>
            Result: {prediction.actual_winner}
            {prediction.result_summary ? ` — ${prediction.result_summary}` : ""}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "var(--space-xs)",
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
            {formatDateStamp(prediction.created_at)}
          </p>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="ds-nav-link"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              background: "var(--surface)",
              color: "var(--fg)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ↗ Share Card
          </button>
        </div>
      </motion.div>

      {showShare && (
        <PredictionShareModal
          prediction={prediction}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
