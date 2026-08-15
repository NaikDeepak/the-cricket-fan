import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function BattleCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const player1 = (meta.player_1 as string) || (meta.batter as string) || "Virat Kohli";
  const team1 = (meta.team_1 as string) || (meta.team_a as string) || "Royal Challengers Bengaluru";
  const player2 = (meta.player_2 as string) || (meta.bowler as string) || "Jasprit Bumrah";
  const team2 = (meta.team_2 as string) || (meta.team_b as string) || "Mumbai Indians";

  const customTheme1 = meta.team_1_theme as TeamColorTheme | undefined;
  const customTheme2 = meta.team_2_theme as TeamColorTheme | undefined;

  const theme1 = customTheme1 || getTeamTheme(team1);
  const theme2 = customTheme2 || getTeamTheme(team2);

  const stats = (meta.stats as Array<{ label: string; val1: string | number; val2: string | number }>) || [
    { label: "BALLS FACED", val1: meta.balls || "78", val2: "—" },
    { label: "RUNS SCORED", val1: meta.runs || "114", val2: "—" },
    { label: "DISMISSALS", val1: "—", val2: meta.dismissals || "4" },
    { label: "STRIKE RATE", val1: meta.sr || "146.1", val2: "—" },
    { label: "DOT BALL %", val1: "—", val2: meta.dots || "48.7%" },
  ];

  const headline = (meta.headline as string) || "KEY HEAD-TO-HEAD BATTLE";
  const matchContext = (meta.context as string) || (meta.venue as string) || "";

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
        background: "linear-gradient(145deg, #070709 0%, #111116 50%, #08080a 100%)",
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
      {/* Ambient glowing split orbs */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: theme1.accent,
          filter: "blur(140px)",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          right: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: theme2.accent,
          filter: "blur(140px)",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />

      {/* Header Bar */}
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
              background: "#e8432e",
              boxShadow: "0 0 12px #e8432e",
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
            {headline}
          </span>
        </div>

        {matchContext && (
          <span
            style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.6)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 500,
            }}
          >
            {matchContext}
          </span>
        )}
      </div>

      {/* Duel Player Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: aspect === "16:9" ? 24 : 32,
          alignItems: "center",
          margin: aspect === "16:9" ? "12px 0" : "20px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Player 1 Tile */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${theme1.accent}44`,
            borderLeft: `4px solid ${theme1.accent}`,
            padding: aspect === "16:9" ? "16px 20px" : "24px 28px",
            borderRadius: 16,
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: theme1.accent,
              letterSpacing: 2,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {team1}
          </div>
          <div
            style={{
              fontSize: aspect === "16:9" ? 32 : 40,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {player1}
          </div>
        </div>

        {/* VS Badge */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: 1,
          }}
        >
          VS
        </div>

        {/* Player 2 Tile */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${theme2.accent}44`,
            borderRight: `4px solid ${theme2.accent}`,
            padding: aspect === "16:9" ? "16px 20px" : "24px 28px",
            borderRadius: 16,
            backdropFilter: "blur(12px)",
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: theme2.accent,
              letterSpacing: 2,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {team2}
          </div>
          <div
            style={{
              fontSize: aspect === "16:9" ? 32 : 40,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {player2}
          </div>
        </div>
      </div>

      {/* Head to Head Stats Grid */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "rgba(0, 0, 0, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: aspect === "16:9" ? "12px 18px" : "18px 24px",
          borderRadius: 16,
          position: "relative",
          zIndex: 1,
        }}
      >
        {stats.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1fr",
              alignItems: "center",
              padding: "6px 0",
              borderBottom:
                idx < stats.length - 1
                  ? "1px solid rgba(255, 255, 255, 0.05)"
                  : "none",
            }}
          >
            <span
              style={{
                fontSize: aspect === "16:9" ? 22 : 26,
                fontWeight: 700,
                color: theme1.accent,
              }}
            >
              {row.val1}
            </span>
            <span
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: 2,
                color: "rgba(255, 255, 255, 0.5)",
                fontWeight: 600,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                textAlign: "right",
                fontSize: aspect === "16:9" ? 22 : 26,
                fontWeight: 700,
                color: theme2.accent,
              }}
            >
              {row.val2}
            </span>
          </div>
        ))}
      </div>

      {/* Narrative Commentary Box */}
      {draft.text && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: aspect === "16:9" ? "14px 18px" : "18px 22px",
            borderRadius: 14,
            position: "relative",
            zIndex: 1,
            margin: "8px 0",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: aspect === "16:9" ? 18 : 22,
              lineHeight: 1.4,
              color: "rgba(255, 255, 255, 0.9)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            {draft.text}
          </p>
        </div>
      )}

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
          <span style={{ color: "#e8432e" }}>⚔️</span> THE CRICKET FAN · MATCH BATTLES
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
