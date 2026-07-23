"use client";
import { useState } from "react";
import CardPreview from "@/components/composer/CardPreview";
import Editor from "@/components/composer/Editor";
import Feed from "@/components/composer/Feed";
import type { Draft } from "@/lib/composerApi";

export default function ComposerPage() {
  const [selected, setSelected] = useState<Draft | null>(null);

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
          <Feed onSelect={setSelected} selectedId={selected?.id} />
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
            <>
              <Editor draft={selected} onChange={setSelected} />
              <CardPreview draft={selected} onUpdate={setSelected} />
            </>
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
