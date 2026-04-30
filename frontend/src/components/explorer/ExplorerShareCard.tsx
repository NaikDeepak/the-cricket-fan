"use client";
import { useRef, useState } from "react";
import { captureCard, shareCard } from "@/lib/share";
import type { BattleData, VenueTeamData } from "@/lib/api";

type Props =
  | { mode: "pvp"; data: BattleData }
  | { mode: "venue"; data: VenueTeamData };

export default function ExplorerShareCard(props: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  let bigNumber: string;
  let headline: string;
  let oneLiner: string;
  let subjectLine: string;

  if (props.mode === "pvp") {
    const { data } = props;
    const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.batsman_val ?? 0;
    const sr = data.stats.find((s) => s.label === "STRIKE RATE / ECONOMY")?.batsman_val ?? 0;
    bigNumber = String(dismissals);
    headline = dismissals >= 5 ? "DISMISSALS. MOST IN IPL." : "DISMISSALS IN IPL.";
    oneLiner = `SR ${sr}. No answer.`;
    subjectLine = `${data.bowler} vs ${data.batsman}`;
  } else {
    const { data } = props;
    const venueShort = data.venue.split(",")[0];
    bigNumber = `${data.win_pct}%`;
    headline = `WIN RATE AT ${venueShort.toUpperCase()}`;
    oneLiner = `${data.matches_played} matches. Avg score ${data.avg_score}.`;
    subjectLine = `${data.team} at ${venueShort}`;
  }

  const handleShare = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const blob = await captureCard(cardRef.current);
      await shareCard(blob, "cricket-fan-stat.png");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      {/* Off-screen card — captured by html-to-image */}
      <div
        ref={cardRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: 540,
          height: 540,
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "32px",
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#666",
              margin: 0,
            }}
          >
            THE CRICKET FAN
          </p>
          <p style={{ fontSize: "13px", color: "#aaa", margin: "8px 0 0" }}>{subjectLine}</p>
          <div style={{ width: "100%", height: "1px", background: "#222", marginTop: "12px" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "100px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "#f7a721",
              fontVariantNumeric: "tabular-nums",
              margin: 0,
            }}
          >
            {bigNumber}
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#fff",
              margin: "12px 0 0",
            }}
          >
            {headline}
          </p>
          <p style={{ fontSize: "13px", color: "#888", margin: "6px 0 0" }}>{oneLiner}</p>
        </div>
        <p
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            color: "#333",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          thecricketfan.in · Tap to explore
        </p>
      </div>

      <button
        onClick={handleShare}
        disabled={capturing}
        style={{
          width: "100%",
          padding: "14px",
          background: "#25D366",
          border: "none",
          borderRadius: "8px",
          color: "#fff",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: capturing ? "not-allowed" : "pointer",
          marginTop: "16px",
        }}
      >
        {capturing ? "CAPTURING..." : "📲 SHARE TO WHATSAPP"}
      </button>
    </>
  );
}
