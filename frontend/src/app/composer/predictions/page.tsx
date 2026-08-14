"use client";
import { useEffect, useState } from "react";
import { type Prediction, composerApi } from "@/lib/composerApi";
import TeamBadge from "@/components/composer/TeamBadge";

const OUTCOME_STYLE: Record<
  Prediction["outcome"],
  { label: string; color: string }
> = {
  pending: { label: "pending", color: "var(--muted)" },
  correct: { label: "correct", color: "var(--floodlight-cyan)" },
  incorrect: { label: "incorrect", color: "var(--wire-red)" },
  void: { label: "void", color: "var(--muted)" },
};

function PredictionRow({ p }: { p: Prediction }) {
  const pctA = Math.round(p.prob_team_a * 100);
  const pctB = 100 - pctA;
  const outcome = OUTCOME_STYLE[p.outcome];

  return (
    <div className="card-container" style={{ padding: "var(--space-lg)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-md)",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
        }}
      >
        <span className="text-micro" style={{ margin: 0 }}>
          {p.league} · {p.venue}
        </span>
        <span
          className="ds-chip"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: outcome.color,
          }}
        >
          {outcome.label}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          marginBottom: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1 }}>
          <TeamBadge team={p.team_a} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{p.team_a}</span>
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: pctA >= pctB ? "var(--wire-red)" : "var(--fg)",
          }}
        >
          {pctA}%
        </span>
      </div>

      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          background: "var(--border)",
          marginBottom: "var(--space-sm)",
        }}
      >
        <div style={{ width: `${pctA}%`, background: "var(--wire-red)" }} />
        <div style={{ width: `${pctB}%`, background: "var(--border)" }} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          marginBottom: "var(--space-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1 }}>
          <TeamBadge team={p.team_b} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{p.team_b}</span>
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: pctB > pctA ? "var(--wire-red)" : "var(--fg)",
          }}
        >
          {pctB}%
        </span>
      </div>

      {p.reasons.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {p.reasons.map((r, i) => (
            <li key={i} style={{ fontSize: 13, color: "var(--muted)" }}>
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    composerApi
      .predictions()
      .then(setPredictions)
      .catch(() =>
        setError(
          "Could not reach the composer API. Is it running on the URL in NEXT_PUBLIC_API_URL?"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <h1 className="text-tool-headline" style={{ margin: 0 }}>
        Predictions
      </h1>

      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading predictions…</p>
      )}

      {!loading && error && (
        <p style={{ color: "var(--wire-red)", fontSize: 13 }}>{error}</p>
      )}

      {!loading && !error && predictions.length === 0 && (
        <div className="ds-card" style={{ cursor: "default", padding: "var(--space-xl)" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            No predictions yet. The bot generates these once fixtures are in
            the DB — see <code>bot/run.py</code> and the tracked
            upcoming-fixtures fetch fix.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {predictions.map((p) => (
          <PredictionRow key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
