"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  composerApi,
  type BacktestGame,
  type BacktestOptions,
  type BacktestResult,
} from "@/lib/composerApi";
import { getTeamTheme } from "@/lib/teamColors";
import { teamInitials, teamLogoPath } from "@/lib/teamLogo";

// ─── SVG Progress Ring Constants ─────────────────────────────────────────────

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function Crest({ team, size = 26 }: { team: string; size?: number }) {
  const logo = teamLogoPath(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="team-crest" style={{ width: size, height: size }} />;
  }
  const theme = getTeamTheme(team);
  return (
    <span
      className="team-crest-fallback"
      style={{
        width: size,
        height: size,
        background: theme.primary,
        fontSize: size * 0.42,
      }}
      aria-hidden
    >
      {teamInitials(team)}
    </span>
  );
}

function AccuracyRing({
  accuracyPct,
  correct,
  total,
}: {
  accuracyPct: number;
  correct: number;
  total: number;
}) {
  const offset = CIRCUMFERENCE - (accuracyPct / 100) * CIRCUMFERENCE;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-lg)",
        padding: "var(--space-md)",
      }}
    >
      <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
        <svg
          width="110"
          height="110"
          viewBox="0 0 110 110"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            stroke="var(--border)"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            stroke={accuracyPct >= 60 ? "var(--success)" : "var(--wire-red)"}
            strokeWidth="8"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
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
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--fg)",
            }}
          >
            {pct(accuracyPct)}
          </span>
          <span className="text-micro" style={{ fontSize: 9 }}>
            ACCURACY
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="text-micro">SEASON PERFORMANCE</span>
        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: "var(--fg)",
          }}
        >
          {correct} of {total} Matches Correct
        </span>
        <span className="text-caption">
          Temporal holdout with zero feature leakage. Evaluated strictly against
          pre-match history.
        </span>
      </div>
    </div>
  );
}

// ─── Main Backtest Page Component ────────────────────────────────────────────

export default function BacktestPage() {
  const [options, setOptions] = useState<BacktestOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<string>("");

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [filterOutcome, setFilterOutcome] = useState<"all" | "correct" | "incorrect">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Load available options and ingestion telemetry on mount
  useEffect(() => {
    let active = true;
    composerApi
      .backtestOptions()
      .then((opts) => {
        if (!active) return;
        setOptions(opts);
        if (opts.leagues.length > 0) {
          const defaultLeague = opts.leagues.includes("IPL") ? "IPL" : opts.leagues[0];
          setSelectedLeague(defaultLeague);
          const seasons = opts.seasons_by_league[defaultLeague] || [];
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0]);
          }
        }
        setOptionsError(null);
      })
      .catch((err) => {
        if (!active) return;
        setOptionsError(err instanceof Error ? err.message : "Failed to load backtest options");
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Update selected season when league changes
  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    if (options) {
      const seasons = options.seasons_by_league[league] || [];
      if (seasons.length > 0) {
        setSelectedSeason(seasons[0]);
      } else {
        setSelectedSeason("");
      }
    }
  };

  // Run the backtest
  const handleRunBacktest = useCallback(async () => {
    if (!selectedLeague || !selectedSeason) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await composerApi.runBacktest(selectedLeague, selectedSeason);
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run backtest");
    } finally {
      setRunning(false);
    }
  }, [selectedLeague, selectedSeason]);

  // Filtered games list
  const filteredGames = useMemo(() => {
    if (!result || !result.games) return [];
    return result.games.filter((g) => {
      if (filterOutcome === "correct" && !g.correct) return false;
      if (filterOutcome === "incorrect" && g.correct) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTeamA = g.team_a.toLowerCase().includes(term);
        const matchesTeamB = g.team_b.toLowerCase().includes(term);
        const matchesVenue = g.venue.toLowerCase().includes(term);
        if (!matchesTeamA && !matchesTeamB && !matchesVenue) return false;
      }
      return true;
    });
  }, [result, filterOutcome, searchTerm]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* ── Page Header & Data Ingestion Indicator ──────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: 4 }}>
            <span className="text-micro" style={{ color: "var(--wire-red)" }}>
              HISTORICAL SIMULATION
            </span>
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--fg)",
            }}
          >
            Model Backtest Engine
          </h1>
          <p className="text-caption" style={{ margin: "4px 0 0 0", maxWidth: 640 }}>
            Benchmark committed model artifacts against real match outcomes for any historical season.
            Strict chronological leakage guard ensures zero lookahead bias.
          </p>
        </div>

        {/* Ingestion Telemetry Live Card */}
        {options && (
          <div
            className="card-container"
            style={{
              padding: "10px 16px",
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 260,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--success)",
                  boxShadow: "0 0 8px var(--success)",
                }}
              />
              <span className="text-micro" style={{ color: "var(--fg)", fontWeight: 700 }}>
                INGESTION STORE READY
              </span>
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--fg-muted)" }}>
              <strong style={{ color: "var(--fg)" }}>{options.total_matches.toLocaleString()}</strong> matches ingested
              {options.earliest_date && options.latest_date && (
                <span> ({options.earliest_date.split("-")[0]} – {options.latest_date.split("-")[0]})</span>
              )}
            </div>
            {options.last_match && (
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--fg-muted)",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 4,
                  marginTop: 2,
                }}
              >
                Latest: <strong>{options.last_match.team_a}</strong> vs <strong>{options.last_match.team_b}</strong> ({options.last_match.date})
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Selection Control Bar ───────────────────────────────────────── */}
      <div
        className="card-container"
        style={{
          padding: "var(--space-md) var(--space-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          background: "#ffffff",
          borderRadius: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
          {/* League Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="backtest-league-select" className="text-micro">LEAGUE</label>
            <select
              id="backtest-league-select"
              value={selectedLeague}
              onChange={(e) => handleLeagueChange(e.target.value)}
              disabled={optionsLoading || !options || options.leagues.length === 0}
              className="ds-input"
              style={{
                minWidth: 160,
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              {options?.leagues.map((lg) => (
                <option key={lg} value={lg}>
                  {lg} ({options.matches_by_league[lg] ?? 0} matches)
                </option>
              ))}
            </select>
          </div>

          {/* Season Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="backtest-season-select" className="text-micro">SEASON / YEAR</label>
            <select
              id="backtest-season-select"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              disabled={optionsLoading || !selectedLeague || !options}
              className="ds-input"
              style={{
                minWidth: 140,
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              {(options?.seasons_by_league[selectedLeague] ?? []).map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleRunBacktest}
            disabled={running || optionsLoading || !selectedLeague || !selectedSeason}
            className="ds-btn-pill ds-btn-pill-dark"
            style={{
              padding: "10px 24px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: running ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {running ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#ffffff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Simulating {selectedLeague} {selectedSeason}...
              </>
            ) : (
              <>Run Backtest</>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Notices ───────────────────────────────────────────────── */}
      {optionsError && (
        <div
          className="card-container"
          style={{
            padding: "var(--space-md)",
            background: "var(--error-tint)",
            borderColor: "var(--error)",
            color: "var(--error)",
            borderRadius: "14px",
          }}
        >
          <strong>Options Error:</strong> {optionsError}
        </div>
      )}

      {runError && (
        <div
          className="card-container"
          style={{
            padding: "var(--space-lg)",
            background: "var(--error-tint)",
            borderColor: "var(--error)",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--error)" }}>
            <span className="text-micro" style={{ color: "var(--error)", fontWeight: 700 }}>
              BACKTEST EXECUTION FAILED
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--fg)" }}>
            {runError}
          </p>
          {runError.toLowerCase().includes("artifact") && (
            <p className="text-caption" style={{ margin: "4px 0 0 0" }}>
              Please train and generate the model artifact first via:{" "}
              <code style={{ background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                python -m bot.train --cricsheet-dir ... --league-map ...
              </code>
            </p>
          )}
        </div>
      )}

      {/* ── Backtest Results Section ────────────────────────────────────── */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Summary Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {/* Accuracy Ring Hero Card */}
            <div
              className="card-container"
              style={{
                gridColumn: "1 / -1",
                background: "#ffffff",
                borderRadius: "20px",
                padding: "var(--space-sm)",
              }}
            >
              <AccuracyRing
                accuracyPct={result.accuracy_pct}
                correct={result.correct}
                total={result.total}
              />
            </div>

            {/* Metric 1: Model Accuracy */}
            <div
              className="card-container"
              style={{
                padding: "var(--space-md) var(--space-lg)",
                background: "#ffffff",
                borderRadius: "16px",
              }}
            >
              <span className="text-micro">LIGHTGBM MODEL</span>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--fg)",
                  marginTop: 4,
                }}
              >
                {pct(result.accuracy_pct)}
              </div>
              <div className="text-caption" style={{ marginTop: 2 }}>
                {result.correct} / {result.total} predicted correctly
              </div>
            </div>

            {/* Metric 2: Elo Baseline */}
            <div
              className="card-container"
              style={{
                padding: "var(--space-md) var(--space-lg)",
                background: "#ffffff",
                borderRadius: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="text-micro">ELO BASELINE</span>
                <span
                  className={`status-pill ${
                    result.accuracy_pct >= result.elo_accuracy_pct
                      ? "status-pill--correct"
                      : "status-pill--incorrect"
                  }`}
                  style={{ fontSize: 11 }}
                >
                  {result.accuracy_pct >= result.elo_accuracy_pct
                    ? `+${result.accuracy_pct - result.elo_accuracy_pct}% vs Elo`
                    : `-${result.elo_accuracy_pct - result.accuracy_pct}% vs Elo`}
                </span>
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--fg)",
                  marginTop: 4,
                }}
              >
                {pct(result.elo_accuracy_pct)}
              </div>
              <div className="text-caption" style={{ marginTop: 2 }}>
                Chronological pre-match rating expectation
              </div>
            </div>

            {/* Metric 3: Home Advantage Baseline */}
            <div
              className="card-container"
              style={{
                padding: "var(--space-md) var(--space-lg)",
                background: "#ffffff",
                borderRadius: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="text-micro">ALWAYS-HOME BASELINE</span>
                <span
                  className={`status-pill ${
                    result.accuracy_pct >= result.home_accuracy_pct
                      ? "status-pill--correct"
                      : "status-pill--incorrect"
                  }`}
                  style={{ fontSize: 11 }}
                >
                  {result.accuracy_pct >= result.home_accuracy_pct
                    ? `+${result.accuracy_pct - result.home_accuracy_pct}% vs Home`
                    : `-${result.home_accuracy_pct - result.accuracy_pct}% vs Home`}
                </span>
              </div>
              <div
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  color: "var(--fg)",
                  marginTop: 4,
                }}
              >
                {pct(result.home_accuracy_pct)}
              </div>
              <div className="text-caption" style={{ marginTop: 2 }}>
                Always picking franchise at home venue
              </div>
            </div>
          </div>

          {/* ── Match Ledger Toolbar ─────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-md)",
              marginTop: "var(--space-sm)",
            }}
          >
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button
                type="button"
                onClick={() => setFilterOutcome("all")}
                className={`ds-btn-pill ${filterOutcome === "all" ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                All Matches ({result.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome("correct")}
                className={`ds-btn-pill ${filterOutcome === "correct" ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                Hits ({result.correct})
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome("incorrect")}
                className={`ds-btn-pill ${filterOutcome === "incorrect" ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                Misses ({result.total - result.correct})
              </button>
            </div>

            {/* Search input */}
            <input
              type="search"
              placeholder="Search team or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ds-input"
              style={{
                maxWidth: 240,
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "var(--text-sm)",
                background: "#ffffff",
              }}
            />
          </div>

          {/* ── Matches List ────────────────────────────────────────────── */}
          {filteredGames.length === 0 ? (
            <div
              className="card-container"
              style={{
                padding: "var(--space-xl)",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "18px",
                color: "var(--fg-muted)",
              }}
            >
              <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
                No matches match the active filter criteria.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {filteredGames.map((game, i) => (
                <MatchBacktestCard key={`${game.date}-${game.team_a}-${game.team_b}-${i}`} game={game} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State before running */}
      {!result && !running && !runError && (
        <div
          className="card-container"
          style={{
            padding: "var(--space-xl) var(--space-lg)",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🏏
          </div>
          <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--fg)" }}>
            Select a League & Season to Begin
          </h3>
          <p className="text-caption" style={{ maxWidth: 460, margin: 0 }}>
            Choose from the available historical datasets above and click <strong>Run Backtest</strong> to
            evaluate accuracy and baseline comparisons.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Individual Match Backtest Row Card ───────────────────────────────────────

function MatchBacktestCard({ game }: { game: BacktestGame }) {
  const probA = Math.round(game.prob_team_a * 100);
  const probB = 100 - probA;

  return (
    <div
      className="card-container"
      style={{
        padding: "var(--space-md) var(--space-lg)",
        background: "#ffffff",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
      }}
    >
      {/* Header: Date + Venue + Status Pill */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="text-micro" style={{ color: "var(--fg-muted)" }}>
            {fmtDate(game.date)}
          </span>
          <span style={{ color: "var(--border)" }}>•</span>
          <span className="text-caption" style={{ fontSize: "var(--text-xs)" }}>
            {game.venue}
          </span>
        </div>

        <span
          className={`status-pill ${game.correct ? "status-pill--correct" : "status-pill--incorrect"}`}
          style={{ fontSize: 12, padding: "2px 10px", fontWeight: 700 }}
        >
          {game.correct ? "Hit" : "Miss"}
        </span>
      </div>

      {/* Matchup Teams & Probability Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        {/* Team A */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 160 }}>
          <Crest team={game.team_a} size={30} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: game.actual_winner === game.team_a ? 800 : 500,
                color: "var(--fg)",
              }}
            >
              {game.team_a}
            </span>
            <span className="text-micro" style={{ fontSize: 10 }}>
              {probA}% win prob
            </span>
          </div>
        </div>

        {/* Prediction Vs Result Center Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
            Predicted: <strong style={{ color: "var(--fg)" }}>{game.predicted_winner}</strong>
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
            Winner:{" "}
            <strong
              style={{
                color: game.correct ? "var(--success)" : "var(--wire-red)",
              }}
            >
              {game.actual_winner}
            </strong>
          </div>
        </div>

        {/* Team B */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            flex: 1,
            minWidth: 160,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: game.actual_winner === game.team_b ? 800 : 500,
                color: "var(--fg)",
              }}
            >
              {game.team_b}
            </span>
            <span className="text-micro" style={{ fontSize: 10 }}>
              {probB}% win prob
            </span>
          </div>
          <Crest team={game.team_b} size={30} />
        </div>
      </div>

      {/* Mini Visual Split Probability Bar */}
      <div
        style={{
          width: "100%",
          height: 5,
          borderRadius: 3,
          background: "var(--border)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${probA}%`,
            height: "100%",
            background:
              game.prob_team_a >= 0.5
                ? game.correct
                  ? "var(--success)"
                  : "var(--wire-red)"
                : "var(--border)",
          }}
        />
        <div
          style={{
            width: `${probB}%`,
            height: "100%",
            background:
              game.prob_team_a < 0.5
                ? game.correct
                  ? "var(--success)"
                  : "var(--wire-red)"
                : "var(--border)",
          }}
        />
      </div>
    </div>
  );
}
