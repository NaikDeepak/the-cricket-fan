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
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="ds-chip ds-chip-source">
          #{draft.id} · {draft.source}
        </span>
        <span
          className="text-micro"
          style={{
            margin: 0,
            color: over ? "var(--wire-red)" : "var(--muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {text.length} / 280
        </span>
      </div>

      <textarea
        aria-label="post text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="ds-input"
        style={{
          width: "100%",
          fontFamily: "inherit",
          fontSize: "var(--text-base)",
          lineHeight: 1.5,
          resize: "vertical",
          borderColor: over ? "var(--wire-red)" : undefined,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <label
          className="text-micro"
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "center",
            margin: 0,
            flex: "1 1 140px",
            minWidth: 0,
          }}
        >
          Category
          <input
            aria-label="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="ds-input"
            style={{ padding: "6px 10px", fontSize: "var(--text-sm)", width: "100%", minWidth: 0 }}
          />
        </label>

        <label
          className="text-micro"
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "center",
            margin: 0,
            flex: "1 1 140px",
            minWidth: 0,
          }}
        >
          Card theme
          <select
            aria-label="card type"
            value={cardType}
            onChange={(e) =>
              setCardType(e.target.value as Draft["card_type"] & string)
            }
            className="ds-select"
            style={{ width: "100%", minWidth: 0 }}
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
