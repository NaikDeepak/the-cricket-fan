"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  composerApi,
  type ContentBankItem,
  type Draft,
} from "@/lib/composerApi";

const BOT_KINDS = [
  { id: "prediction", label: "Match Prediction" },
  { id: "trivia", label: "Daily Trivia Quiz" },
  { id: "h2h", label: "Head-to-Head Duel" },
  { id: "venue", label: "Venue Conditions" },
  { id: "record", label: "Record Milestone" },
];

const FRESHNESS_WINDOW_DAYS = 14;

export default function SourceBar({
  onCreated,
}: {
  onCreated: (d: Draft) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState(BOT_KINDS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bank browse popover state
  const [showBank, setShowBank] = useState(false);
  const [bankItems, setBankItems] = useState<ContentBankItem[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  // Recap source state
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [teamNames, setTeamNames] = useState<string[]>([]);

  useEffect(() => {
    composerApi
      .teams()
      .then((ts) => setTeamNames(ts.map((t) => t.name)))
      .catch(() => setTeamNames([]));
  }, []);

  async function run(fn: () => Promise<Draft>) {
    setBusy(true);
    setError(null);
    try {
      onCreated(await fn());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const detail = msg.match(/→ \d+: (.+)/)?.[1];
      setError(
        detail
          ? detail
          : msg.includes("503")
          ? "AI generation unavailable (GEMINI_API_KEY not configured)."
          : "Generation failed. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleBank() {
    if (showBank) {
      setShowBank(false);
      return;
    }
    setShowBank(true);
    setLoadingBank(true);
    setBankError(null);
    try {
      const items = await composerApi.contentBank();
      setBankItems(items);
    } catch {
      setBankItems([]);
      setBankError(
        "Could not reach the composer API. Is it running on the URL in NEXT_PUBLIC_API_URL?"
      );
    } finally {
      setLoadingBank(false);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="text-micro">Content Sources</span>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: "2px 0 0 0",
              color: "var(--fg)",
              letterSpacing: "-0.01em",
            }}
          >
            Drafts &amp; Generators
          </h3>
        </div>
        {busy && (
          <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-muted)" }}>
            Generating draft…
          </span>
        )}
      </div>

      {/* Grid of Clean Apple Action Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Row 1: Blank & Content Bank */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() =>
              run(() => composerApi.createDraft({ source: "freeform", text: "" }))
            }
            disabled={busy}
            className="ds-btn ds-btn-secondary"
            style={{ justifyContent: "center" }}
          >
            + Blank Draft
          </button>

          <button
            type="button"
            onClick={toggleBank}
            disabled={busy}
            className={`ds-btn ${showBank ? "ds-btn-primary" : "ds-btn-secondary"}`}
            aria-pressed={showBank}
            style={{ justifyContent: "center" }}
          >
            {showBank ? "Hide Content Bank" : "Browse Bank"}
          </button>
        </div>

        {/* Row 2: Bot Model Generator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="bot kind"
            className="ds-select"
            style={{ flex: 1 }}
          >
            {BOT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run(() => composerApi.generateBot(kind))}
            disabled={busy}
            className="ds-btn ds-btn-primary"
            style={{ minWidth: 100, justifyContent: "center" }}
          >
            Generate
          </button>
        </div>

        {/* Row 3: AI Prompt Generator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="AI prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="prompt"
            className="ds-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => run(() => composerApi.generateLlm({ prompt }))}
            disabled={busy || !prompt}
            className="ds-btn ds-btn-secondary"
            style={{ minWidth: 140, justifyContent: "center" }}
          >
            Generate with AI
          </button>
        </div>

        {/* Row 4: Google News RSS Match Recap */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Team A"
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            aria-label="recap team a"
            list="team-names"
            className="ds-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            placeholder="Team B"
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            aria-label="recap team b"
            list="team-names"
            className="ds-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <datalist id="team-names">
            {teamNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => run(() => composerApi.generateRecap(teamA, teamB))}
            disabled={busy || !teamA || !teamB}
            className="ds-btn ds-btn-secondary"
            style={{ minWidth: 90, justifyContent: "center" }}
          >
            Recap
          </button>
        </div>
      </div>

      {error && (
        <div
          className="ds-card"
          style={{
            padding: "8px 12px",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Content Bank Popover List */}
      {showBank && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)",
          }}
        >
          <span className="text-micro">Select from Content Bank</span>

          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {loadingBank && (
              <p style={{ color: "var(--fg-muted)", fontSize: 13, margin: 0 }}>
                Loading bank items…
              </p>
            )}
            {!loadingBank && bankError && (
              <p style={{ color: "var(--error-text)", fontSize: 13, margin: 0 }}>
                {bankError}
              </p>
            )}
            {!loadingBank && !bankError && bankItems.length === 0 && (
              <p style={{ color: "var(--fg-muted)", fontSize: 13, margin: 0 }}>
                Content bank is empty. Seed it via <code>python -m bot.scripts.seed_content_bank</code>.
              </p>
            )}
            {bankItems.map((item) => {
              const recentlyUsed =
                item.last_used_days !== null &&
                item.last_used_days < FRESHNESS_WINDOW_DAYS;
              return (
                <button
                  key={item.content_key}
                  type="button"
                  onClick={() => {
                    setShowBank(false);
                    run(() =>
                      composerApi.createDraft({
                        source: "bank",
                        text: item.segments.join("\n\n"),
                        category: item.category,
                        content_key: item.content_key,
                      })
                    );
                  }}
                  className="ds-card"
                  style={{
                    padding: "10px 14px",
                    background: "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                    opacity: recentlyUsed ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                        {item.category}
                      </span>
                      {item.on_this_day && (
                        <span className="ds-badge ds-badge-success">
                          On This Day
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {recentlyUsed && (
                        <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                          used {item.last_used_days}d ago
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={item.is_published ? "Unpublish from vault" : "Publish to vault"}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const updated = await composerApi.setBankPublished(item.id, !item.is_published);
                            setBankItems((prev) =>
                              prev.map((b) => (b.id === item.id ? { ...b, is_published: updated.is_published } : b))
                            );
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="ds-btn ds-btn-ghost"
                        style={{ fontSize: 12, padding: "2px 6px" }}
                      >
                        {item.is_published ? "👁" : "👁‍🗨"}
                      </button>
                      <Link
                        href={`/stories/${encodeURIComponent(item.content_key)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          color: "var(--apple-blue)",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View in Vault
                      </Link>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", lineHeight: 1.4 }}>
                    {item.segments[0]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
