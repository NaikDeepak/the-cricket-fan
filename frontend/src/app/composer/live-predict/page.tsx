"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { composerApi, type MatchInput, type LivePredictionResult, type Draft } from "@/lib/composerApi";
import TeamBadge from "@/components/composer/TeamBadge";
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
      showToast("Match scorecard parsed successfully!");
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
      showToast("Live prediction & model probabilities updated!");
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
    showToast("Tweet post copied to clipboard!");
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
      showToast("Saved as draft in Compose feed!");
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
      showToast("Card PNG exported successfully!");
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
      showToast("High-res card image copied to clipboard!");
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
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto pb-16">
      {/* Apple Studio Header Card */}
      <motion.div
        initial={isReduced ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[#18181b] via-[#101014] to-[#09090b] text-white p-8 md:p-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
      >
        {/* Subtle Ambient Light Orbs */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
          style={{ background: themeA.accent }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
          style={{ background: themeB.accent }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold tracking-wider text-zinc-300 uppercase">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
              Press Box Live Studio
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
              Match Predictor & Score Studio
            </h1>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
              Real-time match win probability engine, live DLS target projections, telemetry meters, and 1-click social media card generator.
            </p>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              Quick Match Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="group relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-200 border border-white/10 backdrop-blur-md transition-all"
                >
                  <span>{preset.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/15 text-zinc-300 group-hover:text-white transition-colors">
                    {preset.badge}
                  </span>
                </button>
              ))}
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
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/85 text-white backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.35)] text-sm font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Match Data Ingestion & State (7 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Step 1: Ingestion Glass Card */}
          <div className="ds-glass-card p-6 md:p-7 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold dark:bg-white dark:text-black">
                  1
                </span>
                <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  Import Live Commentary / Scorecard
                </span>
              </div>

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
              <div className="relative">
                <textarea
                  className="w-full ds-input font-mono text-xs md:text-[13px] leading-relaxed resize-y min-h-[110px]"
                  placeholder={`Paste match scorecard or commentary text here, e.g.:\nAntigua & Barbuda Falcons vs St Kitts, Sir Vivian Richards Stadium\nABF 163/4 (20.0 ov)\nInnings Break: St Kitts need 164 runs to win`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="url"
                  className="w-full ds-input text-xs md:text-[13px]"
                  placeholder="https://www.cricbuzz.com/live-cricket-scorecard/154315/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <span className="text-[11px] text-zinc-400 block px-1">
                  Supports Cricbuzz and Cricinfo live scorecard links.
                </span>
              </div>
            )}

            {parseError && (
              <div className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {parseError}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-black/5">
              <button
                type="button"
                onClick={() => {
                  setRawText(`Chennai Super Kings vs Mumbai Indians, Wankhede Stadium\nCSK 192/4 (20.0 ov)\nRuturaj Gaikwad 69 (40), Shivam Dube 55* (28)\nInnings Break: Mumbai Indians need 193 runs in 20.0 overs to win`);
                  showToast("Injected sample match scorecard");
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Insert Sample Text
              </button>

              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark text-xs py-2 px-5"
                onClick={handleParse}
                disabled={parsing || (inputMode === "text" ? !rawText.trim() : !urlInput.trim())}
              >
                {parsing ? "Parsing Scorecard..." : "Extract & Populate Fields"}
              </button>
            </div>
          </div>

          {/* Step 2: Match State & Tactical Adjustment Glass Card */}
          <div className="ds-glass-card p-6 md:p-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold dark:bg-white dark:text-black">
                  2
                </span>
                <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  Match State & Scoreboard
                </span>
              </div>

              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 font-medium text-zinc-600 border border-zinc-200">
                {matchData.league || "T20"}
              </span>
            </div>

            {/* Teams Selector with Swap Button */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: themeA.accent }} />
                  Team A (1st Bat/Ref)
                </label>
                <input
                  className="w-full ds-input font-semibold text-sm"
                  value={matchData.team_a}
                  onChange={(e) => setMatchData({ ...matchData, team_a: e.target.value })}
                />
              </div>

              <button
                type="button"
                title="Swap Teams"
                onClick={() => setMatchData({ ...matchData, team_a: matchData.team_b, team_b: matchData.team_a })}
                className="mt-5 w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 active:scale-90 border border-zinc-200 flex items-center justify-center text-zinc-600 font-bold transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: themeB.accent }} />
                  Team B (Chasing/Opponent)
                </label>
                <input
                  className="w-full ds-input font-semibold text-sm"
                  value={matchData.team_b}
                  onChange={(e) => setMatchData({ ...matchData, team_b: e.target.value })}
                />
              </div>
            </div>

            {/* Venue & League */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  League / Tour
                </label>
                <input
                  className="w-full ds-input text-xs"
                  value={matchData.league || ""}
                  onChange={(e) => setMatchData({ ...matchData, league: e.target.value })}
                  placeholder="e.g. IPL, T20 WC"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Venue & Stadium
                </label>
                <input
                  className="w-full ds-input text-xs"
                  value={matchData.venue || ""}
                  onChange={(e) => setMatchData({ ...matchData, venue: e.target.value })}
                  placeholder="e.g. Wankhede Stadium, Mumbai"
                />
              </div>
            </div>

            {/* Toss Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Toss Winner
                </label>
                <select
                  className="w-full ds-select text-xs"
                  value={matchData.toss_winner || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_winner: e.target.value || null })}
                >
                  <option value="">-- Unspecified Toss --</option>
                  {matchData.team_a && <option value={matchData.team_a}>{matchData.team_a}</option>}
                  {matchData.team_b && <option value={matchData.team_b}>{matchData.team_b}</option>}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Toss Decision
                </label>
                <select
                  className="w-full ds-select text-xs"
                  value={matchData.toss_decision || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_decision: (e.target.value as "bat" | "field") || null })}
                >
                  <option value="">-- Decision --</option>
                  <option value="bat">Elected to Bat First</option>
                  <option value="field">Elected to Field / Bowl First</option>
                </select>
              </div>
            </div>

            {/* Match Phase Sliding Pill */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Match Phase
              </label>
              <SegmentedControl<MatchInput["phase"]>
                name="match-phase"
                size="md"
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

            {/* 1st Innings Tactile Scorecard Dial */}
            {matchData.phase !== "pre_match" && (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <TeamBadge team={matchData.innings1_team || matchData.team_a} />
                    1st Innings: {matchData.innings1_team || matchData.team_a}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    CRR: <strong className="text-zinc-800">{matchTelemetry.i1Crr}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Runs</label>
                    <input
                      type="number"
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings1_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_runs: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Wickets</label>
                    <input
                      type="number"
                      max={10}
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings1_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Overs (Max 20)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings1_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="20.0"
                    />
                  </div>
                </div>

                {/* Quick Score Increments */}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400 mr-1">Quick:</span>
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
                      onClick={() => handleScoreDelta(1, btn.r, btn.w, btn.o)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-700 active:scale-95 transition-all shadow-xs"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2nd Innings / Live Chase Scorecard Dial */}
            {(matchData.phase === "chase_in_progress" || matchData.phase === "completed") && (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <TeamBadge team={matchData.innings2_team || matchData.team_b} />
                    2nd Innings (Chase): {matchData.innings2_team || matchData.team_b}
                  </span>
                  <div className="flex items-center gap-2">
                    {matchTelemetry.target && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                        Target: {matchTelemetry.target}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Current Runs</label>
                    <input
                      type="number"
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings2_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_runs: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Wickets Down</label>
                    <input
                      type="number"
                      max={10}
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings2_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-zinc-400">Overs Bowled</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full ds-input text-center text-base font-bold"
                      value={matchData.innings2_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="0.0"
                    />
                  </div>
                </div>

                {/* Chase Telemetry Strip */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white border border-zinc-200/60 text-center">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Req Runs / Balls</span>
                    <span className="text-xs font-bold text-zinc-800">
                      {matchTelemetry.runsNeeded ?? "--"} / {matchTelemetry.ballsRemaining}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Current RR</span>
                    <span className="text-xs font-bold text-zinc-800">{matchTelemetry.i2Crr}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Required RR</span>
                    <span className={`text-xs font-bold ${Number(matchTelemetry.rrr ?? 0) > 10 ? "text-red-600" : "text-emerald-600"}`}>
                      {matchTelemetry.rrr ?? "--"}
                    </span>
                  </div>
                </div>

                {/* Quick Increment Buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400 mr-1">Quick:</span>
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
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white hover:bg-zinc-200 border border-zinc-200 text-zinc-700 active:scale-95 transition-all shadow-xs"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {predictionError && (
              <div className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                {predictionError}
              </div>
            )}

            {/* Run Prediction Button with Apple Glow */}
            <button
              type="button"
              className="w-full relative overflow-hidden py-3.5 px-6 rounded-full font-bold text-sm text-white shadow-[0_8px_24px_rgba(232,67,46,0.35)] hover:shadow-[0_12px_32px_rgba(232,67,46,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #e8432e 0%, #c22f1c 100%)",
              }}
              onClick={handlePredict}
              disabled={predicting}
            >
              {predicting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Computing Live Win Probability...</span>
                </>
              ) : (
                <>
                  <span>⚡ Run Live Prediction & Generate Post</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Prediction Results & Apple Studio Stage (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Win Probability & Model Factors Glass Card */}
          <div className="ds-glass-card p-6 md:p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Win Probability Engine
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200/80">
                {matchData.phase === "innings_break"
                  ? "MID-INNINGS"
                  : matchData.phase === "chase_in_progress"
                  ? "LIVE CHASE"
                  : matchData.phase === "completed"
                  ? "FINAL RESULT"
                  : "PRE-MATCH"}
              </span>
            </div>

            {/* Probability Progress Stage with Dynamic Team Colors */}
            <div className="space-y-3 p-4 rounded-2xl bg-zinc-50/80 border border-black/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TeamBadge team={matchData.team_a} />
                  <div>
                    <span className="font-bold text-sm text-zinc-900 block">{matchData.team_a}</span>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase">1st Bat / Ref</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black tracking-tight" style={{ color: themeA.accent }}>
                    {pctA}%
                  </span>
                </div>
              </div>

              {/* Dynamic Gradient Bar */}
              <div className="h-4 rounded-full overflow-hidden flex bg-zinc-200 shadow-inner p-0.5 border border-black/5">
                <motion.div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pctA}%`,
                    background: themeA.gradient,
                    boxShadow: `0 0 12px ${themeA.glow}`,
                  }}
                  initial={false}
                  animate={{ width: `${pctA}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                />
                <motion.div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pctB}%`,
                    background: themeB.gradient,
                    boxShadow: `0 0 12px ${themeB.glow}`,
                  }}
                  initial={false}
                  animate={{ width: `${pctB}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TeamBadge team={matchData.team_b} />
                  <div>
                    <span className="font-bold text-sm text-zinc-900 block">{matchData.team_b}</span>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase">Chasing / Opponent</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black tracking-tight" style={{ color: themeB.accent }}>
                    {pctB}%
                  </span>
                </div>
              </div>
            </div>

            {/* Projected Score & Context Badge */}
            {result?.score_projection && (
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
                  📊
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                    Model Score Projection & Context
                  </span>
                  <p className="text-xs md:text-sm font-semibold text-blue-950 mt-0.5">
                    {(result.score_projection.projection_text as string) ||
                      (result.score_projection.projected_text as string) ||
                      "Standard 20-over match projection calculated."}
                  </p>
                </div>
              </div>
            )}

            {/* Model Decision Drivers */}
            {result?.reasons && result.reasons.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Model Decision Drivers (SHAP + Live Adjustments)
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {result.reasons.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs font-medium text-zinc-800"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tweet Post Studio Glass Card */}
          <div className="ds-glass-card p-6 md:p-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Generated Tweet Copy
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  (result?.tweet_text?.length || 0) <= 280
                    ? "bg-zinc-100 text-zinc-600"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {result?.tweet_text?.length || 0} / 280
              </span>
            </div>

            <textarea
              className="w-full ds-input font-sans text-xs md:text-[13px] leading-relaxed resize-y min-h-[90px]"
              value={result?.tweet_text || "Click 'Run Live Prediction' above to generate formatted post copy..."}
              onChange={(e) => setResult(result ? { ...result, tweet_text: e.target.value } : null)}
            />

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1 border-t border-black/5">
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-light text-xs py-2 px-4"
                onClick={handleCopyTweet}
                disabled={!result?.tweet_text}
              >
                📋 Copy Tweet
              </button>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark text-xs py-2 px-4"
                onClick={handleSaveDraft}
                disabled={!result}
              >
                💾 Save as Draft
              </button>
            </div>
          </div>

          {/* Social Media Card Export Canvas Glass Card */}
          <div className="ds-glass-card p-6 md:p-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Social Media Card Canvas
              </span>

              <SegmentedControl<AspectRatio>
                name="card-aspect"
                size="sm"
                value={aspect}
                onChange={setAspect}
                options={[
                  { id: "1:1", label: "1:1 Square" },
                  { id: "16:9", label: "16:9" },
                  { id: "4:5", label: "4:5 Story" },
                ]}
              />
            </div>

            {/* Apple Spatial Stage Canvas */}
            <div className="relative w-full rounded-2xl bg-zinc-950 p-4 md:p-6 overflow-hidden flex items-center justify-center border border-zinc-800 shadow-inner min-h-[300px]">
              <div
                className="transition-all duration-300 flex items-center justify-center"
                style={{
                  transform: aspect === "16:9" ? "scale(0.35)" : aspect === "4:5" ? "scale(0.26)" : "scale(0.31)",
                  transformOrigin: "center center",
                  margin: aspect === "16:9" ? "-180px 0" : aspect === "4:5" ? "-440px 0" : "-330px 0",
                }}
              >
                <div ref={captureRef} className="shadow-2xl rounded-2xl overflow-hidden">
                  <PredictionCardImg draft={previewDraft} aspect={aspect} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1 border-t border-black/5">
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-light text-xs py-2 px-4"
                onClick={handleCopyCardImage}
                disabled={cardBusy}
              >
                {cardBusy ? "Processing..." : "🖼️ Copy Image"}
              </button>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark text-xs py-2 px-4"
                onClick={handleDownloadCard}
                disabled={cardBusy}
              >
                {cardBusy ? "Exporting..." : "⬇️ Download PNG"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
