import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function WireCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const headline = (meta.headline as string) || (meta.title as string) || "BREAKING WIRE REPORT";
  const sourceLabel = (meta.source as string) || "PRESS BOX DESK";
  const points = (meta.points as string[]) || (meta.bullets as string[]) || [];
  const team = meta.team as string | undefined;

  const customTheme = meta.team_theme as TeamColorTheme | undefined;
  const theme = team ? customTheme || getTeamTheme(team) : null;

  const accentColor = theme?.accent || "#e8432e";
  const glowColor = theme?.glow || "rgba(232, 67, 46, 0.4)";

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
        background: "linear-gradient(145deg, #09090b 0%, #160f0e 60%, #09090b 100%)",
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
      {/* Top wire banner lighting */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: "25%",
          width: 500,
          height: 300,
          borderRadius: "50%",
          background: accentColor,
          filter: "blur(140px)",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid rgba(232, 67, 46, 0.4)",
          paddingBottom: aspect === "16:9" ? 14 : 20,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#e8432e",
              boxShadow: "0 0 14px #e8432e",
            }}
          />
          <span
            style={{
              fontSize: 22,
              letterSpacing: 4,
              color: "#e8432e",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            ⚡ FLASH WIRE
          </span>
        </div>

        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 2,
            background: "rgba(232, 67, 46, 0.15)",
            border: "1px solid rgba(232, 67, 46, 0.4)",
            padding: "6px 16px",
            borderRadius: 999,
            color: "#ffffff",
          }}
        >
          {sourceLabel}
        </span>
      </div>

      {/* Headline & Body Content */}
      <div
        style={{
          margin: aspect === "16:9" ? "14px 0" : "28px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontSize: aspect === "16:9" ? 44 : 54,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            margin: "0 0 20px 0",
            textShadow: `0 0 30px ${glowColor}`,
          }}
        >
          {headline}
        </h1>

        <p
          style={{
            fontSize: aspect === "16:9" ? 22 : 28,
            lineHeight: 1.45,
            color: "rgba(255, 255, 255, 0.95)",
            fontWeight: 400,
            fontFamily: "var(--font-space-grotesk), sans-serif",
            margin: "0 0 20px 0",
          }}
        >
          {draft.text}
        </p>

        {/* Bullet points if present */}
        {points.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {points.map((pt, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  fontSize: aspect === "16:9" ? 18 : 22,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  color: "rgba(255, 255, 255, 0.85)",
                }}
              >
                <span style={{ color: "#e8432e", fontWeight: 700 }}>▸</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          paddingTop: aspect === "16:9" ? 14 : 20,
          fontSize: 18,
          color: "rgba(255, 255, 255, 0.5)",
          fontWeight: 600,
          letterSpacing: 1.5,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e8432e" }}>📡</span> THE CRICKET FAN · WIRE DESK
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
