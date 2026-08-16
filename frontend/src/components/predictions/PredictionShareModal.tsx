"use client";

import { useRef, useState } from "react";
import type { Prediction, Draft } from "@/lib/composerApi";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import PredictionCardImg from "@/components/composer/cards/PredictionCardImg";

type AspectRatio = "1:1" | "16:9" | "4:5";

export default function PredictionShareModal({
  prediction,
  onClose,
}: {
  prediction: Prediction;
  onClose: () => void;
}) {
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  const isUpcoming = prediction.outcome === "pending";
  const probA = Math.round(prediction.prob_team_a * 100);
  const probB = 100 - probA;
  const winner = prediction.predicted_winner;
  const maxProb = Math.max(probA, probB);

  const mockDraft: Draft = {
    id: prediction.id,
    source: "bot",
    category: "prediction",
    card_type: "prediction",
    status: "draft",
    created_at: prediction.created_at,
    posted_at: null,
    content_key: null,
    text: `${prediction.league || "Cricket"}: ${prediction.team_a} (${probA}%) vs ${prediction.team_b} (${probB}%)\nVenue: ${prediction.venue}\nModel Pick: ${winner} (${maxProb}% win prob)\n\n#Cricket #TheCricketFan #${prediction.team_a.replace(/[^a-zA-Z0-9]/g, "")} #${prediction.team_b.replace(/[^a-zA-Z0-9]/g, "")}`,
    card_meta: {
      team_a: prediction.team_a,
      team_b: prediction.team_b,
      prob_a: prediction.prob_team_a,
      venue: prediction.venue,
      league: prediction.league,
      phase: isUpcoming ? "pre_match" : "completed",
      score_summary: prediction.actual_winner
        ? prediction.result_summary
          ? `Winner: ${prediction.actual_winner} — ${prediction.result_summary}`
          : `Winner: ${prediction.actual_winner}`
        : "Match Scheduled",
      reasons: prediction.reasons,
      predicted_winner: prediction.predicted_winner,
    },
  };

  async function handleCopyImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await copyImageToClipboard(blob);
      setFeedback("Copied to clipboard");
    } catch {
      setFeedback("Copy failed. Use download.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleDownloadImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      const filename = `${prediction.team_a.toLowerCase().replace(/\s+/g, "_")}_vs_${prediction.team_b.toLowerCase().replace(/\s+/g, "_")}_prediction.png`;
      await downloadCard(blob, filename);
      setFeedback("Card downloaded");
    } catch {
      setFeedback("Failed to download image.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  function handleShareX() {
    const text = encodeURIComponent(mockDraft.text);
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(mockDraft.text);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
      }}
      onClick={onClose}
    >
      <div
        className="ds-card"
        style={{
          background: "#111114",
          borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "92vh",
          overflowY: "auto",
          color: "#ffffff",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="ds-badge" style={{ background: "rgba(255, 255, 255, 0.1)", color: "#ffffff" }}>
                SHAREABLE MATCH CARD
              </span>
              {isUpcoming && (
                <span className="ds-badge" style={{ background: "rgba(0, 113, 227, 0.2)", color: "var(--apple-blue)" }}>
                  Upcoming
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: "6px 0 0 0", color: "#ffffff" }}>
              {prediction.team_a} vs {prediction.team_b}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#ffffff",
              width: 28,
              height: 28,
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="ds-segmented-control" style={{ background: "rgba(255, 255, 255, 0.08)" }}>
          <button
            type="button"
            onClick={() => setAspect("1:1")}
            className={`ds-segmented-item ${aspect === "1:1" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "1:1" ? "#000000" : "#d4d4d8" }}
          >
            1:1 Square
          </button>
          <button
            type="button"
            onClick={() => setAspect("16:9")}
            className={`ds-segmented-item ${aspect === "16:9" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "16:9" ? "#000000" : "#d4d4d8" }}
          >
            16:9 Landscape
          </button>
          <button
            type="button"
            onClick={() => setAspect("4:5")}
            className={`ds-segmented-item ${aspect === "4:5" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "4:5" ? "#000000" : "#d4d4d8" }}
          >
            4:5 Portrait
          </button>
        </div>

        {/* Live Card Preview Box */}
        <div
          style={{
            background: "#000000",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            minHeight: 320,
          }}
        >
          <div
            style={{
              transform: aspect === "16:9" ? "scale(0.42)" : aspect === "4:5" ? "scale(0.32)" : "scale(0.38)",
              transformOrigin: "center center",
              margin: aspect === "16:9" ? "-180px 0" : aspect === "4:5" ? "-440px 0" : "-320px 0",
            }}
          >
            <div ref={captureRef}>
              <PredictionCardImg draft={mockDraft} aspect={aspect} />
            </div>
          </div>
        </div>

        {feedback && (
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(52, 199, 89, 0.15)",
              color: "var(--success)",
              fontSize: 13,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            {feedback}
          </div>
        )}

        {/* Action Toolbar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={handleCopyImage}
            className="ds-btn ds-btn-secondary"
            style={{
              fontSize: 12,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            Copy PNG to Clipboard
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadImage}
            className="ds-btn ds-btn-secondary"
            style={{
              fontSize: 12,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            Download PNG
          </button>

          <button
            type="button"
            onClick={handleShareX}
            className="ds-btn"
            style={{
              fontSize: 12,
              background: "#000000",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            Share to X
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="ds-btn"
            style={{
              fontSize: 12,
              background: "#25D366",
              color: "#ffffff",
            }}
          >
            Share to WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
