"use client";
import { useEffect, useState } from "react";
import { type Analytics, composerApi } from "@/lib/composerApi";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function AccuracyRing({ pct }: { pct: number }) {
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  return (
    <svg
      width={140}
      height={140}
      viewBox="0 0 140 140"
      role="img"
      aria-label={`${pct}% prediction accuracy`}
    >
      <circle
        cx={70}
        cy={70}
        r={RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth={10}
      />
      <circle
        cx={70}
        cy={70}
        r={RADIUS}
        fill="none"
        stroke="var(--wire-red)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{
          transition: "stroke-dashoffset var(--duration-standard) var(--ease-out-quart)",
        }}
      />
      <text
        x={70}
        y={70}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--fg)"
        fontFamily="var(--font-oswald), sans-serif"
        fontSize={30}
        fontWeight={700}
      >
        {pct}%
      </text>
    </svg>
  );
}

function StatTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div
      className="card-container"
      style={{
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
      }}
    >
      <span className="text-micro" style={{ margin: 0 }}>
        {label}
      </span>
      <div
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "var(--fg)",
        }}
      >
        {value}
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--muted)" }}>{detail}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    composerApi
      .analytics()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>Loading analytics…</p>;
  }

  if (!data) {
    return (
      <p style={{ color: "var(--wire-red)", fontSize: "var(--text-sm)" }}>
        Failed to load analytics.
      </p>
    );
  }

  const { correct, total } = data.prediction_record;
  const accuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}
    >
      <h1 className="text-tool-headline" style={{ margin: 0 }}>
        Composer &amp; Prediction Analytics
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-md)",
        }}
      >
        <div
          className="card-container"
          style={{
            padding: "var(--space-lg)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-lg)",
          }}
        >
          <AccuracyRing pct={accuracyPct} />
          <div>
            <span className="text-micro" style={{ margin: 0 }}>
              Prediction accuracy
            </span>
            <p style={{ margin: "var(--space-xs) 0 0 0", fontSize: "var(--text-sm)", color: "var(--muted)" }}>
              {correct} correct / {total} total predictions
            </p>
          </div>
        </div>

        <StatTile
          label="Drafts generated"
          value={data.funnel.generated ?? 0}
          detail={`${data.funnel.generated ?? 0} generated`}
        />
        <StatTile
          label="Drafts copied"
          value={data.funnel.copied ?? 0}
          detail={`${data.funnel.copied ?? 0} copied`}
        />
        <StatTile
          label="Drafts posted"
          value={data.funnel.posted ?? 0}
          detail={`${data.funnel.posted ?? 0} posted`}
        />
      </div>

      <div
        className="card-container"
        style={{ padding: "var(--space-lg)" }}
      >
        <h2 className="text-title" style={{ margin: "0 0 var(--space-md) 0" }}>
          Drafts by category
        </h2>
        {data.by_category.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--muted)" }}>
            No drafts created yet.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {data.by_category.map((cat, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-sm) var(--space-md)",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              >
                <span className="ds-chip ds-chip-category">
                  {cat.category ?? "unassigned"}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cat.drafts} drafts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
