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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const matchDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (matchDay.getTime() === today.getTime()) return "Today";
  if (matchDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (matchDay.getTime() === tomorrow.getTime()) return "Tomorrow";
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

function StatusBadge({ outcome }: { outcome: "correct" | "incorrect" | "pending" | "void" }) {
  if (outcome === "correct") {
    return <span className="ds-badge ds-badge-success">{OUTCOME_LABEL[outcome]}</span>;
  }
  if (outcome === "incorrect") {
    return <span className="ds-badge ds-badge-danger">{OUTCOME_LABEL[outcome]}</span>;
  }
  if (outcome === "pending") {
    return <span className="ds-badge ds-badge-warning">{OUTCOME_LABEL[outcome]}</span>;
  }
  return <span className="ds-badge ds-badge-neutral">{OUTCOME_LABEL[outcome]}</span>;
}

function Crest({ team, size = 26 }: { team: string; size?: number }) {
  const logo = teamLogoPath(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" style={{ width: size, height: size, objectFit: "contain", borderRadius: 4 }} />;
  }
  const theme = getTeamTheme(team);
  return (
    <span
      style={{
        width: size,
        height: size,
        background: theme.primary,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        color: "#ffffff",
      }}
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
        transition: "transform 0.15s ease",
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
      <div className="ds-card" style={{ padding: "var(--space-lg)", display: "flex", gap: "var(--space-lg)" }}>
        <div className="ds-skeleton" style={{ width: 120, height: 120, minHeight: 0, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-sm)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ds-skeleton" style={{ minHeight: 56, borderRadius: "8px" }} />
          ))}
        </div>
      </div>
    );
  }

  const offset = stats.evaluated > 0 ? CIRCUMFERENCE * (1 - stats.accuracy_pct / 100) : CIRCUMFERENCE;
  const streakLabel =
    stats.streak > 1
      ? `${stats.streak} ${stats.streak_type === "win" ? "hits" : "misses"} in a row`
      : null;

  return (
    <div
      className="ds-card"
      style={{
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xl)",
        flexWrap: "wrap",
        background: "#ffffff",
      }}
    >
      <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
        <svg width={120} height={120} viewBox="0 0 128 128" role="img" aria-label={`${stats.accuracy_pct}% accuracy`}>
          <circle cx={64} cy={64} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={8} />
          <circle
            cx={64}
            cy={64}
            r={RADIUS}
            fill="none"
            stroke="var(--success-text)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 64 64)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
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
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>
            {stats.accuracy_pct.toFixed(0)}%
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase" }}>
            Hit Rate
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-tertiary)" }}>
          <span className="text-micro">Total Picks</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            {stats.total}
          </div>
        </div>

        <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-tertiary)" }}>
          <span className="text-micro">Hits / Misses</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            {stats.correct} <span style={{ fontSize: 13, color: "var(--fg-muted)", fontWeight: 500 }}>/ {stats.incorrect}</span>
          </div>
        </div>

        <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-tertiary)" }}>
          <span className="text-micro">Pending</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            {stats.pending}
          </div>
        </div>

        {streakLabel && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-tertiary)" }}>
            <span className="text-micro">Streak</span>
            <div style={{ fontSize: 14, fontWeight: 600, color: stats.streak_type === "win" ? "var(--success-text)" : "var(--error-text)", marginTop: 4 }}>
              {streakLabel}
            </div>
          </div>
        )}
      </div>
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
    <div
      className="ds-card"
      style={{
        padding: "12px 16px",
        background: "#ffffff",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <StatusBadge outcome={p.outcome} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Crest team={p.team_a} size={22} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
            {p.team_a}
          </span>
          <div className="prob-track" style={{ flex: 1, minWidth: 60, height: 6 }}>
            <div className="prob-fill" style={{ width: pct(probA * 100), background: themeA.primary }} />
            <div className="prob-fill" style={{ width: pct(probB * 100), background: themeB.primary }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
            {p.team_b}
          </span>
          <Crest team={p.team_b} size={22} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}>
          <span className="text-micro" style={{ margin: 0 }}>Pick</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: probA >= 0.5 ? themeA.primary : themeB.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.predicted_winner} · {pct(Math.max(probA, probB) * 100)}
          </span>
        </div>

        <div style={{ minWidth: 90 }}>
          {p.actual_winner ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{p.actual_winner}</span>
          ) : (
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>—</span>
          )}
        </div>

        <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
          {p.league}
        </span>

        <span style={{ marginLeft: "auto" }}>
          <ChevronIcon open={expanded} />
        </span>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-micro" style={{ width: 80, flexShrink: 0 }}>Venue</span>
            <span style={{ fontSize: 13, color: "var(--fg)" }}>{p.venue}</span>
          </div>
          {p.start_time && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="text-micro" style={{ width: 80, flexShrink: 0 }}>Match Time</span>
              <span style={{ fontSize: 13, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                {new Date(p.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
            </div>
          )}
          {p.reasons.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span className="text-micro" style={{ width: 80, flexShrink: 0, marginTop: 4 }}>Reasons</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.reasons.map((r, i) => (
                  <span key={i} className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
          {p.result_summary && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="text-micro" style={{ width: 80, flexShrink: 0 }}>Result</span>
              <span style={{ fontSize: 13, color: "var(--fg)" }}>{p.result_summary}</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            Model Predictions
          </h1>
          <p className="text-caption" style={{ margin: "4px 0 0" }}>
            LightGBM win-probability picks tracked against real match outcomes.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            id="run-model-btn"
            type="button"
            className="ds-btn ds-btn-primary"
            onClick={handleRunModel}
            disabled={runningModel}
          >
            {runningModel ? "Running Model…" : "Run Model"}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={handleSettle}
            disabled={settling}
          >
            {settling ? "Settling…" : "Settle Results"}
          </button>
        </div>
      </div>

      {error && (
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
          {error}
        </div>
      )}

      {runResult && (
        <div
          className="ds-card"
          style={{
            padding: "10px 14px",
            background: "var(--success-tint)",
            borderColor: "rgba(34, 197, 94, 0.2)",
            color: "var(--success-text)",
            fontSize: 13,
          }}
        >
          Generated {runResult.predictions_created} prediction{runResult.predictions_created !== 1 ? "s" : ""}.
        </div>
      )}

      {/* Accuracy summary */}
      <AccuracySummary stats={stats} />

      {/* Today's upcoming matches */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
          <span className="text-micro">Today&apos;s Fixtures ({todayMatches.length})</span>
        </div>

        {loadingToday && (
          <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Checking today&apos;s schedule…
          </div>
        )}

        {!loadingToday && todayMatches.length === 0 && (
          <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13, background: "#ffffff" }}>
            No matches scheduled for today. Run the model when fixtures are live.
          </div>
        )}

        {!loadingToday && todayMatches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {todayMatches.map((m) => (
              <div key={m.fixture_id} className="ds-card" style={{ padding: "14px 16px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                    {m.league}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtTime(m.start_time)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                  <Crest team={m.team_a} size={22} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.team_a}</span>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)", margin: "0 auto" }}>vs</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.team_b}</span>
                  <Crest team={m.team_b} size={22} />
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.venue}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)", flexWrap: "wrap", gap: 8 }}>
          <span className="text-micro">Prediction History ({filtered.length})</span>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* Outcome Filter */}
            <div className="ds-segmented-control">
              {["all", "correct", "incorrect", "pending"].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcomeFilter(o)}
                  className={`ds-segmented-item ${outcomeFilter === o ? "ds-segmented-item--active" : ""}`}
                  style={{ fontSize: 11, padding: "3px 8px", textTransform: "capitalize" }}
                >
                  {o === "all" ? "All" : o === "correct" ? "Hits" : o === "incorrect" ? "Misses" : "Pending"}
                </button>
              ))}
            </div>

            {/* League Filter */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {leagues.map((lg) => (
                <button
                  key={lg}
                  type="button"
                  onClick={() => setLeagueFilter(lg)}
                  className={`ds-filter-tab ${leagueFilter === lg ? "ds-filter-tab--active" : ""}`}
                  style={{ fontSize: 11, padding: "3px 8px" }}
                >
                  {lg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadingHistory && (
          <div className="ds-card" style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Loading prediction history…
          </div>
        )}

        {!loadingHistory && filtered.length === 0 && (
          <div className="ds-card" style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--fg-muted)", fontSize: 13, background: "#ffffff" }}>
            No predictions match the selected filter.
          </div>
        )}

        {!loadingHistory && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(grouped).map(([dateLabel, rows]) => (
              <div key={dateLabel} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="text-micro" style={{ color: "var(--fg-muted)" }}>
                  {dateLabel}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((p) => (
                    <PredictionRow key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
