"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  composerApi,
  type BacktestGame,
  type BacktestOptions,
  type BacktestResult,
  type Draft,
} from "@/lib/composerApi";
import { getTeamTheme } from "@/lib/teamColors";
import { teamInitials, teamLogoPath } from "@/lib/teamLogo";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import PredictionCardImg from "@/components/composer/cards/PredictionCardImg";

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

function Crest({ team, size = 24 }: { team: string; size?: number }) {
  const logo = teamLogoPath(team);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="team-crest" style={{ width: size, height: size, borderRadius: 4 }} />;
  }
  const theme = getTeamTheme(team);
  return (
    <span
      className="team-crest-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
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
      <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
        <svg
          width="96"
          height="96"
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
            stroke="#000000"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
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
              color: "var(--fg)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {accuracyPct}%
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--fg-muted)",
              marginTop: 2,
              letterSpacing: "0.02em",
            }}
          >
            ACCURACY
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Backtest Performance
        </span>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)" }}>
          {correct} of {total} Matches Correct
        </div>
        <p className="text-caption" style={{ margin: 0, fontSize: 13 }}>
          Evaluated strictly chronologically with point-in-time ELO & rolling form without lookahead leakage.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function BacktestStudioPage() {
  const router = useRouter();

  // State
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
  const [sharingGame, setSharingGame] = useState<BacktestGame | null>(null);

  // 1. Fetch available backtest options on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchOpts() {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const data = await composerApi.backtestOptions();
        if (cancelled) return;
        setOptions(data);

        // Auto-select first available league & its latest season
        if (data.leagues.length > 0) {
          const defaultLg = data.leagues.includes("IPL") ? "IPL" : data.leagues[0];
          setSelectedLeague(defaultLg);
          const seasons = data.seasons_by_league[defaultLg] || [];
          if (seasons.length > 0) {
            setSelectedSeason(seasons[0]);
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setOptionsError(err instanceof Error ? err.message : "Failed to load backtest options");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }
    fetchOpts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update selected season when league changes
  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    if (options && options.seasons_by_league[league]) {
      const seasons = options.seasons_by_league[league];
      setSelectedSeason(seasons.length > 0 ? seasons[0] : "");
    } else {
      setSelectedSeason("");
    }
    setResult(null);
  };

  // 2. Trigger backtest simulation
  const handleRunBacktest = useCallback(async () => {
    if (!selectedLeague || !selectedSeason) return;
    setRunning(true);
    setRunError(null);
    setResult(null);

    try {
      const res = await composerApi.runBacktest(selectedLeague, selectedSeason);
      setResult(res);
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : "Backtest run failed");
    } finally {
      setRunning(false);
    }
  }, [selectedLeague, selectedSeason]);

  // 3. Filtered games list
  const filteredGames = useMemo(() => {
    if (!result) return [];
    return result.games.filter((g) => {
      if (filterOutcome === "correct" && !g.correct) return false;
      if (filterOutcome === "incorrect" && g.correct) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesTeamA = g.team_a.toLowerCase().includes(q);
        const matchesTeamB = g.team_b.toLowerCase().includes(q);
        const matchesVenue = g.venue.toLowerCase().includes(q);
        if (!matchesTeamA && !matchesTeamB && !matchesVenue) return false;
      }
      return true;
    });
  }, [result, filterOutcome, searchTerm]);

  // 4. Open in Press Box Studio Composer handler
  const handleOpenComposer = useCallback(
    async (game: BacktestGame) => {
      const probA = Math.round(game.prob_team_a * 100);
      const probB = 100 - probA;
      const isUpcoming = game.status === "upcoming" || game.actual_winner === null || game.actual_winner === undefined;

      const draftPayload = {
        source: "bot" as const,
        category: "prediction",
        card_type: "prediction" as const,
        text: `${result?.league || selectedLeague}: ${game.team_a} (${probA}%) vs ${game.team_b} (${probB}%)\nVenue: ${game.venue}\nModel Pick: ${game.predicted_winner} (${Math.max(probA, probB)}% win prob)\n\n#Cricket #TheCricketFan #${game.team_a.replace(/[^a-zA-Z0-9]/g, "")} #${game.team_b.replace(/[^a-zA-Z0-9]/g, "")}`,
        card_meta: {
          team_a: game.team_a,
          team_b: game.team_b,
          prob_a: game.prob_team_a,
          venue: game.venue,
          league: result?.league || selectedLeague,
          phase: isUpcoming ? "pre_match" : "completed",
          score_summary: isUpcoming ? "Match Scheduled" : `Winner: ${game.actual_winner}`,
          reasons: ["Form Advantage", "Venue Conditions", "Matchup Metrics"],
          predicted_winner: game.predicted_winner,
          date: game.date,
        },
      };

      try {
        const created = await composerApi.createDraft(draftPayload);
        router.push(`/composer?draft_id=${created.id}`);
      } catch {
        sessionStorage.setItem("tcf_handoff_draft", JSON.stringify(draftPayload));
        router.push("/composer");
      }
    },
    [result?.league, selectedLeague, router]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
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
          <span className="text-micro">Historical Simulation</span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "4px 0 0 0",
              color: "var(--fg)",
            }}
          >
            Model Backtest Engine
          </h1>
          <p className="text-caption" style={{ margin: "4px 0 0 0", maxWidth: 640 }}>
            Benchmark committed model artifacts against real match outcomes across 28 domestic & international leagues with zero lookahead leakage.
          </p>
        </div>

        {/* Ingestion Telemetry Live Card */}
        {options && (
          <div
            className="ds-card"
            style={{
              padding: "10px 14px",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 240,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="ds-badge ds-badge-success">INGESTION STORE READY</span>
              <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                {options.total_matches.toLocaleString()} matches
              </span>
            </div>
            {options.last_match && (
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                Last: {options.last_match.team_a} vs {options.last_match.team_b}
              </div>
            )}
            {options.earliest_date && options.latest_date && (
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                Coverage: {options.earliest_date.split("-")[0]} – {options.latest_date.split("-")[0]} across 28 leagues
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Selection Control Bar ───────────────────────────────────────── */}
      <div
        className="ds-card"
        style={{
          padding: "var(--space-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          background: "#ffffff",
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
              className="ds-select"
              style={{ minWidth: 180 }}
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
              className="ds-select"
              style={{ minWidth: 140 }}
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
            className="ds-btn ds-btn-primary"
            style={{
              padding: "9px 20px",
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? `Simulating ${selectedLeague} ${selectedSeason}...` : "Run Backtest"}
          </button>
        </div>
      </div>

      {/* ── Error Notices ───────────────────────────────────────────────── */}
      {optionsError && (
        <div
          className="ds-card"
          style={{
            padding: "var(--space-md)",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
          }}
        >
          <strong>Options Error:</strong> {optionsError}
        </div>
      )}

      {runError && (
        <div
          className="ds-card"
          style={{
            padding: "var(--space-md)",
            background: "var(--error-tint)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error-text)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="ds-badge ds-badge-danger">BACKTEST EXECUTION FAILED</span>
          <p style={{ margin: "4px 0 0 0", fontSize: "var(--text-sm)" }}>{runError}</p>
        </div>
      )}

      {/* ── Backtest Results Section ────────────────────────────────────── */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Summary Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {/* Accuracy Ring Hero Card */}
            <div
              className="ds-card"
              style={{
                gridColumn: "1 / -1",
                background: "#ffffff",
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
              className="ds-card"
              style={{
                padding: "var(--space-md)",
                background: "#ffffff",
              }}
            >
              <span className="text-micro">LightGBM Model</span>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
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
              className="ds-card"
              style={{
                padding: "var(--space-md)",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="text-micro">ELO Baseline</span>
                <span
                  className="ds-badge"
                  style={{
                    color: result.accuracy_pct >= result.elo_accuracy_pct ? "var(--success-text)" : "var(--warning-text)",
                    background: result.accuracy_pct >= result.elo_accuracy_pct ? "var(--success-tint)" : "var(--warning-tint)",
                  }}
                >
                  {result.accuracy_pct >= result.elo_accuracy_pct
                    ? `+${result.accuracy_pct - result.elo_accuracy_pct}% vs Elo`
                    : `${result.accuracy_pct - result.elo_accuracy_pct}% vs Elo`}
                </span>
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pct(result.elo_accuracy_pct)}
              </div>
              <div className="text-caption" style={{ marginTop: 2 }}>
                Naive rating benchmark
              </div>
            </div>

            {/* Metric 3: Home Advantage Baseline */}
            <div
              className="ds-card"
              style={{
                padding: "var(--space-md)",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="text-micro">Home Advantage</span>
                <span
                  className="ds-badge"
                  style={{
                    color: result.accuracy_pct >= result.home_accuracy_pct ? "var(--success-text)" : "var(--warning-text)",
                    background: result.accuracy_pct >= result.home_accuracy_pct ? "var(--success-tint)" : "var(--warning-tint)",
                  }}
                >
                  {result.accuracy_pct >= result.home_accuracy_pct
                    ? `+${result.accuracy_pct - result.home_accuracy_pct}% vs Home`
                    : `${result.accuracy_pct - result.home_accuracy_pct}% vs Home`}
                </span>
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pct(result.home_accuracy_pct)}
              </div>
              <div className="text-caption" style={{ marginTop: 2 }}>
                Home team win rate
              </div>
            </div>
          </div>

          {/* ── Match Feed Filters & Search Bar ─────────────────────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-md)",
              paddingTop: "var(--space-xs)",
            }}
          >
            {/* Segmented Filter Control */}
            <div className="ds-segmented-control">
              <button
                type="button"
                onClick={() => setFilterOutcome("all")}
                className={`ds-segmented-item ${filterOutcome === "all" ? "ds-segmented-item--active" : ""}`}
              >
                All Matches ({result.games.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome("correct")}
                className={`ds-segmented-item ${filterOutcome === "correct" ? "ds-segmented-item--active" : ""}`}
              >
                Hits ({result.correct})
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome("incorrect")}
                className={`ds-segmented-item ${filterOutcome === "incorrect" ? "ds-segmented-item--active" : ""}`}
              >
                Misses ({result.total - result.correct})
              </button>
            </div>

            {/* Search input */}
            <input
              type="search"
              placeholder="Search team or venue…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ds-input"
              style={{ maxWidth: 220, padding: "6px 12px", fontSize: 13 }}
            />
          </div>

          {/* ── Upcoming Fixtures / Future Predictions ─────────────────── */}
          {result.upcoming_games && result.upcoming_games.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="ds-badge" style={{ background: "rgba(0, 113, 227, 0.1)", color: "var(--apple-blue)" }}>
                  UPCOMING FIXTURES &amp; MODEL PREDICTIONS ({result.upcoming_games.length})
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {result.upcoming_games.map((game, i) => (
                  <MatchBacktestCard
                    key={`upcoming-${game.date}-${game.team_a}-${game.team_b}-${i}`}
                    game={game}
                    onShare={(g) => setSharingGame(g)}
                    onCompose={handleOpenComposer}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Matches List ────────────────────────────────────────────── */}
          {filteredGames.length === 0 ? (
            <div
              className="ds-card"
              style={{
                padding: "var(--space-xl)",
                textAlign: "center",
                background: "#ffffff",
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
                <MatchBacktestCard
                  key={`${game.date}-${game.team_a}-${game.team_b}-${i}`}
                  game={game}
                  onShare={(g) => setSharingGame(g)}
                  onCompose={handleOpenComposer}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State before running */}
      {!result && !running && !runError && (
        <div
          className="ds-card"
          style={{
            padding: "var(--space-xl) var(--space-lg)",
            textAlign: "center",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--fg)" }}>
            Select a League &amp; Season
          </h3>
          <p className="text-caption" style={{ maxWidth: 460, margin: 0 }}>
            Choose from the 28 available competition archives above and click <strong>Run Backtest</strong> to
            evaluate model accuracy against historical outcomes.
          </p>
        </div>
      )}

      {/* Quick Share Modal */}
      {sharingGame && (
        <QuickShareModal
          game={sharingGame}
          league={result?.league || selectedLeague}
          onClose={() => setSharingGame(null)}
          onOpenComposer={handleOpenComposer}
        />
      )}
    </div>
  );
}

// ─── Individual Match Backtest Row Card ───────────────────────────────────────

function MatchBacktestCard({
  game,
  onShare,
  onCompose,
}: {
  game: BacktestGame;
  onShare: (game: BacktestGame) => void;
  onCompose: (game: BacktestGame) => void;
}) {
  const probA = Math.round(game.prob_team_a * 100);
  const probB = 100 - probA;
  const isUpcoming = game.status === "upcoming" || game.actual_winner === null || game.actual_winner === undefined;

  return (
    <div
      className="ds-card"
      style={{
        padding: "14px 18px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: isUpcoming ? "1px solid rgba(0, 113, 227, 0.3)" : "1px solid var(--border)",
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
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(game.date)}
          </span>
          <span style={{ color: "var(--border)" }}>•</span>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {game.venue}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isUpcoming ? (
            <span className="ds-badge" style={{ background: "rgba(0, 113, 227, 0.1)", color: "var(--apple-blue)" }}>
              Upcoming
            </span>
          ) : (
            <span className={`ds-badge ${game.correct ? "ds-badge-success" : "ds-badge-danger"}`}>
              {game.correct ? "Hit" : "Miss"}
            </span>
          )}
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 140 }}>
          <Crest team={game.team_a} size={24} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: game.actual_winner === game.team_a || (!game.actual_winner && game.predicted_winner === game.team_a) ? 700 : 500,
                color: "var(--fg)",
              }}
            >
              {game.team_a}
            </span>
            <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
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
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            Pick: <strong style={{ color: "var(--fg)" }}>{game.predicted_winner}</strong>
          </div>
          {isUpcoming ? (
            <div style={{ fontSize: 11, color: "var(--apple-blue)", fontWeight: 500 }}>
              Scheduled
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
              Winner:{" "}
              <strong
                style={{
                  color: game.correct ? "var(--success-text)" : "var(--error-text)",
                }}
              >
                {game.actual_winner}
              </strong>
            </div>
          )}
        </div>

        {/* Team B */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flex: 1,
            minWidth: 140,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: game.actual_winner === game.team_b ? 700 : 500,
                color: "var(--fg)",
              }}
            >
              {game.team_b}
            </span>
            <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
              {probB}% win prob
            </span>
          </div>
          <Crest team={game.team_b} size={24} />
        </div>
      </div>

      {/* Mini Visual Split Probability Bar */}
      <div
        style={{
          width: "100%",
          height: 3,
          borderRadius: 2,
          background: "var(--surface-tertiary)",
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
                  : "var(--error)"
                : "var(--border-strong)",
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
                  : "var(--error)"
                : "var(--border-strong)",
          }}
        />
      </div>

      {/* Social Card & Composer Shortcut Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginTop: 2,
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => onShare(game)}
          className="ds-btn ds-btn-secondary"
          style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 4,
          }}
        >
          Share Card (X / Insta)
        </button>

        <button
          type="button"
          onClick={() => onCompose(game)}
          className="ds-btn ds-btn-primary"
          style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 4,
          }}
        >
          Open in Studio Composer
        </button>
      </div>
    </div>
  );
}

// ─── Quick Share & Social Export Modal ────────────────────────────────────────

function QuickShareModal({
  game,
  league,
  onClose,
  onOpenComposer,
}: {
  game: BacktestGame;
  league: string;
  onClose: () => void;
  onOpenComposer: (game: BacktestGame) => void;
}) {
  const [aspect, setAspect] = useState<"1:1" | "16:9" | "4:5">("1:1");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const probA = Math.round(game.prob_team_a * 100);
  const probB = 100 - probA;
  const isUpcoming = game.status === "upcoming" || game.actual_winner === null || game.actual_winner === undefined;

  const mockDraft: Draft = {
    id: 999999,
    source: "bot",
    category: "prediction",
    card_type: "prediction",
    status: "draft",
    created_at: new Date().toISOString(),
    posted_at: null,
    content_key: null,
    text: `${league || "Cricket"}: ${game.team_a} (${probA}%) vs ${game.team_b} (${probB}%)\nVenue: ${game.venue}\nModel Pick: ${game.predicted_winner} (${Math.max(probA, probB)}% win prob)\n\n#Cricket #TheCricketFan #${game.team_a.replace(/[^a-zA-Z0-9]/g, "")} #${game.team_b.replace(/[^a-zA-Z0-9]/g, "")}`,
    card_meta: {
      team_a: game.team_a,
      team_b: game.team_b,
      prob_a: game.prob_team_a,
      venue: game.venue,
      league: league,
      phase: isUpcoming ? "pre_match" : "completed",
      score_summary: isUpcoming ? "Match Scheduled" : `Winner: ${game.actual_winner}`,
      reasons: ["Form Advantage", "Venue Conditions", "Matchup Metrics"],
      predicted_winner: game.predicted_winner,
      date: game.date,
    },
  };

  async function handleCopyImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await copyImageToClipboard(blob);
      setFeedback("Copied to clipboard");
    } catch {
      setFeedback("Copy failed. Use download.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  async function handleDownloadImage() {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      const filename = `${game.team_a.toLowerCase().replace(/\s+/g, "_")}_vs_${game.team_b.toLowerCase().replace(/\s+/g, "_")}_prediction.png`;
      await downloadCard(blob, filename);
      setFeedback("Card downloaded");
    } catch {
      setFeedback("Failed to download image.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 2500);
    }
  }

  function handleShareX() {
    const text = encodeURIComponent(mockDraft.text);
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(mockDraft.text);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
      }}
      onClick={onClose}
    >
      <div
        className="ds-card"
        style={{
          background: "#111114",
          borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "92vh",
          overflowY: "auto",
          color: "#ffffff",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="ds-badge" style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff" }}>
                SHAREABLE MATCH CARD
              </span>
              {isUpcoming && (
                <span className="ds-badge" style={{ background: "rgba(0, 113, 227, 0.2)", color: "var(--apple-blue)" }}>
                  Upcoming
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: "6px 0 0 0", color: "#ffffff" }}>
              {game.team_a} vs {game.team_b}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#ffffff",
              width: 28,
              height: 28,
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="ds-segmented-control" style={{ background: "rgba(255, 255, 255, 0.08)" }}>
          <button
            type="button"
            onClick={() => setAspect("1:1")}
            className={`ds-segmented-item ${aspect === "1:1" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "1:1" ? "#000000" : "#d4d4d8" }}
          >
            1:1 Square
          </button>
          <button
            type="button"
            onClick={() => setAspect("16:9")}
            className={`ds-segmented-item ${aspect === "16:9" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "16:9" ? "#000000" : "#d4d4d8" }}
          >
            16:9 Landscape
          </button>
          <button
            type="button"
            onClick={() => setAspect("4:5")}
            className={`ds-segmented-item ${aspect === "4:5" ? "ds-segmented-item--active" : ""}`}
            style={{ color: aspect === "4:5" ? "#000000" : "#d4d4d8" }}
          >
            4:5 Portrait
          </button>
        </div>

        {/* Live Card Preview Box */}
        <div
          style={{
            background: "#000000",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            minHeight: 320,
          }}
        >
          <div
            style={{
              transform: aspect === "16:9" ? "scale(0.42)" : aspect === "4:5" ? "scale(0.32)" : "scale(0.38)",
              transformOrigin: "center center",
              margin: aspect === "16:9" ? "-180px 0" : aspect === "4:5" ? "-440px 0" : "-320px 0",
            }}
          >
            <div ref={captureRef}>
              <PredictionCardImg draft={mockDraft} aspect={aspect} />
            </div>
          </div>
        </div>

        {feedback && (
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(52, 199, 89, 0.15)",
              color: "var(--success)",
              fontSize: 13,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            {feedback}
          </div>
        )}

        {/* Action Toolbar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={handleCopyImage}
            className="ds-btn ds-btn-secondary"
            style={{
              fontSize: 12,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            Copy PNG to Clipboard
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleDownloadImage}
            className="ds-btn ds-btn-secondary"
            style={{
              fontSize: 12,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            Download PNG File
          </button>

          <button
            type="button"
            onClick={handleShareX}
            className="ds-btn"
            style={{
              fontSize: 12,
              background: "#000000",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            Share to X / Twitter
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="ds-btn"
            style={{
              fontSize: 12,
              background: "#25D366",
              color: "#ffffff",
            }}
          >
            Share to WhatsApp
          </button>
        </div>

        {/* Open in Composer button */}
        <button
          type="button"
          onClick={() => onOpenComposer(game)}
          className="ds-btn ds-btn-primary"
          style={{
            fontSize: 13,
            padding: "10px",
            background: "#ffffff",
            color: "#000000",
            border: "none",
            marginTop: 4,
          }}
        >
          Open in Studio Composer
        </button>
      </div>
    </div>
  );
}
