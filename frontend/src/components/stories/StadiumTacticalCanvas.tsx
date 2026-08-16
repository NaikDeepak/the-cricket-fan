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
    value: "1983",
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
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backgroundColor: "#07120e",
        marginBottom: "var(--space-xl)",
      }}
    >
      {/* 3D Aerial Stadium Tactical Canvas */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: 640,
          backgroundImage: "url('/images/stadium_tactical_aerial.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 24px",
        }}
      >
        {/* Subtle Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(4, 10, 8, 0.8) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* SVG Tactical Field Arc Overlays */}
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
          <ellipse
            cx="49%"
            cy="47%"
            rx="36%"
            ry="24%"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {activeTab === "strategy" && (
            <line
              x1="49%"
              y1="47%"
              x2="48%"
              y2="30%"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {activeTab === "battles" && (
            <line
              x1="49%"
              y1="40%"
              x2="49%"
              y2="54%"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {activeTab === "turning_points" && (
            <line
              x1="49%"
              y1="47%"
              x2="72%"
              y2="68%"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {activeTab === "world_cups" && (
            <>
              <line x1="49%" y1="47%" x2="48%" y2="30%" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="49%" y1="47%" x2="42%" y2="28%" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
            </>
          )}
        </svg>

        {/* Top Floating Apple Bar */}
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
              gap: 8,
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#ffffff",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {activeTab === "strategy" && "Tactical Map"}
              {activeTab === "battles" && "Player Duel"}
              {activeTab === "turning_points" && "Turning Point"}
              {activeTab === "world_cups" && "Tournament Classic"}
            </span>
          </div>

          {/* Center Apple Segmented Switcher */}
          <div
            className="ds-segmented-control"
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: 3,
            }}
          >
            {[
              { id: "strategy" as const, label: "Tactical Map" },
              { id: "battles" as const, label: "Player Battles" },
              { id: "turning_points" as const, label: "Turning Points" },
              { id: "world_cups" as const, label: "Classics" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`ds-segmented-item ${isActive ? "ds-segmented-item--active" : ""}`}
                  style={{
                    color: isActive ? "#000000" : "#ffffff",
                    fontSize: 12,
                    padding: "5px 12px",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right Action Link */}
          <a
            href="#vault-grid"
            className="ds-btn ds-btn-secondary"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderColor: "rgba(255, 255, 255, 0.2)",
              textDecoration: "none",
            }}
          >
            Explore Vault ↓
          </a>
        </div>

        {/* Tactical Nodes on the Field */}
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
                    fontWeight: 600,
                    background: "rgba(0, 0, 0, 0.8)",
                    color: "#ffffff",
                    padding: "2px 6px",
                    borderRadius: 4,
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    marginBottom: 4,
                  }}
                >
                  {selectedMarker.id === "wt20-2007-joginder"
                    ? "JOGINDER SHARMA · 19.3"
                    : selectedMarker.id === "wc-2011-dhoni"
                    ? "KULASEKARA · 48.2"
                    : selectedMarker.id === "wc-1983-kapil"
                    ? "MADAN LAL · 14.1"
                    : "BOWLER"}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                  }}
                >
                  BOWL
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
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    color: "#ffffff",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                  }}
                >
                  BAT
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(0, 0, 0, 0.8)",
                    color: "#ffffff",
                    padding: "2px 6px",
                    borderRadius: 4,
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    marginTop: 4,
                  }}
                >
                  {selectedMarker.id === "wt20-2007-joginder"
                    ? "MISBAH-UL-HAQ · 43(38)"
                    : selectedMarker.id === "wc-2011-dhoni"
                    ? "MS DHONI · 91*(79)"
                    : selectedMarker.id === "wc-1983-kapil"
                    ? "VIV RICHARDS · 33(28)"
                    : "BATSMAN"}
                </span>
              </div>
            </>
          )}

          {/* Standard Markers */}
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
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSelectMarker(m)}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#ffffff",
                      background: "rgba(0, 0, 0, 0.8)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      marginBottom: 3,
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {m.label}
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.8)",
                      color: isSelected ? "#000000" : "#ffffff",
                      border: `1px solid ${isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Center / Bottom Tactical Story Drawer Card */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: 440,
            alignSelf: "flex-start",
            marginTop: "auto",
          }}
        >
          <div
            className="ds-card"
            style={{
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              background: "rgba(9, 9, 11, 0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#d4d4d8",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {activeTab === "battles" ? "Duel Telemetry" : "Turning Point"}
              </span>
            </div>

            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#ffffff",
                margin: "0 0 10px 0",
                lineHeight: 1.3,
              }}
            >
              {selectedMarker.title}
            </h3>

            {/* Metric Data Box */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: 6,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#a1a1aa" }}>Situation</span>
                <span style={{ fontWeight: 600, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                  {selectedMarker.stats.equation}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#a1a1aa" }}>{selectedMarker.stats.metricLabel}</span>
                <span style={{ fontWeight: 600, color: "#ffffff" }}>{selectedMarker.stats.metricValue}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#a1a1aa" }}>Win Prob Shift</span>
                <span style={{ fontWeight: 600, color: "var(--success)" }}>{selectedMarker.stats.shift}</span>
              </div>
            </div>

            <Link
              href={`/stories/${encodeURIComponent(selectedMarker.storyKey)}`}
              className="ds-btn ds-btn-primary"
              style={{
                width: "100%",
                padding: "8px 14px",
                fontSize: 12,
                justifyContent: "center",
                background: "#ffffff",
                color: "#000000",
                border: "none",
                textDecoration: "none",
              }}
            >
              Read Match Story →
            </Link>
          </div>
        </div>

        {/* Bottom Floating Control Dock */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <button
              type="button"
              onClick={prevStory}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              ←
            </button>

            <div
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {selectedMarker.label} · {activeStoryIdx + 1} of {DEFAULT_MARKERS.length}
            </div>

            <button
              type="button"
              onClick={nextStory}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
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
