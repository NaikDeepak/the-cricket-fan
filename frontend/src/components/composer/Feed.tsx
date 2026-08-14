"use client";
import { type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

const SOURCE_LABEL: Record<Draft["source"], string> = {
  bank: "bank",
  bot: "bot",
  llm: "ai",
  freeform: "freeform",
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
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
    >
      <SourceBar onCreated={onCreated} />
      {loadError && (
        <p style={{ color: "var(--wire-red)", fontSize: "var(--text-sm)", margin: 0 }}>
          {loadError}
        </p>
      )}
      {loading && (
        <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>Loading drafts…</p>
      )}
      {!loading && !loadError && drafts.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
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
              <span
                className="ds-chip"
                style={{ color: "var(--floodlight-cyan)", borderColor: "var(--floodlight-cyan)" }}
                title="Visible on The Wire at /stories"
              >
                On the Wire
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--fg)" }}>
            {d.text.slice(0, 140) || "(empty)"}
          </p>
        </button>
      ))}
    </div>
  );
}
