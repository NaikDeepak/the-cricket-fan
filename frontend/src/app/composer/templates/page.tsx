"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BattleCardImg from "@/components/composer/cards/BattleCardImg";
import MilestoneCardImg from "@/components/composer/cards/MilestoneCardImg";
import PredictionCardImg from "@/components/composer/cards/PredictionCardImg";
import QuoteCardImg from "@/components/composer/cards/QuoteCardImg";
import RecordCardImg from "@/components/composer/cards/RecordCardImg";
import TriviaCardImg from "@/components/composer/cards/TriviaCardImg";
import WireCardImg from "@/components/composer/cards/WireCardImg";
import { composerApi, type Draft, type TeamRecord } from "@/lib/composerApi";
import {
  generateThemeFromHex,
  listAllTeams,
  listLeagues,
  type TeamColorTheme,
  type TeamInfo,
} from "@/lib/teamColors";

type TemplateType =
  | "battle"
  | "milestone"
  | "quote"
  | "wire"
  | "prediction"
  | "trivia"
  | "record";

const TEMPLATES: Array<{
  id: TemplateType;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: "battle",
    name: "Head-to-Head Battle",
    badge: "⚔️ MATCHUPS",
    desc: "Player vs player duel (Batter vs Bowler) with dual split team lighting & head-to-head stats.",
  },
  {
    id: "milestone",
    name: "Milestone Hero",
    badge: "🔥 HERO PERFORMANCE",
    desc: "Giant stat callouts for centuries, 5-fers, match winners, and boundary breakdowns.",
  },
  {
    id: "quote",
    name: "Press Box Quote",
    badge: "🎙️ STATEMENTS",
    desc: "High-impact editorial card with stylized quotation marks, speaker role & team branding.",
  },
  {
    id: "wire",
    name: "Breaking Flash Wire",
    badge: "⚡ FLASH NEWS",
    desc: "Urgent red wire bulletin with flashing indicator, bullet points, and press desk source.",
  },
  {
    id: "prediction",
    name: "Match Prediction",
    badge: "📊 PROBABILITIES",
    desc: "Win probabilities with dual team color bars, match phase, and tactical reasons.",
  },
  {
    id: "trivia",
    name: "Cricket Trivia Quiz",
    badge: "❓ DAILY QUIZ",
    desc: "Interactive question and 4-option quiz layout themed with team colors.",
  },
  {
    id: "record",
    name: "Stat & Anecdote",
    badge: "📖 CLASSIC RECORD",
    desc: "Clean narrative card with large record stat callout and editorial story copy.",
  },
];

export default function TemplatesStudioPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("battle");
  const [selectedLeague, setSelectedLeague] = useState<string>("All");
  const [selectedTeamName, setSelectedTeamName] = useState<string>("Lyca Kovai Kings");
  const [customPrimary, setCustomPrimary] = useState<string>("#e8432e");
  const [customSecondary, setCustomSecondary] = useState<string>("#ff6b57");
  const [aspect, setAspect] = useState<"1:1" | "16:9" | "4:5">("1:1");
  const [creating, setCreating] = useState(false);

  // DB teams state
  const [dbTeams, setDbTeams] = useState<TeamRecord[]>([]);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamShort, setNewTeamShort] = useState("");
  const [newTeamLeague, setNewTeamLeague] = useState("TNPL");
  const [newTeamPrimary, setNewTeamPrimary] = useState("#00FFCC");
  const [newTeamSecondary, setNewTeamSecondary] = useState("#003366");
  const [saveTeamStatus, setSaveTeamStatus] = useState<string | null>(null);

  useEffect(() => {
    composerApi
      .teams()
      .then((records) => setDbTeams(records))
      .catch(() => {
        // Fallback to local definitions
      });
  }, []);

  const allTeams: TeamInfo[] = useMemo(() => {
    if (dbTeams.length > 0) {
      return dbTeams.map((t) => ({
        name: t.name,
        short: t.short_name,
        league: t.league,
        theme: {
          primary: t.primary_color,
          secondary: t.secondary_color,
          accent: t.accent_color || t.primary_color,
          gradient:
            t.gradient ||
            `linear-gradient(135deg, ${t.primary_color} 0%, ${t.secondary_color} 100%)`,
          glow: t.glow || "rgba(255, 255, 255, 0.4)",
          textDark: t.text_dark,
        },
      }));
    }
    return listAllTeams();
  }, [dbTeams]);

  const leagues = useMemo(() => {
    const set = new Set(["All", ...listLeagues()]);
    allTeams.forEach((t) => set.add(t.league));
    return [...Array.from(set), "Custom"];
  }, [allTeams]);

  const filteredTeams = useMemo(() => {
    if (selectedLeague === "All" || selectedLeague === "Custom") return allTeams;
    return allTeams.filter((t) => t.league === selectedLeague);
  }, [selectedLeague, allTeams]);

  const activeTheme: TeamColorTheme = useMemo(() => {
    if (selectedLeague === "Custom") {
      return generateThemeFromHex(customPrimary, customSecondary);
    }
    const found = allTeams.find((t) => t.name === selectedTeamName);
    return (
      found?.theme || {
        primary: "#e8432e",
        secondary: "#ff6b57",
        gradient: "linear-gradient(135deg, #e8432e 0%, #ff6b57 100%)",
        accent: "#e8432e",
        glow: "rgba(232, 67, 46, 0.4)",
      }
    );
  }, [selectedLeague, selectedTeamName, customPrimary, customSecondary, allTeams]);

  const sampleDraft: Draft = useMemo(() => {
    return {
      id: 999,
      source: "freeform",
      category: selectedLeague !== "Custom" ? selectedLeague : "STUDIO",
      text:
        selectedTemplate === "battle"
          ? "Kohli has scored at a strike rate of 146.1 against Bumrah in T20s while only falling 4 times in 78 deliveries."
          : selectedTemplate === "milestone"
          ? "Sai Sudharsan anchored Kovai Kings with a blistering 82* off 45 balls, scoring 42 runs in the death overs."
          : selectedTemplate === "quote"
          ? "We don't play for records, we play for the brand of cricket that puts smiles on millions of Indian fans."
          : selectedTemplate === "wire"
          ? "Lyca Kovai Kings seal a thrilling 4-wicket victory in the final over to advance into the TNPL 2026 Finals."
          : selectedTemplate === "prediction"
          ? "Model favors Chennai Super Kings with high batting depth and pitch turn at Chepauk."
          : selectedTemplate === "trivia"
          ? "Who holds the record for the highest individual score in TNPL history?"
          : "Rohit Sharma's 264 remains the highest individual ODI score in cricket history.",
      card_type: selectedTemplate,
      card_meta: {
        headline:
          selectedTemplate === "wire"
            ? "LKK CLINCH THRILLER TO ENTER FINALS"
            : selectedTemplate === "milestone"
            ? "82* (45)"
            : "RECORD CHASE",
        stat: "82* (45)",
        player: "Sai Sudharsan",
        player_1: "Virat Kohli",
        player_2: "Jasprit Bumrah",
        team_1: "Royal Challengers Bengaluru",
        team_2: "Mumbai Indians",
        team: selectedTeamName,
        team_a: "Chennai Super Kings",
        team_b: "Mumbai Indians",
        prob_a: 0.58,
        speaker: "Rohit Sharma",
        role: "Captain",
        context: "Post-Match Press Conference",
        tag: "MATCH HERO",
        league: selectedLeague !== "All" && selectedLeague !== "Custom" ? selectedLeague : "T20",
        team_theme: activeTheme,
        team_1_theme: activeTheme,
        options: [
          "Sai Sudharsan (103*)",
          "N Jagadeesan (105*)",
          "Baba Aparajith (118*)",
          "Dinesh Karthik (97)",
        ],
        bullets: [
          "Target of 178 chased down with 2 balls to spare",
          "Sai Sudharsan top-scored with 82* off 45 deliveries",
          "Final match scheduled for this Sunday at MA Chidambaram Stadium",
        ],
      },
      status: "draft",
      created_at: new Date().toISOString(),
      posted_at: null,
      content_key: null,
    };
  }, [selectedTemplate, selectedLeague, selectedTeamName, activeTheme]);

  async function handleCreateWithThisTemplate() {
    setCreating(true);
    try {
      const created = await composerApi.createDraft({
        source: "freeform",
        category: selectedLeague !== "Custom" ? selectedLeague : "STUDIO",
        text: sampleDraft.text,
        card_type: selectedTemplate,
        card_meta: sampleDraft.card_meta,
      });
      router.push(`/composer?draft=${created.id}`);
    } catch {
      alert("Could not reach API. Please verify the composer backend is running.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveNewTeamToDB(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName || !newTeamShort) return;
    setSaveTeamStatus("Saving to database...");
    try {
      const created = await composerApi.createTeam({
        name: newTeamName.trim(),
        short_name: newTeamShort.trim().toUpperCase(),
        league: newTeamLeague.trim(),
        primary_color: newTeamPrimary,
        secondary_color: newTeamSecondary,
        accent_color: newTeamPrimary,
      });
      setDbTeams((prev) => [...prev, created]);
      setSelectedTeamName(created.name);
      setSaveTeamStatus("Team created and saved in Database!");
      setTimeout(() => {
        setShowAddTeamModal(false);
        setSaveTeamStatus(null);
        setNewTeamName("");
        setNewTeamShort("");
      }, 1500);
    } catch (err: unknown) {
      setSaveTeamStatus(`Error: ${(err as Error).message || "Failed to save"}`);
    }
  }

  function renderCard(tAspect: "1:1" | "16:9" | "4:5") {
    if (selectedTemplate === "prediction") {
      return <PredictionCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    if (selectedTemplate === "trivia") {
      return <TriviaCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    if (selectedTemplate === "battle") {
      return <BattleCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    if (selectedTemplate === "milestone") {
      return <MilestoneCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    if (selectedTemplate === "quote") {
      return <QuoteCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    if (selectedTemplate === "wire") {
      return <WireCardImg draft={sampleDraft} aspect={tAspect} />;
    }
    return <RecordCardImg draft={sampleDraft} aspect={tAspect} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Hero Header */}
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: "var(--space-xs)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--wire-red)",
              boxShadow: "0 0 8px var(--wire-red)",
            }}
          />
          <span className="text-micro" style={{ color: "#000000" }}>
            DATABASE-BACKED PRESS BOX THEME &amp; TEMPLATE STUDIO
          </span>
        </div>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "var(--space-xs) 0",
            color: "#000000",
          }}
        >
          Explore Team Colors &amp; High-Fidelity Templates
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "var(--text-base)", maxWidth: 700, margin: 0 }}>
          Database-backed team palettes for TNPL, MPL, CPL, IPL, WPL, and International leagues. Add new local league teams, build custom colors, and export PNG assets.
        </p>
      </div>

      {/* Main Studio Split Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--space-xl)", alignItems: "start" }}>
        {/* Left Column: Template & Color Customizer Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* 1. Template Selector */}
          <div className="card-container" style={{ padding: "var(--space-md)", background: "#ffffff", borderRadius: 16 }}>
            <h2 className="text-title" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)", color: "#000000" }}>
              1. Choose Card Template
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {TEMPLATES.map((tmpl) => {
                const active = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: active ? "2px solid var(--wire-red)" : "1px solid var(--border)",
                      background: active ? "var(--surface)" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#ffffff" : "#000000" }}>
                        {tmpl.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: active ? "rgba(255, 255, 255, 0.7)" : "var(--muted)", lineHeight: 1.3 }}>
                      {tmpl.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. League & Team Palette Builder */}
          <div className="card-container" style={{ padding: "var(--space-md)", background: "#ffffff", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="text-title" style={{ fontSize: "var(--text-lg)", margin: 0, color: "#000000" }}>
                  2. Team Colors ({allTeams.length} in DB)
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(!showAddTeamModal)}
                  className="ds-btn-secondary"
                  style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700 }}
                >
                  + Add Team to DB
                </button>
              </div>

              {/* League Selector Pills */}
              <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
                {leagues.map((lg) => (
                  <button
                    key={lg}
                    onClick={() => setSelectedLeague(lg)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: selectedLeague === lg ? "#000000" : "#ffffff",
                      color: selectedLeague === lg ? "#ffffff" : "#666666",
                      cursor: "pointer",
                    }}
                  >
                    {lg}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Team Modal / Dropdown */}
            {showAddTeamModal && (
              <form
                onSubmit={handleSaveNewTeamToDB}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--wire-red)",
                  borderRadius: 12,
                  padding: "var(--space-sm)",
                  marginBottom: "var(--space-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", letterSpacing: 1 }}>
                  SAVE NEW TEAM TO DATABASE
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8 }}>
                  <input
                    className="ds-input"
                    placeholder="Team Name (e.g. Coimbatore Comets)"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                    style={{ fontSize: 12 }}
                  />
                  <input
                    className="ds-input"
                    placeholder="Short Code (e.g. CC)"
                    value={newTeamShort}
                    onChange={(e) => setNewTeamShort(e.target.value)}
                    required
                    style={{ fontSize: 12 }}
                  />
                  <input
                    className="ds-input"
                    placeholder="League (e.g. TNPL, MPL)"
                    value={newTeamLeague}
                    onChange={(e) => setNewTeamLeague(e.target.value)}
                    required
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <label className="text-micro" style={{ display: "flex", alignItems: "center", gap: 6, color: "#ffffff" }}>
                    Primary Color
                    <input
                      type="color"
                      value={newTeamPrimary}
                      onChange={(e) => setNewTeamPrimary(e.target.value)}
                      style={{ width: 32, height: 28, cursor: "pointer", border: "none", background: "none" }}
                    />
                  </label>
                  <label className="text-micro" style={{ display: "flex", alignItems: "center", gap: 6, color: "#ffffff" }}>
                    Secondary Color
                    <input
                      type="color"
                      value={newTeamSecondary}
                      onChange={(e) => setNewTeamSecondary(e.target.value)}
                      style={{ width: 32, height: 28, cursor: "pointer", border: "none", background: "none" }}
                    />
                  </label>
                  <button type="submit" className="ds-btn-primary" style={{ padding: "6px 14px", fontSize: 12, marginLeft: "auto" }}>
                    Save to DB
                  </button>
                </div>
                {saveTeamStatus && (
                  <span className="text-micro" style={{ color: "var(--floodlight-cyan)" }}>
                    {saveTeamStatus}
                  </span>
                )}
              </form>
            )}

            {selectedLeague === "Custom" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="text-micro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    Primary Color (Hex)
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        style={{ width: 40, height: 32, cursor: "pointer", border: "none", background: "none" }}
                      />
                      <input
                        className="ds-input"
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        style={{ fontSize: 13, padding: "4px 8px" }}
                      />
                    </div>
                  </label>
                  <label className="text-micro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    Secondary Color (Hex)
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={customSecondary}
                        onChange={(e) => setCustomSecondary(e.target.value)}
                        style={{ width: 40, height: 32, cursor: "pointer", border: "none", background: "none" }}
                      />
                      <input
                        className="ds-input"
                        value={customSecondary}
                        onChange={(e) => setCustomSecondary(e.target.value)}
                        style={{ fontSize: 13, padding: "4px 8px" }}
                      />
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {filteredTeams.map((t) => {
                  const active = selectedTeamName === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTeamName(t.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: active ? `2px solid ${t.theme.accent}` : "1px solid var(--border)",
                        background: active ? "var(--surface)" : "#ffffff",
                        color: active ? "#ffffff" : "#000000",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: t.theme.accent,
                          boxShadow: `0 0 6px ${t.theme.glow}`,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Palette Preview Bar */}
            <div
              style={{
                marginTop: "var(--space-sm)",
                padding: "10px 14px",
                borderRadius: 8,
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: activeTheme.accent,
                    boxShadow: `0 0 10px ${activeTheme.glow}`,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                  {selectedLeague === "Custom" ? "Custom Palette" : selectedTeamName}
                </span>
              </div>
              <span className="text-micro" style={{ color: activeTheme.accent }}>
                {activeTheme.primary} · {activeTheme.secondary}
              </span>
            </div>
          </div>

          {/* Action CTA */}
          <button
            onClick={handleCreateWithThisTemplate}
            disabled={creating}
            className="ds-btn-primary"
            style={{
              padding: "14px 24px",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
            }}
          >
            {creating ? "Creating Draft..." : `Create Draft with ${TEMPLATES.find((t) => t.id === selectedTemplate)?.name}`}
          </button>
        </div>

        {/* Right Column: Live Scaled Render & Aspect Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="text-title" style={{ fontSize: "var(--text-lg)", margin: 0, color: "#000000" }}>
              Live Card Render
            </h2>
            {/* Aspect Ratio Switcher */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["1:1", "16:9", "4:5"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAspect(a)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: aspect === a ? "#000000" : "#ffffff",
                    color: aspect === a ? "#ffffff" : "#666666",
                    cursor: "pointer",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Scaled Preview Frame */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "var(--space-md)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              minHeight: 460,
            }}
          >
            <div
              style={{
                transform: "scale(0.38)",
                transformOrigin: "center center",
                margin: aspect === "16:9" ? "-180px -280px" : aspect === "4:5" ? "-350px -280px" : "-280px -280px",
              }}
            >
              {renderCard(aspect)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
