"use client";
import { useEffect, useState } from "react";
import { type Analytics, composerApi } from "@/lib/composerApi";

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
    return <p className="text-micro">Loading analytics…</p>;
  }

  if (!data) {
    return <p className="text-micro">Failed to load analytics.</p>;
  }

  const { correct, total } = data.prediction_record;
  const accuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 className="text-micro" style={{ fontSize: 18 }}>
        COMPOSER & PREDICTION ANALYTICS
      </h1>

      {/* Grid of stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {/* Prediction Accuracy Card */}
        <div
          className="card-container"
          style={{
            padding: 20,
            background: "linear-gradient(135deg, #09090b 0%, #1e1b4b 100%)",
          }}
        >
          <span className="text-micro" style={{ color: "#a5b4fc" }}>
            PREDICTION ACCURACY
          </span>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#38bdf8",
              margin: "12px 0 4px 0",
            }}
          >
            {accuracyPct}%
          </div>
          <p className="text-micro" style={{ color: "var(--muted)", margin: 0 }}>
            {correct} correct / {total} total predictions
          </p>
        </div>

        {/* Funnel: Generated */}
        <div className="card-container" style={{ padding: 20 }}>
          <span className="text-micro" style={{ color: "var(--muted)" }}>
            DRAFTS GENERATED
          </span>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              margin: "12px 0 4px 0",
            }}
          >
            {data.funnel.generated ?? 0}
          </div>
          <p className="text-micro" style={{ color: "var(--muted)", margin: 0 }}>
            {data.funnel.generated ?? 0} generated
          </p>
        </div>

        {/* Funnel: Copied */}
        <div className="card-container" style={{ padding: 20 }}>
          <span className="text-micro" style={{ color: "var(--muted)" }}>
            DRAFTS COPIED
          </span>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#f59e0b",
              margin: "12px 0 4px 0",
            }}
          >
            {data.funnel.copied ?? 0}
          </div>
          <p className="text-micro" style={{ color: "var(--muted)", margin: 0 }}>
            {data.funnel.copied ?? 0} copied
          </p>
        </div>

        {/* Funnel: Posted */}
        <div className="card-container" style={{ padding: 20 }}>
          <span className="text-micro" style={{ color: "var(--muted)" }}>
            DRAFTS POSTED
          </span>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#22c55e",
              margin: "12px 0 4px 0",
            }}
          >
            {data.funnel.posted ?? 0}
          </div>
          <p className="text-micro" style={{ color: "var(--muted)", margin: 0 }}>
            {data.funnel.posted ?? 0} posted
          </p>
        </div>
      </div>

      {/* Breakdown by Category */}
      <div className="card-container" style={{ padding: 20 }}>
        <h2 className="text-micro" style={{ marginBottom: 16 }}>
          DRAFTS BY CATEGORY
        </h2>
        {data.by_category.length === 0 ? (
          <p className="text-micro" style={{ color: "var(--muted)" }}>
            No drafts created yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.by_category.map((cat, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface)",
                  borderRadius: 6,
                }}
              >
                <span className="text-micro">
                  {cat.category ? cat.category.toUpperCase() : "UNASSIGNED"}
                </span>
                <span className="text-micro" style={{ fontWeight: 700 }}>
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
