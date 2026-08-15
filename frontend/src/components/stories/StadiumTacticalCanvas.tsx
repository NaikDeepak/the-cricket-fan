"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Story } from "@/lib/storiesApi";

interface TacticalMarker {
  id: string;
  label: string;
  sublabel?: string;
  x: number; // percentage from left
  y: number; // percentage from top
  type: "distance" | "wicket" | "shot_cluster" | "flag" | "pace";
  value: string;
  storyKey: string;
  title: string;
  venue: string;
  stats: {
    equation: string;
    metricLabel: string;
    metricValue: string;
    shift: string;
  };
}

const DEFAULT_MARKERS: TacticalMarker[] = [
  {
    id: "wc-2011-dhoni",
    label: "92m",
    sublabel: "World Cup Winning Six",
    x: 48,
    y: 30,
    type: "distance",
    value: "92",
    title: "Wankhede 2011 — Dhoni Finishes Off in Style",
    storyKey: "story:wc-2011-final-dhoni-six",
    venue: "Wankhede Stadium, Mumbai · Flat Deck",
    stats: {
      equation: "4 runs off 11 balls (Target 275)",
      metricLabel: "Shot Distance",
      metricValue: "92m · Long-On into the Crowd",
      shift: "94% ➔ 100% (World Champions)",
    },
  },
  {
    id: "wt20-2007-joginder",
    label: "19.3 W",
    sublabel: "World T20 Title Wicket",
    x: 72,
    y: 68,
    type: "wicket",
    value: "W",
    title: "Johannesburg 2007 — 2007 T20 World Cup Final",
    storyKey: "story:t20-wc-2007-final-joginder",
    venue: "Wanderers Stadium · High Altitude",
    stats: {
      equation: "6 runs off 4 balls",
      metricLabel: "Turning Ball",
      metricValue: "19.3 Scoop caught at SFL",
      shift: "22% ➔ 100% (+78%)",
    },
  },
  {
    id: "wc-1983-kapil",
    label: "Kapil's Catch",
    sublabel: "Viv Richards Dismissal",
    x: 42,
    y: 28,
    type: "flag",
    value: "🏆",
    title: "Lord's 1983 — Kapil Dev & 1983 World Cup Triumph",
    storyKey: "story:world-cup-1983-final",
    venue: "Lord's, London · Green Seamer",
    stats: {
      equation: "Defending 183 vs West Indies",
      metricLabel: "Key Moment",
      metricValue: "Kapil 20m Running Catch",
      shift: "15% ➔ 82% (+67%)",
    },
  },
  {
    id: "kolkata-2001-laxman",
    label: "Inside-out 4s",
    sublabel: "Scoring Sector",
    x: 64,
    y: 46,
    type: "shot_cluster",
    value: "34",
    title: "Eden Gardens 2001 — Laxman 281 & Dravid 180",
    storyKey: "story:kolkata-2001-vvs-laxman",
    venue: "Eden Gardens, Kolkata · Turning Track",
    stats: {
      equation: "Following on (-274 deficit)",
      metricLabel: "Stand",
      metricValue: "376 Runs Unbroken on Day 4",
      shift: "2% ➔ 88% (+86%)",
    },
  },
];

interface Props {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
}

export default function StadiumTacticalCanvas(_props?: Props) {
  void _props;
  const [activeTab, setActiveTab] = useState<"strategy" | "battles" | "turning_points" | "world_cups">("strategy");
  const [selectedMarker, setSelectedMarker] = useState<TacticalMarker>(DEFAULT_MARKERS[0]);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);

  const TABS_BY_IDX: Array<"strategy" | "battles" | "turning_points" | "world_cups"> = [
    "strategy",
    "battles",
    "turning_points",
    "world_cups",
  ];

  function nextStory() {
    const nextIdx = (activeStoryIdx + 1) % DEFAULT_MARKERS.length;
    setActiveStoryIdx(nextIdx);
    setSelectedMarker(DEFAULT_MARKERS[nextIdx]);
    setActiveTab(TABS_BY_IDX[nextIdx]);
  }

  function prevStory() {
    const prevIdx = (activeStoryIdx - 1 + DEFAULT_MARKERS.length) % DEFAULT_MARKERS.length;
    setActiveStoryIdx(prevIdx);
    setSelectedMarker(DEFAULT_MARKERS[prevIdx]);
    setActiveTab(TABS_BY_IDX[prevIdx]);
  }

  function handleSelectMarker(m: TacticalMarker) {
    setSelectedMarker(m);
    const idx = DEFAULT_MARKERS.findIndex((item) => item.id === m.id);
    if (idx !== -1) {
      setActiveStoryIdx(idx);
      setActiveTab(TABS_BY_IDX[idx]);
    }
  }

  function handleTabChange(tabId: "strategy" | "battles" | "turning_points" | "world_cups") {
    setActiveTab(tabId);
    const targetIdx = TABS_BY_IDX.indexOf(tabId);
    if (targetIdx !== -1 && DEFAULT_MARKERS[targetIdx]) {
      setSelectedMarker(DEFAULT_MARKERS[targetIdx]);
      setActiveStoryIdx(targetIdx);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 24px 60px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.15) inset",
        backgroundColor: "#07120e",
        marginBottom: "var(--space-2xl)",
      }}
    >
      {/* 3D Aerial Stadium Tactical Canvas (Clean & Stable Ground Stage) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: 680,
          backgroundImage: "url('/images/stadium_tactical_aerial.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px 28px",
        }}
      >
        {/* Subtle Cinematic Vignette & Radial Stadium Glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(6, 18, 14, 0.45) 75%, rgba(4, 10, 8, 0.85) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* SVG Tactical Field Arc Overlays & Wagon Wheel Vectors (Responsive to Active Tab) */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Tactical Map Mode Overlays */}
          {activeTab === "strategy" && (
            <>
              <ellipse
                cx="49%"
                cy="47%"
                rx="22%"
                ry="18%"
                fill="none"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                className="anim-dash-flow"
              />
              <line
                x1="49%"
                y1="47%"
                x2="48%"
                y2="30%"
                stroke="rgba(250, 204, 21, 0.85)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="anim-dash-flow"
              />
              <path
                d="M 49% 47% L 60% 40% L 66% 50% Z"
                fill="rgba(34, 197, 94, 0.12)"
                stroke="rgba(34, 197, 94, 0.4)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="anim-dash-flow"
              />
            </>
          )}

          {/* Player Battles Mode: Pitch Crease Duel Vector */}
          {activeTab === "battles" && (
            <>
              {/* Central pitch crease zoom line */}
              <line
                x1="49%"
                y1="42%"
                x2="49%"
                y2="52%"
                stroke="#facc15"
                strokeWidth="3.5"
                strokeDasharray="8 4"
                className="anim-dash-flow"
              />
              {/* Pitch corridor width lines */}
              <line x1="47%" y1="42%" x2="47%" y2="52%" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
              <line x1="51%" y1="42%" x2="51%" y2="52%" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
            </>
          )}

          {/* Turning Points Mode: High-leverage boundary vector */}
          {activeTab === "turning_points" && (
            <>
              <line
                x1="49%"
                y1="47%"
                x2="72%"
                y2="68%"
                stroke="#f87171"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                className="anim-dash-flow"
              />
              <line
                x1="49%"
                y1="47%"
                x2="48%"
                y2="30%"
                stroke="#facc15"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                className="anim-dash-flow"
              />
            </>
          )}

          {/* Classics Mode: Historic Wagon Wheel */}
          {activeTab === "world_cups" && (
            <>
              <line x1="49%" y1="47%" x2="48%" y2="30%" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" className="anim-dash-flow" />
              <line x1="49%" y1="47%" x2="42%" y2="28%" stroke="#22c55e" strokeWidth="2" strokeDasharray="6 4" className="anim-dash-flow" />
            </>
          )}
        </svg>

        {/* TOP FLOATING CAPSULE NAVIGATION (GOLFEE STYLE) */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left Brand Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(11, 20, 16, 0.75)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor:
                  activeTab === "battles"
                    ? "#facc15"
                    : activeTab === "turning_points"
                    ? "#ef4444"
                    : activeTab === "world_cups"
                    ? "#38bdf8"
                    : "#22c55e",
                boxShadow: `0 0 10px ${
                  activeTab === "battles"
                    ? "#facc15"
                    : activeTab === "turning_points"
                    ? "#ef4444"
                    : activeTab === "world_cups"
                    ? "#38bdf8"
                    : "#22c55e"
                }`,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {activeTab === "strategy" && "Field Telemetry Mode"}
              {activeTab === "battles" && "Player Battle Duel"}
              {activeTab === "turning_points" && "Clutch Turning Point"}
              {activeTab === "world_cups" && "Tournament Milestone"}
            </span>
          </div>

          {/* Center Capsule Segmented Switcher */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 6px",
              borderRadius: 999,
              background: "rgba(11, 20, 16, 0.8)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            }}
          >
            {[
              { id: "strategy" as const, label: "Tactical Map", icon: "📍" },
              { id: "battles" as const, label: "Player Battles", icon: "⚔️" },
              { id: "turning_points" as const, label: "Turning Points", icon: "⚡" },
              { id: "world_cups" as const, label: "Classics", icon: "🏆" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "7px 16px",
                    borderRadius: 999,
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: isActive ? "#facc15" : "transparent",
                    color: isActive ? "#0f172a" : "#cbd5e1",
                    boxShadow: isActive ? "0 4px 14px rgba(250, 204, 21, 0.35)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Button */}
          <a
            href="#vault-grid"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(34, 197, 94, 0.9)",
              color: "#052e16",
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(34, 197, 94, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "transform 0.15s ease",
            }}
          >
            <span>Explore Vault</span>
            <span>↓</span>
          </a>
        </div>

        {/* INTERACTIVE TACTICAL NODES ON THE FIELD (FILTERED BY MODE) */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
          {/* Player Battles Special Duel HUD Nodes */}
          {activeTab === "battles" && (
            <>
              {/* Bowler Node */}
              <div
                style={{
                  position: "absolute",
                  left: "49%",
                  top: "40%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(15, 23, 42, 0.85)",
                    color: "#facc15",
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(250, 204, 21, 0.3)",
                    marginBottom: 4,
                  }}
                >
                  {selectedMarker.id === "wt20-2007-joginder"
                    ? "JOGINDER SHARMA · 19.3 Over"
                    : selectedMarker.id === "wc-2011-dhoni"
                    ? "KULASEKARA · 48.2 Over"
                    : selectedMarker.id === "wc-1983-kapil"
                    ? "MADAN LAL · 14.1 Over"
                    : "BOWLER · Turning Point"}
                </span>
                <div
                  className="radar-node-gold"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    backgroundColor: "#facc15",
                    color: "#0f172a",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #ffffff",
                  }}
                >
                  ⚡
                </div>
              </div>

              {/* Batsman Striker Node */}
              <div
                style={{
                  position: "absolute",
                  left: "49%",
                  top: "54%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  className="radar-node-emerald"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    color: "#ffffff",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #ffffff",
                  }}
                >
                  🏏
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "rgba(15, 23, 42, 0.85)",
                    color: "#4ade80",
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    marginTop: 4,
                  }}
                >
                  {selectedMarker.id === "wt20-2007-joginder"
                    ? "MISBAH-UL-HAQ · 43(38)"
                    : selectedMarker.id === "wc-2011-dhoni"
                    ? "MS DHONI · 91*(79)"
                    : selectedMarker.id === "wc-1983-kapil"
                    ? "VIV RICHARDS · 33(28)"
                    : "BATSMAN · On Strike"}
                </span>
              </div>
            </>
          )}

          {/* Standard Mode Interactive Markers */}
          {DEFAULT_MARKERS.map((m) => {
            const isSelected = selectedMarker.id === m.id;
            return (
              <motion.div
                key={m.id}
                style={{
                  position: "absolute",
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                  zIndex: 20,
                }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectMarker(m)}
              >
                {m.type === "distance" && (
                  <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#ffffff",
                        background: "rgba(15, 23, 42, 0.75)",
                        padding: "1px 6px",
                        borderRadius: 4,
                        marginBottom: 3,
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      {m.label}
                    </span>
                    <div
                      className={isSelected ? "radar-node-gold" : ""}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        backgroundColor: isSelected ? "#facc15" : "#0f172a",
                        color: isSelected ? "#0f172a" : "#ffffff",
                        border: `2px solid ${isSelected ? "#ffffff" : "rgba(255,255,255,0.6)"}`,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                )}

                {m.type === "shot_cluster" && (
                  <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      className={isSelected ? "radar-node-gold" : ""}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: isSelected ? "#facc15" : "#0f172a",
                        color: isSelected ? "#0f172a" : "#ffffff",
                        border: "2px solid rgba(255,255,255,0.6)",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                )}

                {m.type === "wicket" && (
                  <div
                    className={isSelected ? "radar-node-gold" : ""}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      backgroundColor: "#facc15",
                      color: "#0f172a",
                      border: "2px solid #ffffff",
                      boxShadow: "0 8px 24px rgba(250, 204, 21, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-sans)",
                      fontSize: 16,
                      fontWeight: 900,
                    }}
                  >
                    W
                  </div>
                )}

                {m.type === "flag" && (
                  <div
                    className={isSelected ? "radar-node-emerald" : ""}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                      color: "#ffffff",
                      border: "2px solid #ffffff",
                      boxShadow: "0 6px 18px rgba(34, 197, 94, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                  >
                    ⛳
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* FLOATING ACRYLIC GLASS HUD PANELS (GOLFEE STYLE) */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "flex-end",
            marginTop: "auto",
          }}
        >
          {/* LEFT SUB-HUD: Ground & Match Conditions */}
          <div
            style={{
              maxWidth: 320,
              padding: "16px 20px",
              borderRadius: 20,
              background: "rgba(11, 20, 16, 0.78)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 16px 36px rgba(0,0,0,0.4)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Venue Conditions
              </span>
              <span style={{ fontSize: 13 }}>☀️ 28°C</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc", lineHeight: 1.4 }}>
              {selectedMarker.venue}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 11,
                  background: "rgba(255,255,255,0.08)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  color: "#cbd5e1",
                }}
              >
                Wind: 6 mph SW
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                Chasing Bias: 64%
              </span>
            </div>
          </div>

          {/* RIGHT HERO HUD CARD: Match Telemetry & Story Breakdown (GOLFEE "Callaway" Panel) */}
          <div
            style={{
              width: 360,
              maxWidth: "100%",
              padding: "22px 24px",
              borderRadius: 24,
              background: "rgba(11, 20, 16, 0.88)",
              backdropFilter: "blur(28px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#facc15",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {activeTab === "battles" ? "Duel Telemetry" : "Match Telemetry · Turning Point"}
              </span>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  color: "#052e16",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                ✓
              </span>
            </div>

            <h3
              className="text-editorial-serif"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px 0",
                lineHeight: 1.25,
              }}
            >
              Match Focus · {selectedMarker.title}
            </h3>

            {/* Metric Data Table (Golfee Style) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "12px 14px",
                background: "rgba(255, 255, 255, 0.04)",
                borderRadius: 14,
                border: "1px solid rgba(255, 255, 255, 0.06)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "#94a3b8" }}>Target / Situation</span>
                <span style={{ fontWeight: 700, color: "#f8fafc" }}>{selectedMarker.stats.equation}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "#94a3b8" }}>{selectedMarker.stats.metricLabel}</span>
                <span style={{ fontWeight: 700, color: "#facc15" }}>{selectedMarker.stats.metricValue}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "#94a3b8" }}>Win Prob. Shift</span>
                <span style={{ fontWeight: 700, color: "#4ade80" }}>{selectedMarker.stats.shift}</span>
              </div>
            </div>

            <Link
              href={`/stories/${encodeURIComponent(selectedMarker.storyKey)}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "10px 16px",
                borderRadius: 999,
                background: "#facc15",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(250, 204, 21, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <span>Read Match Narrative</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* BOTTOM FLOATING CAPSULE CONTROL DOCK (GOLFEE "HOLE 10" DOCK) */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            marginTop: 18,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(11, 20, 16, 0.85)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            }}
          >
            <button
              type="button"
              onClick={prevStory}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              ←
            </button>

            {/* Glowing Center Yellow Capsule (Golfee Center Button) */}
            <div
              style={{
                padding: "6px 18px",
                borderRadius: 999,
                background: "#facc15",
                color: "#0f172a",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.02em",
                boxShadow: "0 4px 16px rgba(250, 204, 21, 0.35)",
              }}
            >
              {selectedMarker.label} · Event {activeStoryIdx + 1} of {DEFAULT_MARKERS.length}
            </div>

            <button
              type="button"
              onClick={nextStory}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
