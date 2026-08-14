"use client";

import { useRef, useState } from "react";
import { composerApi, type MatchInput, type LivePredictionResult, type Draft } from "@/lib/composerApi";
import TeamBadge from "@/components/composer/TeamBadge";
import PredictionCardImg from "@/components/composer/cards/PredictionCardImg";
import { captureCard, copyImageToClipboard, downloadCard } from "@/lib/share";

type InputMode = "text" | "url";
type AspectRatio = "1:1" | "16:9" | "4:5";

const DEFAULT_MATCH: MatchInput = {
  team_a: "Chennai Super Kings",
  team_b: "Mumbai Indians",
  league: "IPL",
  venue: "Wankhede Stadium, Mumbai",
  toss_winner: null,
  toss_decision: null,
  phase: "pre_match",
  innings1_team: null,
  innings1_runs: null,
  innings1_wickets: null,
  innings1_overs: null,
  innings2_team: null,
  innings2_runs: null,
  innings2_wickets: null,
  innings2_overs: null,
};

export default function LivePredictPage() {
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
  const [toast, setToast] = useState<string | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

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
      showToast("Match data parsed successfully!");
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
      showToast("Prediction updated!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to run prediction";
      setPredictionError(msg);
    } finally {
      setPredicting(false);
    }
  }

  async function handleCopyTweet() {
    if (!result?.tweet_text) return;
    await navigator.clipboard.writeText(result.tweet_text);
    showToast("Tweet text copied to clipboard!");
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
      showToast("Card image downloaded!");
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
      showToast("Card image copied to clipboard!");
    } catch {
      showToast("Failed to copy image to clipboard.");
    } finally {
      setCardBusy(false);
    }
  }

  // Synthesize a draft object for PredictionCardImg
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header Banner */}
      <div
        className="ds-spatial-card-dark"
        style={{
          borderRadius: 20,
          padding: "var(--space-xl)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <span className="text-micro" style={{ color: "var(--wire-red)", fontWeight: 700, letterSpacing: 2 }}>
            LIVE STUDIO
          </span>
          <h1 className="text-tool-headline" style={{ margin: "4px 0 8px 0", fontSize: "var(--text-3xl)" }}>
            Match Predictor & Score Studio
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "var(--text-base)" }}>
            Paste match commentary from Cricinfo / Cricbuzz or enter live scorecard data to generate mid-innings win probabilities, score projections, and social posts.
          </p>
        </div>
      </div>

      {toast && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--floodlight-cyan)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {toast}
        </div>
      )}

      {/* 2-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "var(--space-xl)" }}>
        {/* Left Column: Match Data Ingestion & State */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Step 1: Ingestion Card */}
          <div className="card-container" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <span className="text-micro" style={{ color: "var(--muted)", fontWeight: 700 }}>
                STEP 1: IMPORT MATCH DATA
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setInputMode("text")}
                  className={`ds-btn-pill ${inputMode === "text" ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                  style={{ fontSize: 11, padding: "4px 12px" }}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("url")}
                  className={`ds-btn-pill ${inputMode === "url" ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                  style={{ fontSize: 11, padding: "4px 12px" }}
                >
                  Cricbuzz / Cricinfo URL
                </button>
              </div>
            </div>

            {inputMode === "text" ? (
              <div>
                <textarea
                  className="ds-input"
                  rows={4}
                  placeholder={`Paste match scorecard or commentary excerpt here, e.g.:\nAntigua & Barbuda Falcons vs St Kitts, Sir Vivian Richards Stadium\nABF 163/4 (20.0 ov)\nInnings Break: St Kitts need 164 runs to win`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
                />
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  className="ds-input"
                  placeholder="https://www.cricbuzz.com/live-cricket-scorecard/154315/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>
            )}

            {parseError && (
              <p style={{ color: "var(--wire-red)", fontSize: 12, margin: "8px 0 0 0" }}>
                {parseError}
              </p>
            )}

            <div style={{ marginTop: "var(--space-md)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark"
                onClick={handleParse}
                disabled={parsing || (inputMode === "text" ? !rawText.trim() : !urlInput.trim())}
                style={{ opacity: parsing ? 0.6 : 1, fontSize: 13, padding: "8px 18px" }}
              >
                {parsing ? "Parsing..." : "Extract & Populate Fields"}
              </button>
            </div>
          </div>

          {/* Step 2: Review & Adjust Match State Form */}
          <div className="card-container" style={{ padding: "var(--space-lg)" }}>
            <span className="text-micro" style={{ color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: "var(--space-md)" }}>
              STEP 2: MATCH STATE & DETAILS
            </span>

            {/* Teams Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", marginBottom: "var(--space-md)" }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Team A (First)</label>
                <input
                  className="ds-input"
                  value={matchData.team_a}
                  onChange={(e) => setMatchData({ ...matchData, team_a: e.target.value })}
                  style={{ width: "100%", fontWeight: 600 }}
                />
              </div>
              <button
                type="button"
                title="Swap Teams"
                onClick={() => setMatchData({ ...matchData, team_a: matchData.team_b, team_b: matchData.team_a })}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--muted)",
                  padding: "6px 8px",
                  cursor: "pointer",
                  marginTop: 18,
                }}
              >
                ⇄
              </button>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Team B</label>
                <input
                  className="ds-input"
                  value={matchData.team_b}
                  onChange={(e) => setMatchData({ ...matchData, team_b: e.target.value })}
                  style={{ width: "100%", fontWeight: 600 }}
                />
              </div>
            </div>

            {/* League & Venue */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: "var(--space-md)" }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>League / Tour</label>
                <input
                  className="ds-input"
                  value={matchData.league || ""}
                  onChange={(e) => setMatchData({ ...matchData, league: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Venue</label>
                <input
                  className="ds-input"
                  value={matchData.venue || ""}
                  onChange={(e) => setMatchData({ ...matchData, venue: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Toss */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "var(--space-md)" }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Toss Winner</label>
                <select
                  className="ds-select"
                  value={matchData.toss_winner || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_winner: e.target.value || null })}
                  style={{ width: "100%" }}
                >
                  <option value="">-- No Toss Info --</option>
                  {matchData.team_a && <option value={matchData.team_a}>{matchData.team_a}</option>}
                  {matchData.team_b && <option value={matchData.team_b}>{matchData.team_b}</option>}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Toss Decision</label>
                <select
                  className="ds-select"
                  value={matchData.toss_decision || ""}
                  onChange={(e) => setMatchData({ ...matchData, toss_decision: (e.target.value as "bat" | "field") || null })}
                  style={{ width: "100%" }}
                >
                  <option value="">-- Unspecified --</option>
                  <option value="bat">Elected to Bat</option>
                  <option value="field">Elected to Field / Bowl</option>
                </select>
              </div>
            </div>

            {/* Match Phase Picker */}
            <div style={{ marginBottom: "var(--space-md)" }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Match Phase</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { id: "pre_match", label: "Pre-Match" },
                  { id: "innings_break", label: "Innings Break" },
                  { id: "chase_in_progress", label: "Live Chase" },
                  { id: "completed", label: "Completed" },
                ].map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => setMatchData({ ...matchData, phase: ph.id as MatchInput["phase"] })}
                    className={`ds-btn-pill ${matchData.phase === ph.id ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                    style={{
                      fontSize: 11,
                      padding: "6px 8px",
                      textAlign: "center",
                      border: matchData.phase === ph.id ? "1px solid var(--wire-red)" : "1px solid var(--border)",
                    }}
                  >
                    {ph.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Innings 1 Scorecard Inputs */}
            {matchData.phase !== "pre_match" && (
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginBottom: "var(--space-md)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", display: "block", marginBottom: 8 }}>
                  1st Innings Score
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Batting Team</label>
                    <input
                      className="ds-input"
                      value={matchData.innings1_team || matchData.team_a}
                      onChange={(e) => setMatchData({ ...matchData, innings1_team: e.target.value })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Runs</label>
                    <input
                      type="number"
                      className="ds-input"
                      value={matchData.innings1_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_runs: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Wickets</label>
                    <input
                      type="number"
                      max={10}
                      className="ds-input"
                      value={matchData.innings1_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Overs</label>
                    <input
                      type="number"
                      step="0.1"
                      className="ds-input"
                      value={matchData.innings1_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings1_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Innings 2 Scorecard Inputs (For chase or completed) */}
            {(matchData.phase === "chase_in_progress" || matchData.phase === "completed") && (
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginBottom: "var(--space-md)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", display: "block", marginBottom: 8 }}>
                  2nd Innings Score (Chasing)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Batting Team</label>
                    <input
                      className="ds-input"
                      value={matchData.innings2_team || matchData.team_b}
                      onChange={(e) => setMatchData({ ...matchData, innings2_team: e.target.value })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Runs</label>
                    <input
                      type="number"
                      className="ds-input"
                      value={matchData.innings2_runs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_runs: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Wickets</label>
                    <input
                      type="number"
                      max={10}
                      className="ds-input"
                      value={matchData.innings2_wickets ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_wickets: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--muted)" }}>Overs</label>
                    <input
                      type="number"
                      step="0.1"
                      className="ds-input"
                      value={matchData.innings2_overs ?? ""}
                      onChange={(e) => setMatchData({ ...matchData, innings2_overs: e.target.value ? parseFloat(e.target.value) : null })}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {predictionError && (
              <p style={{ color: "var(--wire-red)", fontSize: 12, margin: "8px 0" }}>
                {predictionError}
              </p>
            )}

            <button
              type="button"
              className="ds-btn-pill"
              onClick={handlePredict}
              disabled={predicting}
              style={{
                width: "100%",
                background: "var(--wire-red)",
                color: "#ffffff",
                padding: "12px 20px",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 0 16px rgba(232, 67, 46, 0.4)",
                cursor: "pointer",
              }}
            >
              {predicting ? "Calculating Prediction..." : "Run Live Prediction & Generate Post"}
            </button>
          </div>
        </div>

        {/* Right Column: Prediction Results, Tweet & Card Studio */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* Win Probability & Projection Summary Card */}
          <div className="card-container" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <span className="text-micro" style={{ color: "var(--muted)", fontWeight: 700 }}>
                WIN PROBABILITY ENGINE
              </span>
              <span
                className="ds-chip"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--floodlight-cyan)",
                  fontSize: 11,
                }}
              >
                {matchData.phase === "innings_break"
                  ? "INNINGS BREAK"
                  : matchData.phase === "chase_in_progress"
                  ? "LIVE CHASE"
                  : matchData.phase === "completed"
                  ? "FINAL"
                  : "PRE-MATCH"}
              </span>
            </div>

            {/* Probability Bars */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamBadge team={matchData.team_a} />
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>{matchData.team_a}</span>
              </div>
              <span style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: pctA >= pctB ? "#38bdf8" : "var(--fg)" }}>
                {pctA}%
              </span>
            </div>

            <div
              style={{
                display: "flex",
                height: 10,
                borderRadius: 5,
                overflow: "hidden",
                background: "var(--border)",
                marginBottom: 6,
              }}
            >
              <div style={{ width: `${pctA}%`, background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)", transition: "width 0.4s ease" }} />
              <div style={{ width: `${pctB}%`, background: "linear-gradient(90deg, #e11d48 0%, #fb7185 100%)", transition: "width 0.4s ease" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamBadge team={matchData.team_b} />
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>{matchData.team_b}</span>
              </div>
              <span style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: pctB > pctA ? "#fb7185" : "var(--fg)" }}>
                {pctB}%
              </span>
            </div>

            {/* Score Projection / Target details */}
            {result?.score_projection && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12, marginBottom: "var(--space-md)" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Match Projection & Context
                </span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--floodlight-cyan)" }}>
                  {(result.score_projection.projection_text as string) || (result.score_projection.projected_text as string) || "Standard 20-over match projection"}
                </p>
              </div>
            )}

            {/* Key Drivers / Reasons */}
            {result?.reasons && result.reasons.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Model Decision Drivers
                </span>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                  {result.reasons.map((r, idx) => (
                    <li key={idx} style={{ fontSize: 12, color: "var(--fg)" }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tweet Box Card */}
          <div className="card-container" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
              <span className="text-micro" style={{ color: "var(--muted)", fontWeight: 700 }}>
                GENERATED TWEET COPY (NO EMOJIS)
              </span>
              <span style={{ fontSize: 12, color: (result?.tweet_text?.length || 0) <= 280 ? "var(--muted)" : "var(--wire-red)" }}>
                {result?.tweet_text?.length || 0} / 280 chars
              </span>
            </div>

            <textarea
              className="ds-input"
              rows={4}
              value={result?.tweet_text || "Click 'Run Live Prediction' above to generate post copy..."}
              onChange={(e) => setResult(result ? { ...result, tweet_text: e.target.value } : null)}
              style={{ width: "100%", fontSize: 13, resize: "vertical", marginBottom: "var(--space-md)" }}
            />

            <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-light"
                onClick={handleCopyTweet}
                disabled={!result?.tweet_text}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                Copy Tweet
              </button>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark"
                onClick={handleSaveDraft}
                disabled={!result}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                Save as Draft in Compose
              </button>
            </div>
          </div>

          {/* Social Card Preview & Export */}
          <div className="card-container" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <span className="text-micro" style={{ color: "var(--muted)", fontWeight: 700 }}>
                SOCIAL MEDIA CARD EXPORT
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["1:1", "16:9", "4:5"] as AspectRatio[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAspect(a)}
                    className={`ds-btn-pill ${aspect === a ? "ds-btn-pill-dark" : "ds-btn-pill-light"}`}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Scaled Preview Box */}
            <div
              style={{
                width: "100%",
                background: "#000000",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <div
                style={{
                  transform: "scale(0.32)",
                  transformOrigin: "center center",
                  margin: aspect === "16:9" ? "-220px 0" : aspect === "4:5" ? "-440px 0" : "-350px 0",
                }}
              >
                <div ref={captureRef}>
                  <PredictionCardImg draft={previewDraft} aspect={aspect} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end", marginTop: "var(--space-md)" }}>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-light"
                onClick={handleCopyCardImage}
                disabled={cardBusy}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                {cardBusy ? "Processing..." : "Copy Image"}
              </button>
              <button
                type="button"
                className="ds-btn-pill ds-btn-pill-dark"
                onClick={handleDownloadCard}
                disabled={cardBusy}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                {cardBusy ? "Exporting..." : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
