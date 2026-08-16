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
  { label: string; className: string; style?: React.CSSProperties }
> = {
  pending: { label: "Upcoming", className: "ds-badge-neutral" },
  correct: { label: "Hit · Correct", className: "ds-badge-success" },
  incorrect: {
    label: "Miss · Incorrect",
    className: "ds-badge",
    style: { color: "var(--warning)", background: "var(--warning-tint)", border: "1px solid rgba(217, 119, 6, 0.2)" },
  },
  void: { label: "No Result", className: "ds-badge-neutral" },
};

export default function PredictionTrackCard({ prediction }: { prediction: Prediction }) {
  const [showShare, setShowShare] = useState(false);
  const isReduced = prefersReducedMotion();
  const pct = Math.round(
    (prediction.predicted_winner === prediction.team_a
      ? prediction.prob_team_a
      : 1 - prediction.prob_team_a) * 100
  );
  const outcomeInfo = OUTCOME_DISPLAY[prediction.outcome] || OUTCOME_DISPLAY.pending;

  return (
    <>
      <motion.div
        className="ds-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "16px 20px",
          background: "#ffffff",
        }}
        whileHover={isReduced ? undefined : { y: -2 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-micro" style={{ color: "var(--fg-muted)" }}>
            {prediction.league}
          </span>
          <span className={`ds-badge ${outcomeInfo.className}`} style={outcomeInfo.style}>
            {outcomeInfo.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TeamBadge team={prediction.predicted_winner} size={28} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "var(--fg)" }}>
              {prediction.predicted_winner} · {pct}%
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-muted)" }}>
              {prediction.team_a} vs {prediction.team_b} · {prediction.venue}
            </p>
          </div>
        </div>

        {prediction.actual_winner && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--fg)" }}>
            Winner: <strong>{prediction.actual_winner}</strong>
            {prediction.result_summary ? ` — ${prediction.result_summary}` : ""}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
            {formatDateStamp(prediction.created_at)}
          </span>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="ds-btn ds-btn-secondary"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 4,
            }}
          >
            Share Card
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
