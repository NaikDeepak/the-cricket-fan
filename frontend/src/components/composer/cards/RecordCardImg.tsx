import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function RecordCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const headline = (meta.headline as string) || (meta.stat as string) || "";
  const team = meta.team as string | undefined;
  const customTheme = meta.team_theme as TeamColorTheme | undefined;
  const theme = team || customTheme ? (customTheme || getTeamTheme(team)) : null;

  const accentColor = theme?.accent || "#f59e0b";
  const glowColor = theme?.glow || "rgba(245, 158, 11, 0.4)";

  const dims =
    aspect === "16:9"
      ? { width: 1200, height: 675 }
      : aspect === "4:5"
      ? { width: 1080, height: 1350 }
      : { width: 1080, height: 1080 };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        background: "linear-gradient(145deg, #09090b 0%, #171514 60%, #0d0c0c 100%)",
        color: "#ffffff",
        padding: aspect === "16:9" ? "36px 48px" : "48px 52px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "var(--font-oswald), sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glowing orb */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: accentColor,
          filter: "blur(150px)",
          opacity: 0.18,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          paddingBottom: aspect === "16:9" ? 16 : 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 22,
            letterSpacing: 3,
            color: "rgba(255, 255, 255, 0.8)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          📊 STAT &amp; ANECDOTE
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1.5,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "6px 18px",
            borderRadius: 999,
            color: "#ffffff",
          }}
        >
          {draft.category ? draft.category.toUpperCase() : "FEATURED"}
        </span>
      </div>

      <div
        style={{
          margin: aspect === "16:9" ? "14px 0" : "32px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {headline && (
          <div
            style={{
              fontSize: aspect === "16:9" ? 52 : 64,
              fontWeight: 800,
              color: accentColor,
              textShadow: `0 0 28px ${glowColor}`,
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            {headline}
          </div>
        )}
        <p
          style={{
            fontSize: aspect === "16:9" ? 24 : 32,
            fontWeight: 400,
            lineHeight: 1.45,
            color: "rgba(255, 255, 255, 0.95)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            margin: 0,
          }}
        >
          {draft.text}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          paddingTop: aspect === "16:9" ? 14 : 22,
          fontSize: 18,
          color: "rgba(255, 255, 255, 0.5)",
          fontWeight: 600,
          letterSpacing: 1.5,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span>THE CRICKET FAN</span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
