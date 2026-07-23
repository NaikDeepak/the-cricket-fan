"use client";
import { useCallback, useMemo, useState } from "react";
import { composerApi, type Draft } from "@/lib/composerApi";
import { useDebouncedSave } from "./useDebouncedSave";

const CARD_TYPES = ["prediction", "trivia", "record"] as const;

export default function Editor({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  const [text, setText] = useState(draft.text);
  const [category, setCategory] = useState(draft.category ?? "");
  const [cardType, setCardType] = useState(draft.card_type ?? "record");

  const value = useMemo(
    () => ({ text, category, cardType }),
    [text, category, cardType]
  );
  const save = useCallback(
    async (v: { text: string; category: string; cardType: string }) => {
      const updated = await composerApi.patchDraft(draft.id, {
        text: v.text,
        category: v.category || null,
        card_type: v.cardType as Draft["card_type"],
      });
      onChange(updated);
    },
    [draft.id, onChange]
  );

  useDebouncedSave(value, save);

  const over = text.length > 280;

  return (
    <div
      className="card-container"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="text-micro" style={{ color: "var(--muted)" }}>
          EDIT DRAFT #{draft.id} ({draft.source})
        </span>
        <span
          className="text-micro"
          style={{ color: over ? "#ff6b6b" : "var(--muted)" }}
        >
          {text.length} / 280
        </span>
      </div>

      <textarea
        aria-label="post text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        style={{
          width: "100%",
          background: "var(--surface)",
          color: "var(--fg)",
          border: `1px solid ${over ? "#ff6b6b" : "var(--border)"}`,
          borderRadius: 6,
          padding: 12,
          fontFamily: "inherit",
          fontSize: 14,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <label
          className="text-micro"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          CATEGORY:
          <input
            aria-label="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 8px",
            }}
          />
        </label>

        <label
          className="text-micro"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          CARD THEME:
          <select
            aria-label="card type"
            value={cardType}
            onChange={(e) =>
              setCardType(e.target.value as Draft["card_type"] & string)
            }
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 8px",
            }}
          >
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
