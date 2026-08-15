"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  composerApi,
  type Prediction,
  type PredictionAccuracyStats,
  type RunModelResult,
  type TodayMatch,
} from "@/lib/composerApi";
import { getTeamTheme } from "@/lib/teamColors";
import { teamInitials, teamLogoPath } from "@/lib/teamLogo";

// ─── Constants ─────────────────────────────────────────────────────────────

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Helpers ───────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (matchDay.getTime() === today.getTime()) return "Today";
  if (matchDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function groupByDate(predictions: Prediction[]): Record<string, Prediction[]> {
  const groups: Record<string, Prediction[]> = {};
  for (const p of predictions) {
    const key = fmtDate(p.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

const OUTCOME_LABEL: Record<string, string> = {
  correct: "Hit",
  incorrect: "Miss",
  pending: "Pending",
  void: "Void",
};

// ─── Small shared bits ──────────────────────────────────────────────────────

function StatusPill({ outcome }: { outcome: "correct" | "incorrect" | "pending" | "void" }) {
  return <span className={`status-pill status-pill--${outcome}`}>{OUTCOME_LABEL[outcome]}</span>;
}

function Crest({ team, size = 28 }: { team: string; size?: number }) {
  const logo = teamLogoPath(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="team-crest" style={{ width: size, height: size }} />;
  }
  const theme = getTeamTheme(team);
  return (
    <span
      className="team-crest-fallback"
      style={{ width: size, height: size, background: theme.primary }}
      aria-hidden
    >
      {teamInitials(team)}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform var(--duration-fast) var(--ease-apple)",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Accuracy summary ───────────────────────────────────────────────────────

function AccuracySummary({ stats }: { stats: PredictionAccuracyStats | null }) {
  if (!stats) {
    return (
      <div className="card-container" style={{ padding: "var(--space-lg)", display: "flex", gap: "var(--space-lg)" }}>
        <div className="ds-skeleton" style={{ width: 128, height: 128, minHeight: 0, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-sm)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ds-skeleton" style={{ minHeight: 64, borderRadius: "16px" }} />
          ))}
        </div>
      </div>
    );
  }

  const offset = stats.evaluated > 0 ? CIRCUMFERENCE * (1 - stats.accuracy_pct / 100) : CIRCUMFERENCE;
  const streakLabel =
    stats.streak > 1
      ? `${stats.streak} ${stats.streak_type === "win" ? "correct" : "incorrect"} in a row`
      : null;

  return (
    <div
      className="card-container"
      style={{
        padding: "var(--space-lg)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xl)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0 }}>
        <svg width={128} height={128} viewBox="0 0 128 128" role="img" aria-label={`${stats.accuracy_pct}% prediction accuracy`}>
          <circle cx={64} cy={64} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={10} />
          <circle
            cx={64}
            cy={64}
            r={RADIUS}
            fill="none"
            stroke="var(--wire-red)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 64 64)"
            style={{ transition: `stroke-dashoffset var(--duration-slow) var(--ease-apple)` }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-oswald), sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--fg)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stats.accuracy_pct}%
          </span>
          <span className="text-micro" style={{ margin: 0 }}>Accuracy</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: "var(--space-sm)" }}>
          <div className="ds-metric-pill">
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.correct}</span>
            <span className="text-micro" style={{ margin: 0 }}>Correct</span>
          </div>
          <div className="ds-metric-pill">
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.incorrect}</span>
            <span className="text-micro" style={{ margin: 0 }}>Incorrect</span>
          </div>
          <div className="ds-metric-pill">
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.pending}</span>
            <span className="text-micro" style={{ margin: 0 }}>Pending</span>
          </div>
          <div className="ds-metric-pill">
            <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{stats.void}</span>
            <span className="text-micro" style={{ margin: 0 }}>Void</span>
          </div>
        </div>
        {streakLabel && (
          <span
            className={`status-pill status-pill--${stats.streak_type === "win" ? "correct" : "incorrect"}`}
            style={{ alignSelf: "flex-start" }}
          >
            {streakLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Today Match Card ───────────────────────────────────────────────────────

function MatchCard({ match, onRunModel, running }: { match: TodayMatch; onRunModel: () => void; running: boolean }) {
  const themeA = getTeamTheme(match.team_a);
  const themeB = getTeamTheme(match.team_b);
  const pred = match.prediction;

  const probA = pred ? pred.prob_team_a : 0.5;
  const probB = 1 - probA;
  const outcome = (pred?.outcome ?? "pending") as "correct" | "incorrect" | "pending" | "void";
  const isSettled = outcome === "correct" || outcome === "incorrect" || outcome === "void";

  return (
    <div className="card-container match-card">
      <div className="match-card-header">
        <span className="ds-chip ds-chip-category">{match.league}</span>
        <span className="text-caption" style={{ textAlign: "right" }}>
          {fmtTime(match.start_time)} &middot; {match.venue}
        </span>
      </div>

      <div className="match-teams-row">
        <div className="team-slot">
          <Crest team={match.team_a} />
          <span className="team-name-sm">{match.team_a}</span>
        </div>
        <span className="vs-divider">VS</span>
        <div className="team-slot team-slot--end">
          <Crest team={match.team_b} />
          <span className="team-name-sm">{match.team_b}</span>
        </div>
      </div>

      {pred ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <div className="prob-track">
            <div className="prob-fill" style={{ width: pct(probA * 100), background: themeA.primary }} />
            <div className="prob-fill" style={{ width: pct(probB * 100), background: themeB.primary }} />
          </div>
          <div className="prob-readout">
            <span style={{ color: themeA.primary }}>{pct(probA * 100)}</span>
            <span style={{ color: themeB.primary }}>{pct(probB * 100)}</span>
          </div>
          <p className="text-caption" style={{ margin: 0 }}>
            Model pick: <strong style={{ color: "var(--fg)" }}>{pred.predicted_winner}</strong>
          </p>
          {pred.reasons.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {pred.reasons.slice(0, 2).map((r, i) => (
                <span key={i} className="ds-chip ds-chip-category" style={{ fontSize: 10 }}>
                  {r.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
          <span className="text-caption">Model hasn&apos;t run for this fixture yet.</span>
          <button
            className="ds-btn-primary"
            style={{ padding: "8px 16px", fontSize: 12, flexShrink: 0 }}
            onClick={onRunModel}
            disabled={running}
          >
            {running ? "Running…" : "Run Model"}
          </button>
        </div>
      )}

      {isSettled && (
        <div className="match-card-footer">
          <StatusPill outcome={outcome} />
          {match.winner && outcome !== "void" && (
            <span className="text-caption">Winner: {match.winner}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History Row ────────────────────────────────────────────────────────────

function PredictionRow({ p }: { p: Prediction }) {
  const [expanded, setExpanded] = useState(false);
  const themeA = getTeamTheme(p.team_a);
  const themeB = getTeamTheme(p.team_b);
  const probA = p.prob_team_a;
  const probB = 1 - probA;

  return (
    <div className="history-row" onClick={() => setExpanded((v) => !v)}>
      <div className="history-row-main">
        <StatusPill outcome={p.outcome} />

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1, minWidth: 220 }}>
          <span className="text-caption" style={{ color: themeA.primary, fontWeight: 600 }}>
            {p.team_a}
          </span>
          <div className="prob-track" style={{ flex: 1, minWidth: 60 }}>
            <div className="prob-fill" style={{ width: pct(probA * 100), background: themeA.primary }} />
            <div className="prob-fill" style={{ width: pct(probB * 100), background: themeB.primary }} />
          </div>
          <span className="text-caption" style={{ color: themeB.primary, fontWeight: 600 }}>
            {p.team_b}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 110 }}>
          <span className="text-micro" style={{ margin: 0 }}>Pick</span>
          <span
            className="text-caption"
            style={{ fontWeight: 600, color: probA >= 0.5 ? themeA.primary : themeB.primary }}
          >
            {p.predicted_winner} &middot; {pct(Math.max(probA, probB) * 100)}
          </span>
        </div>

        <div style={{ minWidth: 90 }}>
          {p.actual_winner ? (
            <span className="text-caption" style={{ fontWeight: 600 }}>{p.actual_winner}</span>
          ) : (
            <span className="text-caption">—</span>
          )}
        </div>

        <span className="ds-chip ds-chip-category">{p.league}</span>
        <span style={{ marginLeft: "auto" }}>
          <ChevronIcon open={expanded} />
        </span>
      </div>

      {expanded && (
        <div className="history-row-detail" onClick={(e) => e.stopPropagation()}>
          <div className="history-detail-item">
            <span className="text-micro" style={{ width: 90, flexShrink: 0 }}>Venue</span>
            <span className="text-caption">{p.venue}</span>
          </div>
          {p.start_time && (
            <div className="history-detail-item">
              <span className="text-micro" style={{ width: 90, flexShrink: 0 }}>Match time</span>
              <span className="text-caption">
                {new Date(p.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
            </div>
          )}
          {p.reasons.length > 0 && (
            <div className="history-detail-item">
              <span className="text-micro" style={{ width: 90, flexShrink: 0 }}>Reasons</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.reasons.map((r, i) => (
                  <span key={i} className="ds-chip ds-chip-category" style={{ fontSize: 10 }}>
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
          {p.result_summary && (
            <div className="history-detail-item">
              <span className="text-micro" style={{ width: 90, flexShrink: 0 }}>Result</span>
              <span className="text-caption">{p.result_summary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [todayMatches, setTodayMatches] = useState<TodayMatch[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<PredictionAccuracyStats | null>(null);

  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [runningModel, setRunningModel] = useState(false);
  const [settling, setSettling] = useState(false);
  const [runResult, setRunResult] = useState<RunModelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("All");

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const data = await composerApi.todayMatches();
      setTodayMatches(data);
    } catch {
      // no today matches is fine
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [preds, accuracy] = await Promise.all([
        composerApi.predictions({ limit: 200 }),
        composerApi.predictionAccuracy(),
      ]);
      setPredictions(preds);
      setStats(accuracy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load predictions");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadToday();
    loadHistory();
  }, [loadToday, loadHistory]);

  const handleRunModel = async () => {
    setRunningModel(true);
    setRunResult(null);
    setError(null);
    try {
      const result = await composerApi.runModel();
      setRunResult(result);
      await loadToday();
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Model run failed");
    } finally {
      setRunningModel(false);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    setError(null);
    try {
      await composerApi.settleFromApi();
      await loadToday();
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed — check CRICKET_API_KEY");
    } finally {
      setSettling(false);
    }
  };

  const leagues = useMemo(() => {
    const s = new Set(predictions.map((p) => p.league));
    return ["All", ...Array.from(s).sort()];
  }, [predictions]);

  const filtered = useMemo(() => {
    return predictions.filter((p) => {
      if (outcomeFilter !== "all" && p.outcome !== outcomeFilter) return false;
      if (leagueFilter !== "All" && p.league !== leagueFilter) return false;
      return true;
    });
  }, [predictions, outcomeFilter, leagueFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <h1 className="text-tool-headline" style={{ margin: 0 }}>Predictions</h1>
          <p className="text-caption" style={{ margin: "4px 0 0" }}>
            LightGBM win-probability picks, tracked against real results.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
          <button
            id="run-model-btn"
            className="ds-btn-primary"
            onClick={handleRunModel}
            disabled={runningModel}
          >
            {runningModel ? "Running…" : "Run Model"}
          </button>
          <button
            id="settle-api-btn"
            className="ds-btn-secondary"
            onClick={handleSettle}
            disabled={settling}
          >
            {settling ? "Settling…" : "Settle from API"}
          </button>
          <button
            id="sync-results-btn"
            className="ds-nav-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={async () => {
              await composerApi.syncPredictionResults();
              await loadHistory();
            }}
          >
            Sync DB
          </button>
        </div>
      </div>

      {error && (
        <div
          className="text-caption"
          style={{
            background: "var(--error-tint)",
            border: "1px solid rgba(255, 59, 48, 0.25)",
            borderRadius: 16,
            padding: "var(--space-sm) var(--space-md)",
            color: "var(--error)",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
      {runResult && (
        <div
          className="text-caption"
          style={{
            background: "var(--success-tint)",
            border: "1px solid rgba(52, 199, 89, 0.25)",
            borderRadius: 16,
            padding: "var(--space-sm) var(--space-md)",
            display: "flex",
            gap: "var(--space-lg)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700, color: "#1c8a3f" }}>Model ran</span>
          <span>Created: <strong>{runResult.predictions_created}</strong></span>
          <span>Skipped: {runResult.predictions_skipped}</span>
          <span>Fixtures found: {runResult.fixtures_found}</span>
          {runResult.errors.length > 0 && <span>{runResult.errors[0]}</span>}
        </div>
      )}

      {/* Accuracy summary */}
      <AccuracySummary stats={loadingHistory ? null : stats} />

      {/* Today's Matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        <span className="text-micro">Today&apos;s Matches</span>
        {loadingToday ? (
          <div className="match-grid">
            {[0, 1].map((i) => (
              <div key={i} className="ds-skeleton" style={{ minHeight: 190 }} />
            ))}
          </div>
        ) : todayMatches.length === 0 ? (
          <div
            className="card-container"
            style={{ padding: "var(--space-xl)", textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span className="text-title" style={{ margin: 0 }}>No fixtures for today</span>
            <span className="text-caption">
              Nothing kicking off in a tracked league right now. Click <strong>Run Model</strong> to check for newly published fixtures.
            </span>
          </div>
        ) : (
          <div className="match-grid">
            {todayMatches.map((m) => (
              <MatchCard key={m.fixture_id} match={m} onRunModel={handleRunModel} running={runningModel} />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-sm)" }}>
          <span className="text-micro">Prediction History ({filtered.length})</span>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <select
              id="outcome-filter"
              className="ds-select"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="all">All outcomes</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
              <option value="pending">Pending</option>
              <option value="void">Void</option>
            </select>
            <select
              id="league-filter"
              className="ds-select"
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
            >
              {leagues.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="ds-skeleton" style={{ minHeight: 56, borderRadius: 16 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="card-container"
            style={{ padding: "var(--space-xl)", textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span className="text-title" style={{ margin: 0 }}>No predictions yet</span>
            <span className="text-caption">
              Click <strong>Run Model</strong> above to generate your first prediction.
            </span>
          </div>
        ) : (
          Object.entries(grouped).map(([date, preds]) => (
            <div key={date}>
              <div
                className="text-micro"
                style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 8 }}
              >
                {date}
              </div>
              {preds.map((p) => (
                <PredictionRow key={p.id} p={p} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
