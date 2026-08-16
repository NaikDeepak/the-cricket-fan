"use client";

import { useCallback, useMemo, useState } from "react";
import { composerApi, type CardMeta, type Draft } from "@/lib/composerApi";
import {
  generateThemeFromHex,
  listAllTeams,
  listLeagues,
} from "@/lib/teamColors";
import { useDebouncedSave } from "./useDebouncedSave";

const CARD_TYPES = [
  { id: "record", label: "Record" },
  { id: "battle", label: "Player Battle" },
  { id: "milestone", label: "Match Milestone" },
  { id: "quote", label: "Quote & Lore" },
  { id: "wire", label: "Wire Dispatch" },
  { id: "prediction", label: "Prediction Pick" },
  { id: "trivia", label: "Trivia Quiz" },
] as const;

export default function Editor({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  const [text, setText] = useState(draft.text);
  const [category, setCategory] = useState(draft.category ?? "");
  const [cardType, setCardType] = useState<Draft["card_type"]>(
    draft.card_type ?? "record"
  );
  const [cardMeta, setCardMeta] = useState<CardMeta>(draft.card_meta ?? {});

  const [selectedLeague, setSelectedLeague] = useState<string>("All");

  const leagues = useMemo(() => ["All", ...listLeagues(), "Custom"], []);
  const allTeams = useMemo(() => listAllTeams(), []);

  const filteredTeams = useMemo(() => {
    if (selectedLeague === "All" || selectedLeague === "Custom") return allTeams;
    return allTeams.filter((t) => t.league === selectedLeague);
  }, [selectedLeague, allTeams]);

  const value = useMemo(
    () => ({ text, category, cardType, cardMeta }),
    [text, category, cardType, cardMeta]
  );

  const save = useCallback(
    async (v: {
      text: string;
      category: string;
      cardType: Draft["card_type"];
      cardMeta: CardMeta;
    }) => {
      const updated = await composerApi.patchDraft(draft.id, {
        text: v.text,
        category: v.category || null,
        card_type: v.cardType,
        card_meta: v.cardMeta,
      });
      onChange(updated);
    },
    [draft.id, onChange]
  );

  useDebouncedSave(value, save);

  const over = text.length > 280;

  function updateMeta(key: string, val: unknown) {
    setCardMeta((prev) => ({ ...prev, [key]: val }));
  }

  function handleTeamSelect(teamName: string) {
    if (cardType === "battle") {
      if (!cardMeta.team_1) {
        updateMeta("team_1", teamName);
      } else {
        updateMeta("team_2", teamName);
      }
    } else if (cardType === "prediction") {
      if (!cardMeta.team_a) {
        updateMeta("team_a", teamName);
      } else {
        updateMeta("team_b", teamName);
      }
    } else {
      updateMeta("team", teamName);
    }
  }

  function handleCustomColorChange(hex: string) {
    const theme = generateThemeFromHex(hex);
    if (cardType === "battle") {
      updateMeta("team_1_theme", theme);
    } else if (cardType === "prediction") {
      updateMeta("team_a_theme", theme);
    } else {
      updateMeta("team_theme", theme);
    }
  }

  return (
    <div
      className="ds-card"
      style={{
        padding: "18px 20px",
        background: "#ffffff",
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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="text-micro">Draft Editor</span>
          <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
            #{draft.id} · {draft.source}
          </span>
        </div>
        <span
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            color: over ? "var(--error-text)" : "var(--fg-muted)",
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
        rows={4}
        className="ds-input"
        placeholder="Draft post text or commentary…"
        style={{
          width: "100%",
          fontSize: 14,
          lineHeight: 1.5,
          resize: "vertical",
          borderColor: over ? "var(--error)" : undefined,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <label
          className="text-micro"
          style={{
            display: "flex",
            gap: 4,
            flexDirection: "column",
            margin: 0,
            flex: "1 1 140px",
            minWidth: 0,
          }}
        >
          Template Style
          <select
            aria-label="card type"
            value={cardType ?? "record"}
            onChange={(e) =>
              setCardType(e.target.value as Draft["card_type"])
            }
            className="ds-select"
            style={{ width: "100%", minWidth: 0 }}
          >
            {CARD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label
          className="text-micro"
          style={{
            display: "flex",
            gap: 4,
            flexDirection: "column",
            margin: 0,
            flex: "1 1 140px",
            minWidth: 0,
          }}
        >
          Category Tag
          <input
            aria-label="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. IPL, STAT, WPL"
            className="ds-input"
            style={{
              padding: "7px 10px",
              fontSize: 13,
              width: "100%",
              minWidth: 0,
            }}
          />
        </label>
      </div>

      {/* Template-Specific Metadata Controls */}
      <div
        className="ds-card"
        style={{
          background: "var(--surface-tertiary)",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span className="text-micro" style={{ color: "var(--fg-muted)" }}>
          {cardType?.toUpperCase()} METADATA
        </span>

        {/* Battle Fields */}
        {cardType === "battle" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Player 1 (e.g. Virat Kohli)"
              value={(cardMeta.player_1 as string) || ""}
              onChange={(e) => updateMeta("player_1", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Player 2 (e.g. Jasprit Bumrah)"
              value={(cardMeta.player_2 as string) || ""}
              onChange={(e) => updateMeta("player_2", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team 1 Name"
              value={(cardMeta.team_1 as string) || ""}
              onChange={(e) => updateMeta("team_1", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team 2 Name"
              value={(cardMeta.team_2 as string) || ""}
              onChange={(e) => updateMeta("team_2", e.target.value)}
            />
          </div>
        )}

        {/* Milestone Fields */}
        {cardType === "milestone" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Player Name (e.g. Sai Sudharsan)"
              value={(cardMeta.player as string) || ""}
              onChange={(e) => updateMeta("player", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Hero Stat (e.g. 103* (47))"
              value={(cardMeta.stat as string) || ""}
              onChange={(e) => updateMeta("stat", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team Name"
              value={(cardMeta.team as string) || ""}
              onChange={(e) => updateMeta("team", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Milestone Tag (e.g. MATCH HERO)"
              value={(cardMeta.tag as string) || ""}
              onChange={(e) => updateMeta("tag", e.target.value)}
            />
          </div>
        )}

        {/* Quote Fields */}
        {cardType === "quote" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Speaker (e.g. Rohit Sharma)"
              value={(cardMeta.speaker as string) || ""}
              onChange={(e) => updateMeta("speaker", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Role / Title (e.g. Captain)"
              value={(cardMeta.role as string) || ""}
              onChange={(e) => updateMeta("role", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team Affiliation"
              value={(cardMeta.team as string) || ""}
              onChange={(e) => updateMeta("team", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Context (e.g. Post-Match Presser)"
              value={(cardMeta.context as string) || ""}
              onChange={(e) => updateMeta("context", e.target.value)}
            />
          </div>
        )}

        {/* Wire Fields */}
        {cardType === "wire" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Breaking Headline"
              value={(cardMeta.headline as string) || ""}
              onChange={(e) => updateMeta("headline", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Source Tag (e.g. PRESS BOX DESK)"
              value={(cardMeta.source as string) || ""}
              onChange={(e) => updateMeta("source", e.target.value)}
            />
          </div>
        )}

        {/* Prediction Fields */}
        {cardType === "prediction" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team A"
              value={(cardMeta.team_a as string) || ""}
              onChange={(e) => updateMeta("team_a", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team B"
              value={(cardMeta.team_b as string) || ""}
              onChange={(e) => updateMeta("team_b", e.target.value)}
            />
            <label className="text-micro" style={{ margin: 0 }}>
              Prob A (0.0 to 1.0)
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="ds-input"
                style={{ fontSize: 13, padding: "6px 10px", width: "100%", marginTop: 2 }}
                value={
                  typeof cardMeta.prob_a === "number" ? cardMeta.prob_a : 0.5
                }
                onChange={(e) =>
                  updateMeta("prob_a", parseFloat(e.target.value) || 0.5)
                }
              />
            </label>
          </div>
        )}

        {/* Record Fields */}
        {cardType === "record" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Big Stat / Headline (e.g. 264 RUNS)"
              value={(cardMeta.headline as string) || ""}
              onChange={(e) => updateMeta("headline", e.target.value)}
            />
            <input
              className="ds-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="Team Theme (e.g. India, CSK)"
              value={(cardMeta.team as string) || ""}
              onChange={(e) => updateMeta("team", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Team Color Palettes */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--space-xs)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="text-micro">Apply Team Palette</span>
          {/* League Filter */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {leagues.map((lg) => (
              <button
                key={lg}
                type="button"
                onClick={() => setSelectedLeague(lg)}
                className={`ds-filter-tab ${selectedLeague === lg ? "ds-filter-tab--active" : ""}`}
                style={{ fontSize: 11, padding: "2px 8px" }}
              >
                {lg}
              </button>
            ))}
          </div>
        </div>

        {selectedLeague === "Custom" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className="text-micro" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Primary Color
              <input
                type="color"
                defaultValue="#e8432e"
                onChange={(e) => handleCustomColorChange(e.target.value)}
                style={{ cursor: "pointer", border: "none", background: "none" }}
              />
            </label>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {filteredTeams.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => handleTeamSelect(t.name)}
                title={`${t.name} (${t.league})`}
                className="ds-btn ds-btn-secondary"
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: t.theme.accent,
                  }}
                />
                {t.short}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
