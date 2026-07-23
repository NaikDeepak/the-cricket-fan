"use client";
import { useState } from "react";
import Editor from "@/components/composer/Editor";
import Feed from "@/components/composer/Feed";
import type { Draft } from "@/lib/composerApi";

export default function ComposerPage() {
  const [selected, setSelected] = useState<Draft | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <h2 className="text-micro" style={{ marginBottom: 16 }}>
          DRAFTS & GENERATORS
        </h2>
        <Feed onSelect={setSelected} />
      </div>
      <div>
        <h2 className="text-micro" style={{ marginBottom: 16 }}>
          EDITOR & PREVIEW
        </h2>
        {selected ? (
          <Editor draft={selected} onChange={setSelected} />
        ) : (
          <p className="text-micro" style={{ color: "var(--muted)" }}>
            Select or create a draft to start editing.
          </p>
        )}
      </div>
    </div>
  );
}
