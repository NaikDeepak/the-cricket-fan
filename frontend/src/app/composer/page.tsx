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
        className="text-micro"
        style={{ color: "var(--muted)", marginBottom: 20, maxWidth: 640 }}
      >
        Create a draft on the left (blank / bank / bot / AI), edit text +
        pick a card theme on the right, preview the rendered card, then
        export PNG or copy text and paste it into X/IG/WhatsApp yourself —
        nothing here posts automatically.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h2 className="text-micro" style={{ marginBottom: 16 }}>
            DRAFTS & GENERATORS
          </h2>
          <Feed onSelect={setSelected} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 className="text-micro">EDITOR & PREVIEW</h2>
          {selected ? (
            <>
              <Editor draft={selected} onChange={setSelected} />
              <CardPreview draft={selected} onUpdate={setSelected} />
            </>
          ) : (
            <p className="text-micro" style={{ color: "var(--muted)" }}>
              Select or create a draft to start editing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
