"use client";
import { useRef, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import PredictionCardImg from "./cards/PredictionCardImg";
import RecordCardImg from "./cards/RecordCardImg";
import TriviaCardImg from "./cards/TriviaCardImg";

type AspectRatio = "1:1" | "16:9" | "4:5";

export default function CardPreview({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate?: (d: Draft) => void;
}) {
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="card-container"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="text-micro" style={{ color: "var(--muted)" }}>
          CARD PREVIEW ({cardType.toUpperCase()})
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          {(["1:1", "16:9", "4:5"] as AspectRatio[]).map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className="text-micro"
              style={{
                padding: "2px 8px",
                background: aspect === a ? "var(--fg)" : "var(--surface)",
                color: aspect === a ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
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
          padding: 16,
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

      {/* Hidden off-screen twin container for 1:1 pixel-perfect html-to-image capture */}
      <div
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          pointerEvents: "none",
          visibility: "hidden",
        }}
      >
        <div ref={captureRef}>{renderCard(aspect)}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={handleCopyText} className="text-micro">
          COPY TEXT
        </button>
        <button onClick={handleCopyImage} disabled={busy} className="text-micro">
          COPY IMAGE
        </button>
        <button
          onClick={handleDownloadImage}
          disabled={busy}
          className="text-micro"
        >
          DOWNLOAD PNG
        </button>
        <button
          onClick={handleMarkPosted}
          disabled={draft.status === "posted"}
          className="text-micro"
          style={{
            background: draft.status === "posted" ? "var(--border)" : undefined,
          }}
        >
          {draft.status === "posted" ? "POSTED" : "MARK POSTED"}
        </button>
      </div>

      {feedback && (
        <p className="text-micro" style={{ color: "#38bdf8", margin: 0 }}>
          {feedback}
        </p>
      )}
    </div>
  );
}
