"use client";

import { useRef, useState } from "react";
import type { Prediction, Draft } from "@/lib/composerApi";
import { captureCard, copyImageToClipboard, downloadCard, shareCard } from "@/lib/share";
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
      setFeedback("Image copied to clipboard! 📋");
    } catch {
      setFeedback("Copy failed. Try Download PNG instead.");
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
      setFeedback("Card downloaded! ⬇️");
    } catch {
      setFeedback("Failed to download image.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleNativeShare() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      const filename = `${prediction.team_a.toLowerCase().replace(/\s+/g, "_")}_vs_${prediction.team_b.toLowerCase().replace(/\s+/g, "_")}_prediction.png`;
      await shareCard(blob, filename);
    } catch {
      setFeedback("Share cancelled or not supported.");
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
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
      }}
      onClick={onClose}
    >
      <div
        className="card-container"
        style={{
          background: "#111116",
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8)",
          width: "100%",
          maxWidth: 680,
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
                SHAREABLE MATCH CARD
              </span>
              {isUpcoming && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "#a5b4fc",
                    fontWeight: 700,
                  }}
                >
                  UPCOMING
                </span>
              )}
            </div>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: "4px 0 0 0", color: "#ffffff" }}>
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
              width: 32,
              height: 32,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAspect("1:1")}
            className="ds-nav-link"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: aspect === "1:1" ? "#ffffff" : "rgba(255,255,255,0.08)",
              color: aspect === "1:1" ? "#000000" : "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            1:1 Square (Instagram / X)
          </button>
          <button
            type="button"
            onClick={() => setAspect("16:9")}
            className="ds-nav-link"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: aspect === "16:9" ? "#ffffff" : "rgba(255,255,255,0.08)",
              color: aspect === "16:9" ? "#000000" : "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            16:9 Landscape (Feed / Banner)
          </button>
          <button
            type="button"
            onClick={() => setAspect("4:5")}
            className="ds-nav-link"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: aspect === "4:5" ? "#ffffff" : "rgba(255,255,255,0.08)",
              color: aspect === "4:5" ? "#000000" : "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            4:5 Portrait (Stories / Reels)
          </button>
        </div>

        {/* Live Card Preview Box */}
        <div
          style={{
            background: "#09090c",
            borderRadius: 16,
            padding: "var(--space-md)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            minHeight: 340,
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
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid var(--success)",
              color: "var(--success)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {feedback}
          </div>
        )}

        {/* Action Toolbar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={handleCopyImage}
            className="ds-nav-link"
            style={{
              padding: "10px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            📋 Copy PNG to Clipboard
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadImage}
            className="ds-nav-link"
            style={{
              padding: "10px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ⬇️ Download PNG File
          </button>

          <button
            type="button"
            onClick={handleShareX}
            className="ds-nav-link"
            style={{
              padding: "10px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "#000000",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            🐦 Share to X / Twitter
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="ds-nav-link"
            style={{
              padding: "10px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "#25D366",
              color: "#ffffff",
              border: "none",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            💬 Share to WhatsApp
          </button>
        </div>

        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            disabled={busy}
            onClick={handleNativeShare}
            className="ds-nav-link"
            style={{
              padding: "10px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 999,
              background: "rgba(99, 102, 241, 0.2)",
              color: "#a5b4fc",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            📱 Share Card via Device (Instagram, Stories, AirDrop...)
          </button>
        )}
      </div>
    </div>
  );
}
