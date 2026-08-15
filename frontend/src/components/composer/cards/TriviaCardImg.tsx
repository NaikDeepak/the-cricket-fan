import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function TriviaCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const question = (meta.question as string) || draft.text;
  const options = (meta.options as string[]) || [];
  const team = meta.team as string | undefined;
  const customTheme = meta.team_theme as TeamColorTheme | undefined;
  const theme = team || customTheme ? (customTheme || getTeamTheme(team)) : null;

  const accentColor = theme?.accent || "#818cf8";
  const glowColor = theme?.glow || "rgba(129, 140, 248, 0.4)";

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
        background: "linear-gradient(145deg, #09090b 0%, #131226 60%, #09090f 100%)",
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
          paddingBottom: aspect === "16:9" ? 16 : 22,
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
              background: accentColor,
              boxShadow: `0 0 12px ${glowColor}`,
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
            ❓ CRICKET TRIVIA
          </span>
        </div>

        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1.5,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "6px 18px",
            borderRadius: 999,
            color: accentColor,
          }}
        >
          DAILY QUIZ
        </span>
      </div>

      <div
        style={{
          margin: aspect === "16:9" ? "12px 0" : "24px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontSize: aspect === "16:9" ? 24 : 32,
            fontWeight: 600,
            lineHeight: 1.4,
            color: "#f8fafc",
            marginBottom: aspect === "16:9" ? 16 : 28,
            fontFamily: "var(--font-space-grotesk), sans-serif",
          }}
        >
          {question}
        </p>

        {options.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: aspect === "16:9" ? 12 : 16,
            }}
          >
            {options.map((opt, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: `1px solid ${accentColor}44`,
                  padding: aspect === "16:9" ? "12px 16px" : "18px 22px",
                  borderRadius: 12,
                  fontSize: aspect === "16:9" ? 18 : 22,
                  color: "#ffffff",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
              >
                <span style={{ color: accentColor, marginRight: 10, fontWeight: 700 }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </div>
            ))}
          </div>
        )}
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
        <span style={{ color: accentColor }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
