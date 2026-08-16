"use client";

import { type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

const SOURCE_LABEL: Record<Draft["source"], string> = {
  bank: "Content Bank",
  bot: "Model Bot",
  llm: "AI Copilot",
  freeform: "Freeform",
};

export default function Feed({
  drafts,
  loading,
  loadError,
  onCreated,
  onSelect,
  selectedId,
}: {
  drafts: Draft[];
  loading: boolean;
  loadError: string | null;
  onCreated: (d: Draft) => void;
  onSelect: (d: Draft) => void;
  selectedId?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <SourceBar onCreated={onCreated} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span className="text-micro">Drafts Queue</span>
        <span style={{ fontSize: 12, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
          {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
        </span>
      </div>

      {loadError && (
        <div
          className="ds-card"
          style={{
            padding: "10px 14px",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
            fontSize: 13,
          }}
        >
          {loadError}
        </div>
      )}

      {loading && (
        <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
          Loading drafts…
        </div>
      )}

      {!loading && !loadError && drafts.length === 0 && (
        <div
          className="ds-card"
          style={{
            padding: "var(--space-lg)",
            textAlign: "center",
            background: "#ffffff",
            color: "var(--fg-muted)",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>
            No drafts in queue
          </p>
          <p className="text-caption" style={{ marginTop: 2 }}>
            Use the generators above or create a blank card to begin.
          </p>
        </div>
      )}

      {drafts.map((d) => {
        const isSelected = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d)}
            className="ds-card"
            style={{
              padding: "14px 16px",
              background: "#ffffff",
              textAlign: "left",
              cursor: "pointer",
              border: isSelected ? "1.5px solid #000000" : "1px solid var(--border)",
              boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  className="ds-badge"
                  style={{
                    background: "var(--surface-tertiary)",
                    color: "var(--fg-secondary)",
                  }}
                >
                  {SOURCE_LABEL[d.source]}
                </span>
                {d.category && (
                  <span
                    className="ds-badge"
                    style={{
                      background: "rgba(0, 113, 227, 0.08)",
                      color: "var(--apple-blue)",
                    }}
                  >
                    {d.category}
                  </span>
                )}
                {d.status === "posted" && (
                  <span className="ds-badge ds-badge-success">
                    Published
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                #{d.id}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--fg)",
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {d.text.trim() || "(Empty draft text…)"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
