"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { composerApi, type MatchInput, type LivePredictionResult, type Draft } from "@/lib/composerApi";
import TeamBadge from "@/components/common/TeamBadge";
import PredictionCardImg from "@/components/composer/cards/PredictionCardImg";
import SegmentedControl from "@/components/composer/SegmentedControl";
import { getTeamTheme } from "@/lib/teamColors";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";
import { prefersReducedMotion } from "@/lib/motion";

type InputMode = "text" | "url";
type AspectRatio = "1:1" | "16:9" | "4:5";

interface MatchPreset {
  id: string;
  name: string;
  badge: string;
  data: MatchInput;
}

const PRESETS: MatchPreset[] = [
  {
    id: "csk-mi",
    name: "CSK vs MI",
    badge: "IPL Classic",
    data: {
      team_a: "Chennai Super Kings",
      team_b: "Mumbai Indians",
      league: "IPL",
      venue: "Wankhede Stadium, Mumbai",
      toss_winner: "Mumbai Indians",
      toss_decision: "field",
      phase: "innings_break",
      innings1_team: "Chennai Super Kings",
      innings1_runs: 188,
      innings1_wickets: 4,
      innings1_overs: 20.0,
      innings2_team: "Mumbai Indians",
      innings2_runs: null,
      innings2_wickets: null,
      innings2_overs: null,
    },
  },
  {
    id: "rcb-kkr",
    name: "RCB vs KKR",
    badge: "Live Chase",
    data: {
      team_a: "Royal Challengers Bangalore",
      team_b: "Kolkata Knight Riders",
      league: "IPL",
      venue: "M Chinnaswamy Stadium, Bengaluru",
      toss_winner: "Kolkata Knight Riders",
      toss_decision: "field",
      phase: "chase_in_progress",
      innings1_team: "Royal Challengers Bangalore",
      innings1_runs: 204,
      innings1_wickets: 6,
      innings1_overs: 20.0,
      innings2_team: "Kolkata Knight Riders",
      innings2_runs: 142,
      innings2_wickets: 3,
      innings2_overs: 13.4,
    },
  },
  {
    id: "ind-aus",
    name: "IND vs AUS",
    badge: "T20 World Cup",
    data: {
      team_a: "India",
      team_b: "Australia",
      league: "T20 World Cup",
      venue: "Melbourne Cricket Ground, Melbourne",
      toss_winner: "India",
      toss_decision: "bat",
      phase: "pre_match",
      innings1_team: null,
      innings1_runs: null,
      innings1_wickets: null,
      innings1_overs: null,
      innings2_team: null,
      innings2_runs: null,
      innings2_wickets: null,
      innings2_overs: null,
    },
  },
  {
    id: "gt-rr",
    name: "GT vs RR",
    badge: "Finals Rematch",
    data: {
      team_a: "Gujarat Titans",
      team_b: "Rajasthan Royals",
      league: "IPL",
      venue: "Narendra Modi Stadium, Ahmedabad",
      toss_winner: "Gujarat Titans",
      toss_decision: "bat",
      phase: "innings_break",
      innings1_team: "Gujarat Titans",
      innings1_runs: 177,
      innings1_wickets: 7,
      innings1_overs: 20.0,
      innings2_team: "Rajasthan Royals",
      innings2_runs: null,
      innings2_wickets: null,
      innings2_overs: null,
    },
  },
];

const DEFAULT_MATCH: MatchInput = {
  team_a: "Chennai Super Kings",
  team_b: "Mumbai Indians",
  league: "IPL",
  venue: "Wankhede Stadium, Mumbai",
  toss_winner: "Mumbai Indians",
  toss_decision: "field",
  phase: "pre_match",
  innings1_team: "Chennai Super Kings",
  innings1_runs: 182,
  innings1_wickets: 5,
  innings1_overs: 20.0,
  innings2_team: "Mumbai Indians",
  innings2_runs: null,
  innings2_wickets: null,
  innings2_overs: null,
};

export default function LivePredictPage() {
  const isReduced = prefersReducedMotion();
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [rawText, setRawText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [matchData, setMatchData] = useState<MatchInput>(DEFAULT_MATCH);
  const [predicting, setPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [result, setResult] = useState<LivePredictionResult | null>(null);

  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [cardBusy, setCardBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: "success" | "info" } | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  function showToast(message: string, type: "success" | "info" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }

  // Color themes for both teams
  const themeA = useMemo(() => getTeamTheme(matchData.team_a), [matchData.team_a]);
  const themeB = useMemo(() => getTeamTheme(matchData.team_b), [matchData.team_b]);

  // Compute live match metrics (CRR, RRR, Target)
  const matchTelemetry = useMemo(() => {
    const i1Runs = matchData.innings1_runs ?? 0;
    const i1Overs = matchData.innings1_overs ?? 20;
    const i1Crr = i1Overs > 0 ? (i1Runs / i1Overs).toFixed(2) : "--";

    const target = i1Runs > 0 ? i1Runs + 1 : null;
    const i2Runs = matchData.innings2_runs ?? 0;
    const i2Wkts = matchData.innings2_wickets ?? 0;
    const i2Overs = matchData.innings2_overs ?? 0;

    // Convert overs (e.g. 13.4) to balls
    const completedOvers = Math.floor(i2Overs);
    const fractionalBalls = Math.round((i2Overs - completedOvers) * 10);
    const ballsBowled = completedOvers * 6 + fractionalBalls;
    const ballsRemaining = Math.max(0, 120 - ballsBowled);
    const oversRemaining = (ballsRemaining / 6).toFixed(1);

    const runsNeeded = target !== null ? Math.max(0, target - i2Runs) : null;
    const rrr =
      ballsRemaining > 0 && runsNeeded !== null
        ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
        : null;

    const i2Crr = ballsBowled > 0 ? ((i2Runs / ballsBowled) * 6).toFixed(2) : "--";

    return {
      target,
      i1Crr,
      i2Crr,
      runsNeeded,
      ballsRemaining,
      oversRemaining,
      rrr,
      wicketsLeft: 10 - i2Wkts,
    };
  }, [matchData]);

  async function handleParse() {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = await composerApi.parseLiveMatch(
        inputMode === "url" ? { url: urlInput } : { raw_text: rawText }
      );
      setMatchData((prev) => ({
        ...prev,
        ...parsed,
        league: parsed.league || prev.league || "T20",
      }));
      showToast("Match scorecard parsed successfully");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to parse match data";
      setParseError(msg);
    } finally {
      setParsing(false);
    }
  }

  async function handlePredict() {
    if (!matchData.team_a || !matchData.team_b) {
      setPredictionError("Please enter both Team A and Team B.");
      return;
    }
    setPredicting(true);
    setPredictionError(null);
    try {
      const res = await composerApi.runLivePrediction(matchData);
      setResult(res);
      showToast("Live prediction updated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to run prediction";
      setPredictionError(msg);
    } finally {
      setPredicting(false);
    }
  }

  function applyPreset(p: MatchPreset) {
    setMatchData(p.data);
    setResult(null);
    showToast(`Loaded preset: ${p.name}`);
  }

  function handleScoreDelta(innings: 1 | 2, runDelta: number, wktDelta = 0, overDelta = 0) {
    setMatchData((prev) => {
      if (innings === 1) {
        const runs = Math.max(0, (prev.innings1_runs ?? 0) + runDelta);
        const wkts = Math.min(10, Math.max(0, (prev.innings1_wickets ?? 0) + wktDelta));
        const overs = Math.min(20, Math.max(0, Number(((prev.innings1_overs ?? 0) + overDelta).toFixed(1))));
        return { ...prev, innings1_runs: runs, innings1_wickets: wkts, innings1_overs: overs };
      } else {
        const runs = Math.max(0, (prev.innings2_runs ?? 0) + runDelta);
        const wkts = Math.min(10, Math.max(0, (prev.innings2_wickets ?? 0) + wktDelta));
        const overs = Math.min(20, Math.max(0, Number(((prev.innings2_overs ?? 0) + overDelta).toFixed(1))));
        return { ...prev, innings2_runs: runs, innings2_wickets: wkts, innings2_overs: overs };
      }
    });
  }

  async function handleCopyTweet() {
    if (!result?.tweet_text) return;
    await navigator.clipboard.writeText(result.tweet_text);
    showToast("Post text copied to clipboard");
  }

  async function handleSaveDraft() {
    if (!result) return;
    try {
      await composerApi.createDraft({
        source: "bot",
        category: "prediction",
        text: result.tweet_text,
        card_type: "prediction",
        card_meta: result.card_meta,
      });
      showToast("Saved as draft in Compose queue");
    } catch {
      showToast("Failed to save draft.");
    }
  }

  async function handleDownloadCard() {
    if (!captureRef.current) return;
    setCardBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await downloadCard(blob, `prediction-${matchData.team_a}-vs-${matchData.team_b}.png`);
      showToast("Card PNG exported successfully");
    } catch {
      showToast("Failed to download image.");
    } finally {
      setCardBusy(false);
    }
  }

  async function handleCopyCardImage() {
    if (!captureRef.current) return;
    setCardBusy(true);
    try {
      const blob = await captureCard(captureRef.current);
      await copyImageToClipboard(blob);
      showToast("Card image copied to clipboard");
    } catch {
      showToast("Failed to copy image to clipboard.");
    } finally {
      setCardBusy(false);
    }
  }

  const previewDraft: Draft = {
    id: 9999,
    source: "bot",
    category: "prediction",
    text: result?.tweet_text || `${matchData.team_a} vs ${matchData.team_b} Match Prediction`,
    card_type: "prediction",
    card_meta: result
      ? result.card_meta
      : {
          team_a: matchData.team_a,
          team_b: matchData.team_b,
          prob_a: 0.5,
          phase: matchData.phase,
          league: matchData.league,
          venue: matchData.venue,
        },
    status: "draft",
    created_at: new Date().toISOString(),
    posted_at: null,
    content_key: null,
  };

  const pctA = result ? Math.round(result.prob_team_a * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Header Banner */}
      <motion.div
        initial={isReduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="ds-card"
        style={{
          padding: "24px 28px",
          background: "#09090b",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: "var(--space-xs)" }}>
                <span className="ds-badge" style={{ background: "rgba(255, 255, 255, 0.12)", color: "#ffffff" }}>
                  Live Studio
                </span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "var(--space-xs) 0", color: "#ffffff", letterSpacing: "-0.02em" }}>
                Live Match Predictor &amp; Score Studio
              </h1>
              <p style={{ color: "#a1a1aa", fontSize: 13, margin: 0, maxWidth: 640 }}>
                Real-time win probability engine, live chase telemetry, and 1-click social media card generator.
              </p>
            </div>

            {/* Quick Presets Bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="text-micro" style={{ color: "#71717a" }}>
                Match Presets
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="ds-btn ds-btn-secondary"
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#ffffff",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <span>{preset.name}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      {preset.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Apple Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="ds-card"
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 1000,
              padding: "10px 18px",
              background: "#000000",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              width: "auto",
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio 2-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--space-lg)", alignItems: "start" }}>
        {/* Left Column: Match Data Ingestion & State */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {/* Step 1: Ingestion Card */}
          <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-micro">1. Ingest Scorecard / Commentary</span>
              <SegmentedControl<InputMode>
                name="input-mode"
                size="sm"
                value={inputMode}
                onChange={setInputMode}
                options={[
                  { id: "text", label: "Paste Text" },
                  { id: "url", label: "Live URL" },
                ]}
              />
            </div>

            {inputMode === "text" ? (
              <textarea
                className="ds-input"
                style={{ fontSize: 12, lineHeight: 1.45, minHeight: 90, fontFamily: "monospace" }}
                placeholder={`Paste match scorecard or commentary text here, e.g.:\nCSK vs MI, Wankhede Stadium\nCSK 188/4 (20.0 ov)\nInnings Break: MI need 189 runs to win`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            ) : (
              <input
                type="url"
                className="ds-input"
                style={{ fontSize: 13 }}
                placeholder="https://www.cricbuzz.com/live-cricket-scorecard/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            )}

            {parseError && (
              <div
                className="ds-card"
                style={{
                  padding: "8px 12px",
                  background: "var(--error-tint)",
                  borderColor: "rgba(239, 68, 68, 0.2)",
                  color: "var(--error-text)",
                  fontSize: 12,
                }}
              >
                {parseError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => {
                  setRawText(`Chennai Super Kings vs Mumbai Indians, Wankhede Stadium\nCSK 192/4 (20.0 ov)\nInnings Break: Mumbai Indians need 193 runs to win`);
                  showToast("Sample text loaded");
                }}
                className="ds-btn ds-btn-ghost"
                style={{ fontSize: 12, padding: "4px 8px" }}
              >
                Sample Text
              </button>

              <button
                type="button"
                className="ds-btn ds-btn-primary"
                onClick={handleParse}
                disabled={parsing || (inputMode === "text" ? !rawText.trim() : !urlInput.trim())}
                style={{ fontSize: 12 }}
              >
                {parsing ? "Parsing…" : "Extract & Populate Fields"}
              </button>
            </div>
          </div>

          {/* Step 2: Match State & Scoreboard */}
          <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-micro">2. Match State &amp; Scoreboard</span>
              <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                {matchData.league || "T20"}
              </span>
            </div>

            {/* Teams Selector with Swap Button */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>
                  Team A (1st Bat)
                </label>
                <input
                  className="ds-input"
                  style={{ width: "100%", fontWeight: 600, fontSize: 13, marginTop: 2 }}
                  value={matchData.team_a}
                  onChange={(e) => setMatchData({ ...matchData, team_a: e.target.value })}
                />
              </div>

              <button
                type="button"
                title="Swap Teams"
                onClick={() => setMatchData({ ...matchData, team_a: matchData.team_b, team_b: matchData.team_a })}
                className="ds-btn ds-btn-secondary"
                style={{ marginTop: 16, padding: "6px 8px" }}
              >
                ⇄
              </button>

              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>
                  Team B (Chasing)
                </label>
                <input
                  className="ds-input"
                  style={{ width: "100%", fontWeight: 600, fontSize: 13, marginTop: 2 }}
                  value={matchData.team_b}
                  onChange={(e) => setMatchData({ ...matchData, team_b: e.target.value })}
                />
              </div>
            </div>

            {/* Venue & League */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>League</label>
                <input
                  className="ds-input"
                  style={{ width: "100%", fontSize: 12, marginTop: 2 }}
                  value={matchData.league || ""}
                  onChange={(e) => setMatchData({ ...matchData, league: e.target.value })}
                  placeholder="e.g. IPL"
                />
              </div>
              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>Venue</label>
                <input
                  className="ds-input"
                  style={{ width: "100%", fontSize: 12, marginTop: 2 }}
                  value={matchData.venue || ""}
                  onChange={(e) => setMatchData({ ...matchData, venue: e.target.value })}
                  placeholder="Wankhede Stadium, Mumbai"
                />
              </div>
            </div>

            {/* Toss Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>Toss Winner</label>
                <select
                  className="ds-select"
                  style={{ width: "100%", fontSize: 12, marginTop: 2 }}
                  value={matchData.toss_winner || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_winner: e.target.value || null })}
                >
                  <option value="">-- Toss Winner --</option>
                  {matchData.team_a && <option value={matchData.team_a}>{matchData.team_a}</option>}
                  {matchData.team_b && <option value={matchData.team_b}>{matchData.team_b}</option>}
                </select>
              </div>

              <div>
                <label className="text-micro" style={{ margin: 0, display: "block" }}>Toss Decision</label>
                <select
                  className="ds-select"
                  style={{ width: "100%", fontSize: 12, marginTop: 2 }}
                  value={matchData.toss_decision || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_decision: (e.target.value as "bat" | "field") || null })}
                >
                  <option value="">-- Decision --</option>
                  <option value="bat">Elected to Bat</option>
                  <option value="field">Elected to Bowl</option>
                </select>
              </div>
            </div>

            {/* Match Phase */}
            <div>
              <label className="text-micro" style={{ margin: "0 0 6px 0", display: "block" }}>Match Phase</label>
              <SegmentedControl<MatchInput["phase"]>
                name="match-phase"
                size="sm"
                className="w-full justify-between"
                value={matchData.phase}
                onChange={(p) => setMatchData({ ...matchData, phase: p })}
                options={[
                  { id: "pre_match", label: "Pre-Match" },
                  { id: "innings_break", label: "Innings Break" },
                  { id: "chase_in_progress", label: "Live Chase" },
                  { id: "completed", label: "Completed" },
                ]}
              />
            </div>

            {/* 1st Innings Scorecard */}
            {matchData.phase !== "pre_match" && (
              <div className="ds-card" style={{ background: "var(--surface-tertiary)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)" }}>
                    1st Innings: {matchData.innings1_team || matchData.team_a}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                    CRR: {matchTelemetry.i1Crr}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Runs</label>
                    <input
                      type="number"
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings1_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_runs: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Wickets</label>
                    <input
                      type="number"
                      max={10}
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings1_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Overs</label>
                    <input
                      type="number"
                      step="0.1"
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings1_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="20.0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2nd Innings Scorecard */}
            {matchData.phase === "chase_in_progress" && (
              <div className="ds-card" style={{ background: "var(--surface-tertiary)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)" }}>
                    2nd Innings (Chase): {matchData.innings2_team || matchData.team_b}
                  </span>
                  {matchTelemetry.target && (
                    <span className="ds-badge ds-badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
                      Target: {matchTelemetry.target}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Runs</label>
                    <input
                      type="number"
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings2_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_runs: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Wickets</label>
                    <input
                      type="number"
                      max={10}
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings2_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-micro" style={{ margin: 0 }}>Overs</label>
                    <input
                      type="number"
                      step="0.1"
                      className="ds-input"
                      style={{ width: "100%", textAlign: "center", fontSize: 14, fontWeight: 700, marginTop: 2 }}
                      value={matchData.innings2_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="0.0"
                    />
                  </div>
                </div>

                {/* Telemetry Strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "8px", background: "#ffffff", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                  <div>
                    <span className="text-micro" style={{ fontSize: 10 }}>Need / Balls</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "block" }}>
                      {matchTelemetry.runsNeeded ?? "--"} / {matchTelemetry.ballsRemaining}
                    </span>
                  </div>
                  <div>
                    <span className="text-micro" style={{ fontSize: 10 }}>Current RR</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "block" }}>
                      {matchTelemetry.i2Crr}
                    </span>
                  </div>
                  <div>
                    <span className="text-micro" style={{ fontSize: 10 }}>Req RR</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", display: "block", color: Number(matchTelemetry.rrr ?? 0) > 10 ? "var(--error-text)" : "var(--success-text)" }}>
                      {matchTelemetry.rrr ?? "--"}
                    </span>
                  </div>
                </div>

                {/* Quick Dials */}
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)", marginRight: 4 }}>Quick:</span>
                  {[
                    { label: "+1", r: 1, w: 0, o: 0 },
                    { label: "+4", r: 4, w: 0, o: 0 },
                    { label: "+6", r: 6, w: 0, o: 0 },
                    { label: "+W", r: 0, w: 1, o: 0 },
                    { label: "+1 Ov", r: 0, w: 0, o: 1.0 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleScoreDelta(2, btn.r, btn.w, btn.o)}
                      className="ds-btn ds-btn-secondary"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {predictionError && (
              <div
                className="ds-card"
                style={{
                  padding: "8px 12px",
                  background: "var(--error-tint)",
                  borderColor: "rgba(239, 68, 68, 0.2)",
                  color: "var(--error-text)",
                  fontSize: 12,
                }}
              >
                {predictionError}
              </div>
            )}

            <button
              type="button"
              className="ds-btn ds-btn-primary"
              style={{ width: "100%", padding: "12px 18px", fontSize: 14 }}
              onClick={handlePredict}
              disabled={predicting}
            >
              {predicting ? "Computing Probabilities…" : "Run Live Prediction"}
            </button>
          </div>
        </div>

        {/* Right Column: Prediction Results & Stage */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {/* Win Probability & Model Drivers */}
          <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-micro">Win Probability</span>
              <span className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                {matchData.phase === "innings_break"
                  ? "Mid-Innings"
                  : matchData.phase === "chase_in_progress"
                  ? "Live Chase"
                  : matchData.phase === "completed"
                  ? "Final Result"
                  : "Pre-Match"}
              </span>
            </div>

            {/* Probability Progress Stage */}
            <div style={{ padding: "14px 16px", background: "var(--surface-tertiary)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TeamBadge team={matchData.team_a} size={20} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{matchData.team_a}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: themeA.accent, fontVariantNumeric: "tabular-nums" }}>
                  {pctA}%
                </span>
              </div>

              {/* Gradient Track */}
              <div className="prob-track" style={{ height: 8 }}>
                <div className="prob-fill" style={{ width: `${pctA}%`, background: themeA.primary }} />
                <div className="prob-fill" style={{ width: `${pctB}%`, background: themeB.primary }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TeamBadge team={matchData.team_b} size={20} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{matchData.team_b}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: themeB.accent, fontVariantNumeric: "tabular-nums" }}>
                  {pctB}%
                </span>
              </div>
            </div>

            {/* Projected Score & Context Badge */}
            {result?.score_projection && (
              <div style={{ padding: "10px 14px", background: "var(--surface-tertiary)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="text-micro">Score Projection</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                  {(result.score_projection.projection_text as string) ||
                    (result.score_projection.projected_text as string) ||
                    "Standard 20-over match projection calculated."}
                </p>
              </div>
            )}

            {/* Decision Drivers */}
            {result?.reasons && result.reasons.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="text-micro">Decision Drivers</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.reasons.map((r, idx) => (
                    <span key={idx} className="ds-badge" style={{ background: "var(--surface-tertiary)", color: "var(--fg-secondary)" }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tweet Post Studio */}
          <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-micro">Generated Post Copy</span>
              <span style={{ fontSize: 11, color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                {result?.tweet_text?.length || 0} / 280
              </span>
            </div>

            <textarea
              className="ds-input"
              style={{ fontSize: 13, lineHeight: 1.45, minHeight: 80 }}
              value={result?.tweet_text || "Click 'Run Live Prediction' to generate post copy…"}
              onChange={(e) => setResult(result ? { ...result, tweet_text: e.target.value } : null)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={handleCopyTweet}
                disabled={!result?.tweet_text}
                style={{ fontSize: 12 }}
              >
                Copy Text
              </button>
              <button
                type="button"
                className="ds-btn ds-btn-primary"
                onClick={handleSaveDraft}
                disabled={!result}
                style={{ fontSize: 12 }}
              >
                Save as Draft
              </button>
            </div>
          </div>

          {/* Social Media Card Export Canvas */}
          <div className="ds-card" style={{ padding: "18px 20px", background: "#ffffff", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-micro">Social Card Output</span>
              <div className="ds-segmented-control">
                {(["1:1", "16:9", "4:5"] as AspectRatio[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAspect(a)}
                    className={`ds-segmented-item ${aspect === a ? "ds-segmented-item--active" : ""}`}
                    style={{ fontSize: 11, padding: "3px 8px" }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage Canvas */}
            <div
              style={{
                background: "#09090b",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-md)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                minHeight: 280,
              }}
            >
              <div
                style={{
                  transform: aspect === "16:9" ? "scale(0.32)" : aspect === "4:5" ? "scale(0.26)" : "scale(0.3)",
                  transformOrigin: "center center",
                  margin: aspect === "16:9" ? "-160px 0" : aspect === "4:5" ? "-380px 0" : "-280px 0",
                }}
              >
                <div ref={captureRef}>
                  <PredictionCardImg draft={previewDraft} aspect={aspect} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={handleCopyCardImage}
                disabled={cardBusy}
                style={{ fontSize: 12 }}
              >
                {cardBusy ? "Processing…" : "Copy Image"}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn-primary"
                onClick={handleDownloadCard}
                disabled={cardBusy}
                style={{ fontSize: 12 }}
              >
                {cardBusy ? "Exporting…" : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
