"use client";
import { useEffect, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

export default function Feed({ onSelect }: { onSelect: (d: Draft) => void }) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SourceBar onCreated={handleCreated} />
      {loadError && (
        <p className="text-micro" style={{ color: "#ff6b6b" }}>
          {loadError}
        </p>
      )}
      {!loadError && drafts.length === 0 && (
        <p className="text-micro" style={{ color: "var(--muted)" }}>
          No drafts yet — create one above.
        </p>
      )}
      {drafts.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d)}
          className="card-container"
          style={{ padding: 16, textAlign: "left", cursor: "pointer" }}
        >
          <p className="text-micro">
            {d.source} · {d.category ?? "—"} · {d.status}
          </p>
          <p style={{ marginTop: 8 }}>{d.text.slice(0, 140) || "(empty)"}</p>
        </button>
      ))}
    </div>
  );
}
