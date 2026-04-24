"use client";
import { forwardRef } from "react";
import type { StoryData } from "@/lib/api";

type Props = { data: StoryData; ratio: "9:16" | "1:1" };

const ShockStatCard = forwardRef<HTMLDivElement, Props>(({ data, ratio }, ref) => {
  const w = 540;
  const h = ratio === "9:16" ? 960 : 540;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: w,
        height: h,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "32px",
        fontFamily: "Space Grotesk, sans-serif",
        "--team-a": data.team_a.color,
        "--team-b": data.team_b.color,
      } as React.CSSProperties}
    >
      {/* Top */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666" }}>
          THE CRICKET FAN
        </p>
        <div style={{ width: "100%", height: "1px", background: "#222", marginTop: "12px" }} />
      </div>

      {/* Centre */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: ratio === "9:16" ? "160px" : "100px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: data.team_a.color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.shock_stat.value}
        </p>
        <p style={{ fontSize: "13px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666", marginTop: "12px" }}>
          {data.shock_stat.label}
        </p>
        <div style={{ width: "100%", height: "1px", background: "#222", margin: "20px 0" }} />
        <p style={{ fontSize: "18px", lineHeight: 1.6, color: "#f0f0f0", maxWidth: "400px", margin: "0 auto" }}>
          {data.shock_stat.one_liner}
        </p>
      </div>

      {/* Bottom */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666" }}>
          {data.team_a.short_name} vs {data.team_b.short_name} · {data.venue}
        </p>
        <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "#444" }}>
          thecricketfan.in
        </p>
      </div>
    </div>
  );
});
ShockStatCard.displayName = "ShockStatCard";
export default ShockStatCard;
