"use client";
import { useEffect, useRef, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import PredictionCardImg from "./cards/PredictionCardImg";
import RecordCardImg from "./cards/RecordCardImg";
import TriviaCardImg from "./cards/TriviaCardImg";

type AspectRatio = "1:1" | "16:9" | "4:5";

export default function CardPreview({
  draft,
  onUpdate,
  onDelete,
}: {
  draft: Draft;
  onUpdate?: (d: Draft) => void;
  onDelete?: (id: number) => void;
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
    return <RecordCardImg draft={draft} aspect={targetAspect} />;
  }

  async function handleCopyText() {
    await navigator.clipboard.writeText(draft.text);
    await composerApi.logEvent(draft.id, { action: "copied" });
    setFeedback("Text copied to clipboard!");
    setTimeout(() => setFeedback(null), 2500);
  }

  async function handleCopyImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await copyImageToClipboard(blob);
      await composerApi.logEvent(draft.id, { action: "copied" });
      setFeedback("Image copied to clipboard!");
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
      setFeedback("Image downloaded!");
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
    setFeedback("Marked as posted!");
    setTimeout(() => setFeedback(null), 2500);
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
      className="card-container"
      style={{
        padding: "var(--space-md)",
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
        <span className="ds-chip ds-chip-category">{cardType}</span>

        <div
          role="group"
          aria-label="aspect ratio"
          style={{ display: "flex", gap: "var(--space-xs)" }}
        >
          {(["1:1", "16:9", "4:5"] as AspectRatio[]).map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              aria-pressed={aspect === a}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                background: aspect === a ? "var(--fg)" : "transparent",
                color: aspect === a ? "var(--bg)" : "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                transition:
                  "background-color var(--duration-fast) var(--ease-out-quart), color var(--duration-fast) var(--ease-out-quart)",
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Scaled preview container */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "var(--space-md)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: "scale(0.35)",
            transformOrigin: "center center",
            margin: "-250px -300px", // Offset scale whitespace
          }}
        >
          {renderCard(aspect)}
        </div>
      </div>

      {/* Off-screen twin container for pixel-perfect html-to-image capture.
          No visibility:hidden — browsers don't paint that, so html-to-image's
          foreignObject capture would come back blank/black. */}
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

      {/* Actions — Download PNG is the one primary (Wire Red) action per
          DESIGN.md's One Red Rule: it's the actual export/payoff moment. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
        }}
      >
        <button onClick={handleCopyText} className="ds-btn-secondary">
          Copy Text
        </button>
        <button
          onClick={handleCopyImage}
          disabled={busy}
          className="ds-btn-secondary"
        >
          Copy Image
        </button>
        <button
          onClick={handleDownloadImage}
          disabled={busy}
          className="ds-btn-primary"
        >
          Download PNG
        </button>
        <button
          onClick={handleMarkPosted}
          disabled={draft.status === "posted"}
          className="ds-btn-secondary"
        >
          {draft.status === "posted" ? "Posted" : "Mark Posted"}
        </button>
        <button
          onClick={handleDelete}
          className="ds-btn-secondary"
          style={{
            marginLeft: "auto",
            color: confirmingDelete ? "var(--wire-red)" : "var(--muted)",
            borderColor: confirmingDelete ? "var(--wire-red)" : undefined,
          }}
        >
          {confirmingDelete ? "Confirm Delete?" : "Delete"}
        </button>
      </div>

      {feedback && (
        <p
          className="text-micro"
          style={{
            color: feedback.startsWith("Failed")
              ? "var(--wire-red)"
              : "var(--floodlight-cyan)",
            margin: 0,
          }}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
