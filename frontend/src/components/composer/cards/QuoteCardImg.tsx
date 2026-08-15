import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function QuoteCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const speaker = (meta.speaker as string) || (meta.author as string) || "Rohit Sharma";
  const role = (meta.role as string) || (meta.title as string) || "Captain";
  const team = (meta.team as string) || "India";
  const context = (meta.context as string) || (meta.event as string) || "Post-Match Press Conference";
  const quoteText = (meta.quote as string) || draft.text;

  const customTheme = meta.team_theme as TeamColorTheme | undefined;
  const theme = customTheme || getTeamTheme(team);

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
        background: "linear-gradient(145deg, #09090b 0%, #131217 60%, #09090c 100%)",
        color: "#ffffff",
        padding: aspect === "16:9" ? "36px 48px" : "48px 56px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "var(--font-oswald), sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: theme.accent,
          filter: "blur(150px)",
          opacity: 0.2,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          paddingBottom: aspect === "16:9" ? 14 : 20,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: theme.accent,
              boxShadow: `0 0 12px ${theme.glow}`,
            }}
          />
          <span
            style={{
              fontSize: 22,
              letterSpacing: 3,
              color: "rgba(255, 255, 255, 0.8)",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            PRESS BOX QUOTE
          </span>
        </div>

        {context && (
          <span
            style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.6)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 500,
            }}
          >
            {context}
          </span>
        )}
      </div>

      {/* Giant Quotation Mark + Quote Text Body */}
      <div
        style={{
          margin: aspect === "16:9" ? "16px 0" : "32px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Giant decorative quotation mark */}
        <div
          style={{
            fontSize: aspect === "16:9" ? 90 : 120,
            lineHeight: 0.5,
            color: theme.accent,
            opacity: 0.5,
            fontFamily: "serif",
            marginBottom: 20,
          }}
        >
          “
        </div>

        <p
          style={{
            fontSize: aspect === "16:9" ? 30 : 38,
            lineHeight: 1.35,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#ffffff",
            margin: 0,
            fontFamily: "var(--font-space-grotesk), sans-serif",
          }}
        >
          {quoteText}
        </p>
      </div>

      {/* Speaker Attribution Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${theme.accent}44`,
          borderLeft: `4px solid ${theme.accent}`,
          padding: aspect === "16:9" ? "14px 20px" : "18px 24px",
          borderRadius: 14,
          backdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: aspect === "16:9" ? 26 : 32,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#ffffff",
            }}
          >
            {speaker}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.6)",
              letterSpacing: 1.5,
              fontWeight: 600,
              textTransform: "uppercase",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            {role} · {team}
          </div>
        </div>

        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1.5,
            background: "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${theme.accent}66`,
            padding: "6px 16px",
            borderRadius: 999,
            color: theme.accent,
          }}
        >
          {team}
        </span>
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
          <span style={{ color: "#e8432e" }}>🎙️</span> THE CRICKET FAN · VOICES
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
