"use client";

import { useEffect, useState } from "react";
import { composerApi } from "@/lib/composerApi";
import type { Prediction, PredictionAccuracyStats } from "@/lib/composerApi";
import PredictionTrackCard from "@/components/predictions/PredictionTrackCard";
import AppleGlobalNav from "@/components/common/AppleGlobalNav";

const PAGE_SIZE = 20;

export default function PredictionsPage() {
  const [accuracy, setAccuracy] = useState<PredictionAccuracyStats | null>(null);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [pending, setPending] = useState<Prediction[]>([]);
  const [settled, setSettled] = useState<Prediction[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    composerApi.predictionAccuracy().then(setAccuracy).catch(() => setAccuracy(null));
    composerApi.predictionLeagues().then(setLeagues).catch(() => setLeagues([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const leagueParam = selectedLeague || undefined;

    Promise.all([
      composerApi.predictions({ outcome: "pending", league: leagueParam }),
      composerApi.predictions({
        outcome: "correct,incorrect,void",
        league: leagueParam,
        limit: PAGE_SIZE,
        offset: 0,
      }),
    ])
      .then(([pendingRows, settledRows]) => {
        if (cancelled) return;
        setPending(pendingRows);
        setSettled(settledRows);
        setOffset(0);
        setHasMore(settledRows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled) return;
        setPending([]);
        setSettled([]);
        setOffset(0);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLeague]);

  async function loadMore() {
    setLoadingMore(true);
    const nextOffset = offset + PAGE_SIZE;
    try {
      const rows = await composerApi.predictions({
        outcome: "correct,incorrect,void",
        league: selectedLeague || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setSettled((prev) => [...prev, ...rows]);
      setOffset(nextOffset);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const isEmpty = !loading && pending.length === 0 && settled.length === 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AppleGlobalNav />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-xl) var(--space-lg) var(--space-2xl)" }}>
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <span className="text-micro">Public Track Record</span>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "4px 0 0 0",
              color: "var(--fg)",
            }}
          >
            Prediction Performance History
          </h1>
          <p className="text-caption" style={{ margin: "4px 0 0 0" }}>
            Unfiltered record of every automated match prediction, probability, and outcome published by the model.
          </p>
        </div>

        {/* Accuracy Stats Strip */}
        {accuracy && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--space-md)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <div className="ds-card" style={{ padding: "14px 18px", background: "#ffffff" }}>
              <span className="text-micro">Hit Rate</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--fg)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {accuracy.accuracy_pct}%
              </div>
              <div className="text-caption" style={{ fontSize: 12, marginTop: 2 }}>
                Overall model win rate
              </div>
            </div>

            <div className="ds-card" style={{ padding: "14px 18px", background: "#ffffff" }}>
              <span className="text-micro">Evaluated Matches</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--fg)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {accuracy.evaluated} Evaluated
              </div>
              <div className="text-caption" style={{ fontSize: 12, marginTop: 2 }}>
                Settled fixtures
              </div>
            </div>

            {accuracy.streak > 0 && (
              <div className="ds-card" style={{ padding: "14px 18px", background: "#ffffff" }}>
                <span className="text-micro">Current Streak</span>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: accuracy.streak_type === "win" ? "var(--success-text)" : "var(--error-text)",
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {accuracy.streak} {accuracy.streak_type === "win" ? "Wins" : "Losses"}
                </div>
                <div className="text-caption" style={{ fontSize: 12, marginTop: 2 }}>
                  Active run
                </div>
              </div>
            )}
          </div>
        )}

        {/* League Filter Chips */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-xs)",
            overflowX: "auto",
            paddingBottom: "var(--space-xs)",
            marginBottom: "var(--space-lg)",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedLeague("")}
            className={`ds-filter-tab ${selectedLeague === "" ? "ds-filter-tab--active" : ""}`}
            style={{ fontSize: 13, padding: "5px 12px" }}
          >
            All Leagues
          </button>
          {leagues.map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => setSelectedLeague(lg)}
              className={`ds-filter-tab ${selectedLeague === lg ? "ds-filter-tab--active" : ""}`}
              style={{ fontSize: 13, padding: "5px 12px" }}
            >
              {lg}
            </button>
          ))}
        </div>

        {isEmpty && (
          <div className="ds-card" style={{ textAlign: "center", padding: "var(--space-xl)", background: "#ffffff" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
              No predictions recorded{selectedLeague ? ` for ${selectedLeague}` : ""} yet.
            </p>
            <p className="text-caption" style={{ marginTop: 4 }}>
              Predictions will automatically appear here once match fixtures are published.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section style={{ marginBottom: "var(--space-xl)" }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--fg-muted)",
                marginBottom: "var(--space-sm)",
              }}
            >
              Upcoming Fixtures ({pending.length})
            </h2>
            <div style={{ display: "grid", gap: "var(--space-sm)" }}>
              {pending.map((p) => (
                <PredictionTrackCard key={p.id} prediction={p} />
              ))}
            </div>
          </section>
        )}

        {settled.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--fg-muted)",
                marginBottom: "var(--space-sm)",
              }}
            >
              Completed History ({settled.length})
            </h2>
            <div style={{ display: "grid", gap: "var(--space-sm)" }}>
              {settled.map((p) => (
                <PredictionTrackCard key={p.id} prediction={p} />
              ))}
            </div>
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="ds-btn ds-btn-secondary"
                  style={{
                    padding: "8px 24px",
                    fontSize: 13,
                  }}
                >
                  {loadingMore ? "Loading…" : "Load More Predictions"}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
