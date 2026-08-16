"use client";

import { useEffect, useState } from "react";
import { type Analytics, composerApi } from "@/lib/composerApi";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function AccuracyRing({ pct }: { pct: number }) {
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  return (
    <svg
      width={120}
      height={120}
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
        stroke="var(--apple-blue)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{
          transition: "stroke-dashoffset 0.6s ease",
        }}
      />
      <text
        x={70}
        y={70}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--fg)"
        fontSize={24}
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
      className="ds-card"
      style={{
        padding: "18px 20px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
      }}
    >
      <span className="text-micro" style={{ margin: 0 }}>
        {label}
      </span>
      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>
        {value} {label.replace(/^Drafts\s+/i, "").toLowerCase()}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--fg-muted)" }}>{detail}</p>
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
    return (
      <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
        Loading analytics…
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="ds-card"
        style={{
          padding: "10px 14px",
          background: "var(--error-tint)",
          borderColor: "rgba(239, 68, 68, 0.2)",
          color: "var(--error-text)",
          fontSize: 13,
        }}
      >
        Failed to load analytics.
      </div>
    );
  }

  const { correct, total } = data.prediction_record;
  const accuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--fg)", letterSpacing: "-0.02em" }}>
          Composer &amp; Model Analytics
        </h1>
        <p className="text-caption" style={{ margin: "4px 0 0" }}>
          Production throughput, conversion funnel, and model performance metrics.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-md)",
        }}
      >
        <div
          className="ds-card"
          style={{
            padding: "18px 20px",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-lg)",
          }}
        >
          <AccuracyRing pct={accuracyPct} />
          <div>
            <span className="text-micro" style={{ margin: 0 }}>
              Prediction Accuracy
            </span>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-muted)" }}>
              {correct} of {total} settled
            </p>
          </div>
        </div>

        <StatTile
          label="Drafts Generated"
          value={data.funnel.generated ?? 0}
          detail="Total created across all sources"
        />
        <StatTile
          label="Drafts Copied"
          value={data.funnel.copied ?? 0}
          detail="Copied text or card PNGs"
        />
        <StatTile
          label="Drafts Published"
          value={data.funnel.posted ?? 0}
          detail="Marked published to Wire"
        />
      </div>

      <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff" }}>
        <span className="text-micro">Drafts by Category</span>

        {data.by_category.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--fg-muted)" }}>
            No drafts created yet.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 12,
            }}
          >
            {data.by_category.map((cat, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--surface-tertiary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span className="ds-badge" style={{ background: "#ffffff", color: "var(--fg)" }}>
                  {cat.category ?? "General"}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cat.drafts} {cat.drafts === 1 ? "draft" : "drafts"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
