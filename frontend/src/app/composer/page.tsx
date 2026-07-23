"use client";
import { useState } from "react";
import Feed from "@/components/composer/Feed";
import type { Draft } from "@/lib/composerApi";

export default function ComposerPage() {
  const [selected, setSelected] = useState<Draft | null>(null);

  return (
    <div>
      <Feed onSelect={setSelected} />
      {selected && (
        <p className="text-micro" style={{ marginTop: 24 }}>
          Selected #{selected.id}
        </p>
      )}
    </div>
  );
}
