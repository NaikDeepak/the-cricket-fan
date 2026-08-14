"use client";
import { useCallback, useEffect, useState } from "react";
import CardPreview from "@/components/composer/CardPreview";
import Editor from "@/components/composer/Editor";
import Feed from "@/components/composer/Feed";
import { composerApi, type Draft } from "@/lib/composerApi";

export default function ComposerPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Draft | null>(null);

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
      )
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = useCallback((d: Draft) => {
    setDrafts((prev) => [d, ...prev]);
    setSelected(d);
  }, []);

  const handleUpdated = useCallback((d: Draft) => {
    setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)));
    setSelected(d);
  }, []);

  const handleDeleted = useCallback((id: number) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setSelected(null);
  }, []);

  return (
    <div>
      <p
        style={{
          fontSize: 15,
          color: "var(--muted)",
          marginBottom: "var(--space-xl)",
          maxWidth: "60ch",
          lineHeight: 1.5,
        }}
      >
        Create a draft on the left (blank / bank / bot / AI), edit text +
        pick a card theme on the right, preview the rendered card, then
        export PNG or copy text and paste it into X/IG/WhatsApp yourself —
        nothing here posts automatically.
      </p>
      <div className="composer-grid">
        <div>
          <h2 className="text-title" style={{ marginBottom: "var(--space-md)" }}>
            Drafts &amp; Generators
          </h2>
          <Feed
            drafts={drafts}
            loading={loading}
            loadError={loadError}
            onCreated={handleCreated}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          <h2 className="text-title">Editor &amp; Preview</h2>
          {selected ? (
            <div
              key={selected.id}
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
            >
              <Editor draft={selected} onChange={handleUpdated} />
              <CardPreview
                draft={selected}
                onUpdate={handleUpdated}
                onDelete={handleDeleted}
                onDuplicate={handleCreated}
              />
            </div>
          ) : (
            <div
              className="ds-card"
              style={{
                cursor: "default",
                textAlign: "center",
                padding: "var(--space-xl) var(--space-md)",
              }}
            >
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                Select or create a draft to start editing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
