"use client";
import { useEffect, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

const SOURCE_LABEL: Record<Draft["source"], string> = {
  bank: "bank",
  bot: "bot",
  llm: "ai",
  freeform: "freeform",
};

export default function Feed({
  onSelect,
  selectedId,
}: {
  onSelect: (d: Draft) => void;
  selectedId?: number;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    composerApi
      .listDrafts()
      .then((d) => {
        setDrafts(d);
        setLoadError(null);
      })
      .catch(() =>
        setLoadError(
          "Could not reach the composer API. Is it running (uvicorn composer.app:app) on the URL in NEXT_PUBLIC_API_URL?"
        )
      );
  }, []);

  function handleCreated(d: Draft) {
    setDrafts((prev) => [d, ...prev]);
    onSelect(d);
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
    >
      <SourceBar onCreated={handleCreated} />
      {loadError && (
        <p style={{ color: "var(--wire-red)", fontSize: 13, margin: 0 }}>
          {loadError}
        </p>
      )}
      {!loadError && drafts.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          No drafts yet — create one above.
        </p>
      )}
      {drafts.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d)}
          className={`ds-card${d.id === selectedId ? " ds-card--selected" : ""}`}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              marginBottom: "var(--space-sm)",
            }}
          >
            <span className="ds-chip ds-chip-source">
              {SOURCE_LABEL[d.source]}
            </span>
            {d.category && (
              <span className="ds-chip ds-chip-category">{d.category}</span>
            )}
            {d.status === "posted" && (
              <span className="text-micro" style={{ margin: 0 }}>
                posted
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--fg)" }}>
            {d.text.slice(0, 140) || "(empty)"}
          </p>
        </button>
      ))}
    </div>
  );
}
