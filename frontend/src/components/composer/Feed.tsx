"use client";
import { useEffect, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import SourceBar from "./SourceBar";

export default function Feed({ onSelect }: { onSelect: (d: Draft) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    composerApi
      .listDrafts()
      .then(setDrafts)
      .catch(() => setDrafts([]));
  }, []);

  function handleCreated(d: Draft) {
    setDrafts((prev) => [d, ...prev]);
    onSelect(d);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SourceBar onCreated={handleCreated} />
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
