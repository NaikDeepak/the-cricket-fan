"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { composerApi } from "@/lib/composerApi";
import type { Prediction, PredictionAccuracyStats } from "@/lib/composerApi";
import PredictionTrackCard from "@/components/predictions/PredictionTrackCard";

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
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 var(--space-lg)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md) 0 var(--space-lg)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Link href="/stories" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 800,
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              The Cricket Fan
            </span>
          </Link>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <Link href="/stories" className="ds-nav-link" style={{ fontSize: 14 }}>
            The Vault
          </Link>
          <Link href="/predictions" className="ds-nav-link" style={{ color: "var(--fg)", fontWeight: 700, fontSize: 14 }}>
            Predictions
          </Link>
          <Link href="/composer" className="ds-nav-link" style={{ fontSize: 14 }}>
            Composer
          </Link>
        </nav>
      </header>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-3xl)",
          fontWeight: 800,
          color: "var(--fg)",
          margin: "0 0 var(--space-lg) 0",
        }}
      >
        Every Prediction We&apos;ve Made
      </h1>

      {accuracy && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-base)",
            color: "var(--fg-muted)",
            marginBottom: "var(--space-lg)",
          }}
        >
          {accuracy.accuracy_pct}% Hit Rate · {accuracy.evaluated} Evaluated
          {accuracy.streak > 0
            ? ` · ${accuracy.streak}-${accuracy.streak_type === "win" ? "Win" : "Loss"} Streak`
            : ""}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          overflowX: "auto",
          marginBottom: "var(--space-lg)",
        }}
      >
        <button
          onClick={() => setSelectedLeague("")}
          className="ds-nav-link"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "6px 14px",
            background: selectedLeague === "" ? "var(--fg)" : "var(--surface)",
            color: selectedLeague === "" ? "var(--surface)" : "var(--fg-muted)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          All Leagues
        </button>
        {leagues.map((lg) => (
          <button
            key={lg}
            onClick={() => setSelectedLeague(lg)}
            className="ds-nav-link"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "6px 14px",
              background: selectedLeague === lg ? "var(--fg)" : "var(--surface)",
              color: selectedLeague === lg ? "var(--surface)" : "var(--fg-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {lg}
          </button>
        ))}
      </div>

      {isEmpty && (
        <p style={{ color: "var(--fg-muted)", fontSize: "var(--text-base)" }}>
          No predictions recorded{selectedLeague ? ` for ${selectedLeague}` : ""} yet.
        </p>
      )}

      {pending.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "var(--space-md)",
            }}
          >
            Upcoming
          </h2>
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
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
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "var(--space-md)",
            }}
          >
            History
          </h2>
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            {settled.map((p) => (
              <PredictionTrackCard key={p.id} prediction={p} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="ds-nav-link"
              style={{
                marginTop: "var(--space-lg)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "10px 24px",
                background: "var(--surface)",
                color: "var(--fg)",
                cursor: loadingMore ? "default" : "pointer",
                fontWeight: 600,
              }}
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
