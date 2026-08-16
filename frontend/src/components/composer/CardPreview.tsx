"use client";

import { useEffect, useRef, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import BattleCardImg from "./cards/BattleCardImg";
import MilestoneCardImg from "./cards/MilestoneCardImg";
import PredictionCardImg from "./cards/PredictionCardImg";
import QuoteCardImg from "./cards/QuoteCardImg";
import RecordCardImg from "./cards/RecordCardImg";
import TriviaCardImg from "./cards/TriviaCardImg";
import WireCardImg from "./cards/WireCardImg";

type AspectRatio = "1:1" | "16:9" | "4:5";

export default function CardPreview({
  draft,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  draft: Draft;
  onUpdate?: (d: Draft) => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (d: Draft) => void;
}) {
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    const id = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(id);
  }, [confirmingDelete]);

  const cardType = draft.card_type ?? "record";

  function renderCard(targetAspect: AspectRatio) {
    if (cardType === "prediction") {
      return <PredictionCardImg draft={draft} aspect={targetAspect} />;
    }
    if (cardType === "trivia") {
      return <TriviaCardImg draft={draft} aspect={targetAspect} />;
    }
    if (cardType === "battle") {
      return <BattleCardImg draft={draft} aspect={targetAspect} />;
    }
    if (cardType === "milestone") {
      return <MilestoneCardImg draft={draft} aspect={targetAspect} />;
    }
    if (cardType === "quote") {
      return <QuoteCardImg draft={draft} aspect={targetAspect} />;
    }
    if (cardType === "wire") {
      return <WireCardImg draft={draft} aspect={targetAspect} />;
    }
    return <RecordCardImg draft={draft} aspect={targetAspect} />;
  }

  async function handleCopyText() {
    await navigator.clipboard.writeText(draft.text);
    await composerApi.logEvent(draft.id, { action: "copied" });
    setFeedback("Text copied to clipboard");
    setTimeout(() => setFeedback(null), 2500);
  }

  async function handleCopyImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await copyImageToClipboard(blob);
      await composerApi.logEvent(draft.id, { action: "copied" });
      setFeedback("Image copied to clipboard");
    } catch {
      setFeedback("Failed to copy image. Try Download instead.");
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
      await downloadCard(blob, `cricket-card-${draft.id}.png`);
      await composerApi.logEvent(draft.id, { action: "copied" });
      setFeedback("Image downloaded");
    } catch {
      setFeedback("Failed to render image.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleMarkPosted() {
    await composerApi.logEvent(draft.id, { action: "posted" });
    const updated = { ...draft, status: "posted" as const };
    onUpdate?.(updated);
    setFeedback("Marked as published");
    setTimeout(() => setFeedback(null), 2500);
  }

  async function handleCopyAndMarkPosted() {
    await navigator.clipboard.writeText(draft.text);
    await composerApi.logEvent(draft.id, { action: "copied" });
    await composerApi.logEvent(draft.id, { action: "posted" });
    const updated = { ...draft, status: "posted" as const };
    onUpdate?.(updated);
    setFeedback("Copied & marked as published");
    setTimeout(() => setFeedback(null), 2500);
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const created = await composerApi.createDraft({
        source: "freeform",
        category: draft.category,
        text: draft.text,
        card_type: draft.card_type,
        card_meta: draft.card_meta,
      });
      onDuplicate?.(created);
      setFeedback("Draft duplicated");
    } catch {
      setFeedback("Failed to duplicate. Try again.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await composerApi.deleteDraft(draft.id);
      onDelete?.(draft.id);
    } catch {
      setConfirmingDelete(false);
      setFeedback("Failed to delete. Try again.");
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  return (
    <div
      className="ds-card"
      style={{
        padding: "18px 20px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="text-micro">Card Output</span>
          <span
            className="ds-badge"
            style={{
              background: "var(--surface-tertiary)",
              color: "var(--fg-secondary)",
              textTransform: "capitalize",
            }}
          >
            {cardType}
          </span>
        </div>

        {/* Aspect Ratio Segmented Control */}
        <div className="ds-segmented-control">
          {(["1:1", "16:9", "4:5"] as AspectRatio[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              className={`ds-segmented-item ${aspect === a ? "ds-segmented-item--active" : ""}`}
              style={{ fontSize: 11, padding: "3px 10px" }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Scaled preview container */}
      <div
        style={{
          background: "#09090b",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-md)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          minHeight: 280,
        }}
      >
        <div
          style={{
            transform: aspect === "16:9" ? "scale(0.32)" : aspect === "4:5" ? "scale(0.26)" : "scale(0.3)",
            transformOrigin: "center center",
            margin: aspect === "16:9" ? "-160px 0" : aspect === "4:5" ? "-380px 0" : "-280px 0",
          }}
        >
          {renderCard(aspect)}
        </div>
      </div>

      {/* Off-screen twin container for html-to-image capture */}
      <div
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <div ref={captureRef}>{renderCard(aspect)}</div>
      </div>

      {/* Actions Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleCopyText}
          className="ds-btn ds-btn-secondary"
        >
          Copy Text
        </button>

        <button
          type="button"
          onClick={handleCopyImage}
          disabled={busy}
          className="ds-btn ds-btn-secondary"
        >
          Copy Image
        </button>

        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={busy}
          className="ds-btn ds-btn-primary"
        >
          Download PNG
        </button>

        <button
          type="button"
          onClick={handleMarkPosted}
          disabled={draft.status === "posted"}
          className="ds-btn ds-btn-secondary"
        >
          {draft.status === "posted" ? "Posted" : "Mark Posted"}
        </button>

        <button
          type="button"
          onClick={handleCopyAndMarkPosted}
          disabled={draft.status === "posted"}
          className="ds-btn ds-btn-secondary"
        >
          Copy + Mark Posted
        </button>

        <button
          type="button"
          onClick={handleDuplicate}
          disabled={busy}
          className="ds-btn ds-btn-secondary"
        >
          Duplicate
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className={`ds-btn ${confirmingDelete ? "ds-btn-danger" : "ds-btn-ghost"}`}
          style={{ marginLeft: "auto" }}
        >
          {confirmingDelete ? "Confirm Delete?" : "Delete"}
        </button>
      </div>

      {feedback && (
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            background: feedback.startsWith("Failed") ? "var(--error-tint)" : "var(--success-tint)",
            color: feedback.startsWith("Failed") ? "var(--error-text)" : "var(--success-text)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
