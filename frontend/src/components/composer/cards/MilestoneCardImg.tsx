import type { Draft } from "@/lib/composerApi";
import { getTeamTheme, type TeamColorTheme } from "@/lib/teamColors";

export default function MilestoneCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const player = (meta.player as string) || (meta.player_name as string) || "Sai Sudharsan";
  const team = (meta.team as string) || "Lyca Kovai Kings";
  const headlineStat = (meta.stat as string) || (meta.big_stat as string) || "82* (45)";
  const milestoneTag = (meta.tag as string) || (meta.milestone_type as string) || "MATCH HERO";
  const matchOpponent = (meta.opponent as string) || (meta.match as string) || "vs Dindigul Dragons";
  const tournament = (meta.league as string) || (meta.tournament as string) || "TNPL";

  const customTheme = meta.team_theme as TeamColorTheme | undefined;
  const theme = customTheme || getTeamTheme(team);

  const subStats = (meta.sub_stats as Array<{ label: string; value: string }>) || [
    { label: "BOUNDARIES", value: (meta.boundaries as string) || "8x 4s · 4x 6s" },
    { label: "STRIKE RATE", value: (meta.sr as string) || "182.2" },
    { label: "PHASE SCORE", value: (meta.phase_stat as string) || "42 in Death Overs" },
  ];

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
        background: "linear-gradient(145deg, #09090b 0%, #13131a 60%, #0c0c10 100%)",
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
      {/* Background radial team glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "20%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: theme.accent,
          filter: "blur(160px)",
          opacity: 0.25,
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
            {milestoneTag}
          </span>
        </div>

        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1.5,
            background: "rgba(255, 255, 255, 0.08)",
            border: `1px solid ${theme.accent}66`,
            padding: "6px 18px",
            borderRadius: 999,
            color: theme.accent,
          }}
        >
          {tournament} · {team}
        </span>
      </div>

      {/* Hero Stat & Player Showcase */}
      <div
        style={{
          margin: aspect === "16:9" ? "12px 0" : "24px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: aspect === "16:9" ? 36 : 46,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.9)",
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          {player}
          {matchOpponent && (
            <span
              style={{
                fontSize: aspect === "16:9" ? 22 : 26,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.5)",
                marginLeft: 12,
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}
            >
              {matchOpponent}
            </span>
          )}
        </div>

        {/* Big Giant Stat Callout */}
        <div
          style={{
            fontSize: aspect === "16:9" ? 92 : 118,
            fontWeight: 800,
            lineHeight: 0.95,
            color: theme.accent,
            textShadow: `0 0 40px ${theme.glow}`,
            letterSpacing: "-0.03em",
            margin: "12px 0",
          }}
        >
          {headlineStat}
        </div>

        {/* Sub Stat Badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 16,
          }}
        >
          {subStats.map((st, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "10px 18px",
                borderRadius: 12,
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(255, 255, 255, 0.5)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                {st.label}
              </div>
              <div
                style={{
                  fontSize: aspect === "16:9" ? 18 : 22,
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {st.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Narrative Commentary Box */}
      {draft.text && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: aspect === "16:9" ? "14px 18px" : "18px 22px",
            borderRadius: 16,
            position: "relative",
            zIndex: 1,
            margin: "6px 0",
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
          <span style={{ color: "#e8432e" }}>🔥</span> THE CRICKET FAN · MILESTONES
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
