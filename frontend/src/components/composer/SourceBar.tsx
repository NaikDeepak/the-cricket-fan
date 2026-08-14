"use client";
import { useEffect, useState } from "react";
import {
  composerApi,
  type ContentBankItem,
  type Draft,
} from "@/lib/composerApi";

const BOT_KINDS = ["prediction", "trivia", "h2h", "venue", "record"];
const FRESHNESS_WINDOW_DAYS = 14;

export default function SourceBar({
  onCreated,
}: {
  onCreated: (d: Draft) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState(BOT_KINDS[0]);
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
    composerApi.teams().then(setTeamNames).catch(() => setTeamNames([]));
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
          flexWrap: "wrap",
          gap: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button
            onClick={() =>
              run(() => composerApi.createDraft({ source: "freeform", text: "" }))
            }
            disabled={busy}
            className="ds-btn-secondary"
          >
            + Blank
          </button>

          <button
            onClick={toggleBank}
            disabled={busy}
            className="ds-btn-secondary"
            aria-pressed={showBank}
            style={{ borderColor: showBank ? "var(--floodlight-cyan)" : undefined }}
          >
            Browse Bank
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "center",
          }}
        >
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="bot kind"
            className="ds-select"
          >
            {BOT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            onClick={() => run(() => composerApi.generateBot(kind))}
            disabled={busy}
            className="ds-btn-secondary"
          >
            Generate
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "center",
            flex: "1 1 240px",
          }}
        >
          <input
            placeholder="AI prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="prompt"
            className="ds-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            onClick={() => run(() => composerApi.generateLlm({ prompt }))}
            disabled={busy || !prompt}
            className="ds-btn-secondary"
          >
            Generate with AI
          </button>
        </div>

        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <input
            placeholder="Team A"
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            aria-label="recap team a"
            list="team-names"
            className="ds-input"
            style={{ width: 110 }}
          />
          <input
            placeholder="Team B"
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            aria-label="recap team b"
            list="team-names"
            className="ds-input"
            style={{ width: 110 }}
          />
          <datalist id="team-names">
            {teamNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            onClick={() => run(() => composerApi.generateRecap(teamA, teamB))}
            disabled={busy || !teamA || !teamB}
            className="ds-btn-secondary"
          >
            Recap
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
        <strong style={{ color: "var(--fg)" }}>Blank</strong>: freeform card,
        no setup. <strong style={{ color: "var(--fg)" }}>Browse Bank</strong>:
        needs content_bank seeded (see below).{" "}
        <strong style={{ color: "var(--fg)" }}>Generate</strong>: needs an
        upcoming fixture in the DB (bot/run.py fetch, CRICKET_API_KEY).{" "}
        <strong style={{ color: "var(--fg)" }}>Generate with AI</strong>:
        needs GEMINI_API_KEY in the composer&apos;s env.{" "}
        <strong style={{ color: "var(--fg)" }}>Recap</strong>: fetches the
        latest match-report headline from Google News RSS (works offline
        with a fallback line).
      </p>

      {error && (
        <p style={{ color: "var(--wire-red)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

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
          <p className="text-micro" style={{ margin: 0 }}>
            Select from content bank
          </p>

          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {loadingBank && (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                Loading bank items…
              </p>
            )}
            {!loadingBank && bankError && (
              <p style={{ color: "var(--wire-red)", fontSize: 13, margin: 0 }}>
                {bankError}
              </p>
            )}
            {!loadingBank && !bankError && bankItems.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                Content bank is empty. Seed it with{" "}
                <code>python -m bot.scripts.seed_content_bank</code> (owner
                reviews content before commit — see script docstring).
              </p>
            )}
            {bankItems.map((item) => {
              const recentlyUsed =
                item.last_used_days !== null &&
                item.last_used_days < FRESHNESS_WINDOW_DAYS;
              return (
                <button
                  key={item.content_key}
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
                  style={{ opacity: recentlyUsed ? 0.5 : 1 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    <span className="ds-chip ds-chip-category">
                      {item.category}
                    </span>
                    {item.on_this_day && (
                      <span
                        className="ds-chip"
                        style={{ color: "var(--floodlight-cyan)" }}
                      >
                        On this day
                      </span>
                    )}
                    {recentlyUsed && (
                      <span className="text-micro" style={{ margin: 0 }}>
                        used {item.last_used_days}d ago
                      </span>
                    )}
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-sm)",
                      }}
                    >
                      <a
                        href={`/stories/${encodeURIComponent(item.content_key)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-micro"
                        style={{
                          margin: 0,
                          color: "var(--floodlight-cyan)",
                          textDecoration: "none",
                        }}
                      >
                        View in Vault ↗
                      </a>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={
                          item.is_published
                            ? "Unpublish from vault"
                            : "Publish to vault"
                        }
                        title={
                          item.is_published
                            ? "Visible in Vault — click to hide"
                            : "Hidden from Vault — click to show"
                        }
                        onClick={async (e) => {
                          e.stopPropagation();
                          const updated = await composerApi.setBankPublished(
                            item.id,
                            !item.is_published
                          );
                          setBankItems((prev) =>
                            prev.map((b) =>
                              b.id === updated.id
                                ? { ...b, is_published: updated.is_published }
                                : b
                            )
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            (e.target as HTMLElement).click();
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          opacity: item.is_published ? 1 : 0.4,
                          fontSize: 14,
                        }}
                      >
                        {item.is_published ? "\u{1F441}" : "\u{1F6AB}"}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--fg)" }}>
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
