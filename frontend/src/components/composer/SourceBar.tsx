"use client";
import { useState } from "react";
import {
  composerApi,
  type ContentBankItem,
  type Draft,
} from "@/lib/composerApi";

const BOT_KINDS = ["prediction", "trivia", "h2h", "venue", "record"];

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
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button
          onClick={() =>
            run(() => composerApi.createDraft({ source: "freeform", text: "" }))
          }
          disabled={busy}
          className="text-micro"
        >
          + BLANK
        </button>

        <button
          onClick={toggleBank}
          disabled={busy}
          className="text-micro"
          style={{ background: showBank ? "var(--border)" : undefined }}
        >
          BROWSE BANK
        </button>

        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="bot kind"
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
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
            className="text-micro"
          >
            GENERATE
          </button>
        </div>

        <div className="flex gap-2" style={{ alignItems: "center" }}>
          <input
            placeholder="AI prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="prompt"
            style={{
              background: "var(--surface)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          />
          <button
            onClick={() => run(() => composerApi.generateLlm({ prompt }))}
            disabled={busy || !prompt}
            className="text-micro"
          >
            GENERATE WITH AI
          </button>
        </div>
      </div>

      <p className="text-micro" style={{ color: "var(--muted)", margin: 0 }}>
        BLANK: freeform card, no setup. BROWSE BANK: needs content_bank
        seeded (see above). GENERATE: needs an upcoming fixture in the DB
        (bot/run.py fetch, CRICKET_API_KEY). GENERATE WITH AI: needs
        GEMINI_API_KEY in the composer&apos;s env.
      </p>

      {error && (
        <p className="text-micro" style={{ color: "#ff6b6b", margin: 0 }}>
          {error}
        </p>
      )}

      {showBank && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 12,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          <p className="text-micro" style={{ marginBottom: 8 }}>
            SELECT FROM CONTENT BANK:
          </p>
          {loadingBank && (
            <p className="text-micro" style={{ color: "var(--muted)" }}>
              Loading bank items…
            </p>
          )}
          {!loadingBank && bankError && (
            <p className="text-micro" style={{ color: "#ff6b6b" }}>
              {bankError}
            </p>
          )}
          {!loadingBank && !bankError && bankItems.length === 0 && (
            <p className="text-micro" style={{ color: "var(--muted)" }}>
              Content bank is empty. Seed it with{" "}
              <code>python -m bot.scripts.seed_content_bank</code> (owner
              reviews content before commit — see script docstring).
            </p>
          )}
          {bankItems.map((item) => (
            <button
              key={item.content_key}
              onClick={() => {
                setShowBank(false);
                run(() =>
                  composerApi.createDraft({
                    source: "bank",
                    text: item.segments[0] || "",
                    category: item.category,
                    content_key: item.content_key,
                  })
                );
              }}
              className="card-container"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                marginBottom: 6,
                cursor: "pointer",
                opacity: item.used ? 0.5 : 1,
              }}
            >
              <span className="text-micro" style={{ color: "var(--muted)" }}>
                [{item.category}] {item.content_key}
                {item.used ? " · already used" : ""}
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 13 }}>
                {item.segments[0]}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
