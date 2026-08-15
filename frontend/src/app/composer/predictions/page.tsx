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

// ─── Constants ─────────────────────────────────────────────────────────────

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Helpers ───────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "TBD";
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

// ─── Accuracy Ring ─────────────────────────────────────────────────────────

function AccuracyRing({ stats }: { stats: PredictionAccuracyStats }) {
  const dash =
    stats.evaluated > 0 ? (stats.accuracy_pct / 100) * CIRCUMFERENCE : 0;
  const gap = CIRCUMFERENCE - dash;
  const streakIcon =
    stats.streak_type === "win"
      ? "🔥"
      : stats.streak_type === "loss"
        ? "❄️"
        : "";

  return (
    <div className="accuracy-ring-card">
      <div className="ring-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={
              stats.accuracy_pct >= 60
                ? "#22c55e"
                : stats.accuracy_pct >= 45
                  ? "#f59e0b"
                  : "#ef4444"
            }
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={CIRCUMFERENCE / 4}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="ring-inner">
          <span className="ring-pct">{stats.accuracy_pct}%</span>
          <span className="ring-label">accuracy</span>
        </div>
      </div>
      <div className="accuracy-stats">
        <div className="acc-stat correct">
          <span className="acc-val">{stats.correct}</span>
          <span className="acc-key">Correct</span>
        </div>
        <div className="acc-stat incorrect">
          <span className="acc-val">{stats.incorrect}</span>
          <span className="acc-key">Wrong</span>
        </div>
        <div className="acc-stat pending">
          <span className="acc-val">{stats.pending}</span>
          <span className="acc-key">Pending</span>
        </div>
        <div className="acc-stat void">
          <span className="acc-val">{stats.void}</span>
          <span className="acc-key">Void</span>
        </div>
      </div>
      {stats.streak > 1 && (
        <div className="streak-badge">
          {streakIcon} {stats.streak} in a row
        </div>
      )}
    </div>
  );
}

// ─── Today Match Card ───────────────────────────────────────────────────────

function TodayCard({
  match,
  onRunModel,
}: {
  match: TodayMatch;
  onRunModel: () => void;
}) {
  const themeA = getTeamTheme(match.team_a);
  const themeB = getTeamTheme(match.team_b);
  const pred = match.prediction;

  const probA = pred ? pred.prob_team_a : 0.5;
  const probB = 1 - probA;
  const predictedWinner = pred ? pred.predicted_winner : null;
  const outcome = pred?.outcome ?? "pending";
  const isSettled =
    outcome === "correct" || outcome === "incorrect" || outcome === "void";

  return (
    <div className={`today-card outcome-${outcome}`}>
      <div className="today-card-header">
        <span className="today-league">{match.league}</span>
        <span className="today-time">🕐 {fmtTime(match.start_time)}</span>
        <span className="today-venue">📍 {match.venue}</span>
      </div>

      <div className="today-teams">
        <div className="today-team">
          <div className="team-dot" style={{ background: themeA.primary }} />
          <span className="team-name">{match.team_a}</span>
          {match.winner === match.team_a && (
            <span className="winner-crown">👑</span>
          )}
        </div>
        <div className="vs-chip">VS</div>
        <div className="today-team today-team-right">
          {match.winner === match.team_b && (
            <span className="winner-crown">👑</span>
          )}
          <span className="team-name">{match.team_b}</span>
          <div className="team-dot" style={{ background: themeB.primary }} />
        </div>
      </div>

      {pred ? (
        <div className="prob-section">
          <div className="prob-bar-wrap">
            <div
              className="prob-bar-fill"
              style={{ width: pct(probA * 100), background: themeA.primary }}
            />
            <div
              className="prob-bar-fill"
              style={{ width: pct(probB * 100), background: themeB.primary }}
            />
          </div>
          <div className="prob-labels">
            <span className="prob-val" style={{ color: themeA.primary }}>
              {pct(probA * 100)}
            </span>
            <span className="prob-pick">
              Model pick: <strong>{predictedWinner}</strong>
            </span>
            <span className="prob-val" style={{ color: themeB.primary }}>
              {pct(probB * 100)}
            </span>
          </div>
          {pred.reasons.length > 0 && (
            <div className="reasons">
              {pred.reasons.slice(0, 2).map((r, i) => (
                <span key={i} className="reason-chip">
                  📊 {r.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="model-pending">
          <span className="pending-chip">MODEL PENDING</span>
          <button className="run-btn" onClick={onRunModel}>
            ▶ Run Model
          </button>
        </div>
      )}

      {isSettled && (
        <div className={`outcome-overlay outcome-${outcome}`}>
          {outcome === "correct" && (
            <>
              <span className="outcome-icon">✓</span>
              <span>HIT</span>
            </>
          )}
          {outcome === "incorrect" && (
            <>
              <span className="outcome-icon">✗</span>
              <span>MISS</span>
            </>
          )}
          {outcome === "void" && (
            <>
              <span className="outcome-icon">○</span>
              <span>VOID</span>
            </>
          )}
          {match.winner && outcome !== "void" && (
            <span className="outcome-winner">Winner: {match.winner}</span>
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
    <div
      className={`pred-row outcome-${p.outcome}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="pred-row-main">
        <div className={`pred-badge badge-${p.outcome}`}>
          {p.outcome === "correct" && "✓"}
          {p.outcome === "incorrect" && "✗"}
          {p.outcome === "pending" && "⏳"}
          {p.outcome === "void" && "○"}
        </div>

        <div className="pred-teams">
          <span className="pred-team-a" style={{ color: themeA.primary }}>
            {p.team_a}
          </span>
          <div className="pred-mini-bar">
            <div
              style={{
                width: pct(probA * 100),
                background: themeA.primary,
                height: "100%",
                borderRadius: "2px 0 0 2px",
              }}
            />
            <div
              style={{
                width: pct(probB * 100),
                background: themeB.primary,
                height: "100%",
                borderRadius: "0 2px 2px 0",
              }}
            />
          </div>
          <span className="pred-team-b" style={{ color: themeB.primary }}>
            {p.team_b}
          </span>
        </div>

        <div className="pred-pick">
          <span className="pick-label">Pick</span>
          <span
            className="pick-val"
            style={{ color: probA >= 0.5 ? themeA.primary : themeB.primary }}
          >
            {p.predicted_winner} {pct(Math.max(probA, probB) * 100)}
          </span>
        </div>

        <div className="pred-actual">
          {p.actual_winner ? (
            <span className="actual-val">{p.actual_winner}</span>
          ) : (
            <span className="actual-pending">—</span>
          )}
        </div>

        <div className="pred-league">{p.league}</div>
        <span className="pred-expand">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="pred-detail">
          <div className="pred-detail-row">
            <span className="detail-label">Venue</span>
            <span className="detail-val">📍 {p.venue}</span>
          </div>
          {p.start_time && (
            <div className="pred-detail-row">
              <span className="detail-label">Match time</span>
              <span className="detail-val">
                {new Date(p.start_time).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </span>
            </div>
          )}
          {p.reasons.length > 0 && (
            <div className="pred-detail-row">
              <span className="detail-label">SHAP reasons</span>
              <div className="reasons">
                {p.reasons.map((r, i) => (
                  <span key={i} className="reason-chip">
                    📊 {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
          {p.result_summary && (
            <div className="pred-detail-row">
              <span className="detail-label">Result</span>
              <span className="detail-val">{p.result_summary}</span>
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
    <div className="pred-page">
      <style>{`
        .pred-page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e2e8f0;
          font-family: "Inter", sans-serif;
          padding: 0 0 80px;
        }
        .pred-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 32px 0;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pred-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #a78bfa, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .action-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .action-btn {
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-run { background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; }
        .btn-run:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(124,58,237,0.4); }
        .btn-settle { background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        .btn-settle:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .btn-sync { background: rgba(255,255,255,0.04); color: #64748b; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; }
        .btn-sync:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #94a3b8; }
        .run-result {
          margin: 16px 32px 0;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          font-size: 13px;
          color: #86efac;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .error-banner {
          margin: 16px 32px 0;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          font-size: 13px;
          color: #fca5a5;
        }
        .pred-top-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          padding: 24px 32px;
        }
        @media (max-width: 900px) { .pred-top-grid { grid-template-columns: 1fr; } }
        .accuracy-ring-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .ring-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .ring-inner { position: absolute; display: flex; flex-direction: column; align-items: center; }
        .ring-pct { font-size: 26px; font-weight: 800; }
        .ring-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .accuracy-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
        .acc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
        }
        .acc-stat.correct { border: 1px solid rgba(34,197,94,0.25); }
        .acc-stat.incorrect { border: 1px solid rgba(239,68,68,0.25); }
        .acc-stat.pending { border: 1px solid rgba(251,191,36,0.2); }
        .acc-stat.void { border: 1px solid rgba(100,116,139,0.2); }
        .acc-val { font-size: 22px; font-weight: 700; }
        .acc-stat.correct .acc-val { color: #22c55e; }
        .acc-stat.incorrect .acc-val { color: #ef4444; }
        .acc-stat.pending .acc-val { color: #fbbf24; }
        .acc-stat.void .acc-val { color: #64748b; }
        .acc-key { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .streak-badge {
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.3);
          font-size: 13px;
          font-weight: 600;
          color: #fbbf24;
        }
        .today-section { display: flex; flex-direction: column; gap: 12px; }
        .today-section-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #475569;
          padding-bottom: 4px;
        }
        .today-cards-list { display: flex; flex-direction: column; gap: 12px; }
        .today-empty {
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          color: #475569;
          font-size: 14px;
        }
        .today-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 16px 20px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .today-card.outcome-correct { border-color: rgba(34,197,94,0.3); }
        .today-card.outcome-incorrect { border-color: rgba(239,68,68,0.3); }
        .today-card-header {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 12px;
          color: #475569;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .today-league {
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(167,139,250,0.15);
          color: #a78bfa;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }
        .today-teams {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 8px;
        }
        .today-team { display: flex; align-items: center; gap: 8px; flex: 1; }
        .today-team-right { justify-content: flex-end; }
        .team-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .team-name { font-size: 17px; font-weight: 700; }
        .winner-crown { font-size: 16px; }
        .vs-chip {
          padding: 4px 10px;
          background: rgba(255,255,255,0.06);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          flex-shrink: 0;
        }
        .prob-section { display: flex; flex-direction: column; gap: 8px; }
        .prob-bar-wrap {
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          background: rgba(255,255,255,0.04);
        }
        .prob-bar-fill { height: 100%; transition: width 0.6s ease; }
        .prob-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .prob-val { font-weight: 700; font-size: 14px; }
        .prob-pick { font-size: 12px; color: #94a3b8; text-align: center; }
        .prob-pick strong { color: #e2e8f0; }
        .reasons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .reason-chip {
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.15);
          font-size: 11px;
          color: #7dd3fc;
        }
        .model-pending { display: flex; align-items: center; gap: 12px; padding: 12px 0 4px; }
        .pending-chip {
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(251,191,36,0.1);
          border: 1px solid rgba(251,191,36,0.25);
          font-size: 12px;
          font-weight: 600;
          color: #fbbf24;
          letter-spacing: 0.5px;
        }
        .run-btn {
          padding: 6px 14px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
        }
        .run-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.4); }
        .outcome-overlay {
          margin-top: 14px;
          padding: 10px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 14px;
        }
        .outcome-overlay.outcome-correct { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
        .outcome-overlay.outcome-incorrect { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .outcome-overlay.outcome-void { background: rgba(100,116,139,0.1); color: #94a3b8; border: 1px solid rgba(100,116,139,0.15); }
        .outcome-icon { font-size: 18px; }
        .outcome-winner { margin-left: auto; font-size: 13px; font-weight: 500; }
        .pred-history { padding: 0 32px; }
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .history-title { font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #475569; }
        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .filter-select {
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 13px;
          cursor: pointer;
          outline: none;
        }
        option { background: #1e293b; }
        .date-group { margin-bottom: 24px; }
        .date-label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 0 0 8px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 8px;
        }
        .pred-row {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          overflow: hidden;
        }
        .pred-row:hover { background: rgba(255,255,255,0.05); }
        .pred-row.outcome-correct { border-color: rgba(34,197,94,0.2); }
        .pred-row.outcome-incorrect { border-color: rgba(239,68,68,0.15); }
        .pred-row-main {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          flex-wrap: wrap;
        }
        .pred-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .badge-correct { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .badge-incorrect { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
        .badge-pending { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
        .badge-void { background: rgba(100,116,139,0.1); color: #64748b; border: 1px solid rgba(100,116,139,0.2); }
        .pred-teams { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
        .pred-team-a, .pred-team-b { font-weight: 700; font-size: 14px; }
        .pred-mini-bar { flex: 1; height: 6px; border-radius: 3px; overflow: hidden; display: flex; min-width: 60px; }
        .pred-pick { display: flex; flex-direction: column; gap: 2px; min-width: 110px; }
        .pick-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        .pick-val { font-size: 13px; font-weight: 600; }
        .pred-actual { min-width: 80px; }
        .actual-val { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        .actual-pending { color: #334155; font-size: 18px; }
        .pred-league {
          font-size: 11px;
          color: #475569;
          background: rgba(255,255,255,0.04);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .pred-expand { color: #334155; font-size: 10px; margin-left: auto; }
        .pred-detail {
          padding: 12px 16px 14px 56px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .pred-detail-row { display: flex; gap: 16px; align-items: flex-start; }
        .detail-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 90px; flex-shrink: 0; }
        .detail-val { font-size: 13px; color: #94a3b8; }
        .history-empty { text-align: center; padding: 48px; color: #475569; font-size: 14px; }
      `}</style>

      {/* Top bar */}
      <div className="pred-topbar">
        <h1 className="pred-title">Predictions</h1>
        <div className="action-btns">
          <button
            id="run-model-btn"
            className="action-btn btn-run"
            onClick={handleRunModel}
            disabled={runningModel}
          >
            {runningModel ? "⚙ Running…" : "▶ Run Model"}
          </button>
          <button
            id="settle-api-btn"
            className="action-btn btn-settle"
            onClick={handleSettle}
            disabled={settling}
          >
            {settling ? "⏳ Settling…" : "🔄 Settle from API"}
          </button>
          <button
            id="sync-results-btn"
            className="action-btn btn-sync"
            onClick={async () => {
              await composerApi.syncPredictionResults();
              await loadHistory();
            }}
          >
            ↻ Sync DB
          </button>
        </div>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
      {runResult && (
        <div className="run-result">
          <span>✓ Model ran</span>
          <span>
            Created: <strong>{runResult.predictions_created}</strong>
          </span>
          <span>Skipped: {runResult.predictions_skipped}</span>
          <span>Fixtures found: {runResult.fixtures_found}</span>
          {runResult.errors.length > 0 && (
            <span>⚠ {runResult.errors[0]}</span>
          )}
        </div>
      )}

      {/* Top grid */}
      <div className="pred-top-grid">
        {stats ? (
          <AccuracyRing stats={stats} />
        ) : (
          <div className="accuracy-ring-card">
            <div style={{ color: "#334155", fontSize: 14 }}>
              Loading stats…
            </div>
          </div>
        )}

        <div className="today-section">
          <div className="today-section-title">📅 Today&apos;s Matches</div>
          <div className="today-cards-list">
            {loadingToday ? (
              <div className="today-empty">Loading today&apos;s fixtures…</div>
            ) : todayMatches.length === 0 ? (
              <div className="today-empty">
                No fixtures for today.
                <br />
                <small style={{ marginTop: 8, display: "block" }}>
                  Click <strong>▶ Run Model</strong> to fetch &amp; predict
                  upcoming matches.
                </small>
              </div>
            ) : (
              todayMatches.map((m) => (
                <TodayCard
                  key={m.fixture_id}
                  match={m}
                  onRunModel={handleRunModel}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="pred-history">
        <div className="history-header">
          <span className="history-title">
            📜 Prediction History ({filtered.length})
          </span>
          <div className="filter-row">
            <select
              id="outcome-filter"
              className="filter-select"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="all">All outcomes</option>
              <option value="correct">✓ Correct</option>
              <option value="incorrect">✗ Incorrect</option>
              <option value="pending">⏳ Pending</option>
              <option value="void">○ Void</option>
            </select>
            <select
              id="league-filter"
              className="filter-select"
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
            >
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingHistory ? (
          <div className="history-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="history-empty">
            No predictions yet. Click <strong>▶ Run Model</strong> to generate
            your first prediction.
          </div>
        ) : (
          Object.entries(grouped).map(([date, preds]) => (
            <div key={date} className="date-group">
              <div className="date-label">{date}</div>
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
