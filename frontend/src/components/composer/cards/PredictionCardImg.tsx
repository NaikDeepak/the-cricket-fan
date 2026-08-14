import type { Draft } from "@/lib/composerApi";
import { teamLogoPath } from "@/lib/teamLogo";
import { getTeamTheme } from "@/lib/teamColors";

export default function PredictionCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const teamA = (meta.team_a as string) || "Chennai Super Kings";
  const teamB = (meta.team_b as string) || "Mumbai Indians";
  const probA = typeof meta.prob_a === "number" ? meta.prob_a : 0.5;
  const probAStr = Math.round(probA * 100);
  const probBStr = 100 - probAStr;
  const logoA = teamLogoPath(teamA);
  const logoB = teamLogoPath(teamB);

  const themeA = getTeamTheme(teamA);
  const themeB = getTeamTheme(teamB);

  const dims =
    aspect === "16:9"
      ? { width: 1200, height: 675 }
      : aspect === "4:5"
      ? { width: 1080, height: 1350 }
      : { width: 1080, height: 1080 };

  const phase = (meta.phase as string) || "pre_match";
  const scoreSummary = meta.score_summary as string | undefined;
  const venue = meta.venue as string | undefined;
  const league = meta.league as string | undefined;

  const badgeText =
    phase === "innings_break"
      ? "INNINGS BREAK"
      : phase === "chase_in_progress"
      ? "LIVE UPDATE"
      : phase === "completed"
      ? "FINAL RESULT"
      : "MODEL PICK";

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        background: "linear-gradient(145deg, #09090c 0%, #121217 60%, #0d0d12 100%)",
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
      {/* Ambient Lighting Orbs with Team Colors */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: themeA.accent,
          filter: "blur(140px)",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: themeB.accent,
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
          paddingBottom: aspect === "16:9" ? 18 : 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
              MATCH PREDICTION & PROBABILITY
            </span>
          </div>
          {(scoreSummary || venue || league) && (
            <span
              style={{
                fontSize: 17,
                color: "rgba(255, 255, 255, 0.6)",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 500,
              }}
            >
              {scoreSummary ? `${scoreSummary} · ` : ""}
              {league || ""}
              {venue ? ` · ${venue}` : ""}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1.5,
            background:
              phase === "chase_in_progress"
                ? "rgba(225, 29, 72, 0.25)"
                : "rgba(255, 255, 255, 0.1)",
            border:
              phase === "chase_in_progress"
                ? "1px solid rgba(251, 113, 133, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.15)",
            padding: "8px 20px",
            borderRadius: 999,
            color: phase === "chase_in_progress" ? "#fb7185" : "#ffffff",
            backdropFilter: "blur(12px)",
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Main Probabilities & Team Face-off */}
      <div
        style={{
          margin: aspect === "16:9" ? "16px 0" : "28px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Team A Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {logoA ? (
              // eslint-disable-next-line @next/next/no-img-element -- captured by html-to-image, needs a plain <img>
              <img
                src={logoA}
                alt=""
                width={aspect === "16:9" ? 52 : 64}
                height={aspect === "16:9" ? 52 : 64}
                style={{
                  borderRadius: "50%",
                  boxShadow: `0 0 20px ${themeA.glow}`,
                  border: `2px solid ${themeA.accent}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: themeA.gradient,
                  boxShadow: `0 0 20px ${themeA.glow}`,
                }}
              />
            )}
            <span
              style={{
                fontSize: aspect === "16:9" ? 38 : 46,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {teamA}
            </span>
          </div>

          <span
            style={{
              fontSize: aspect === "16:9" ? 52 : 64,
              fontWeight: 800,
              color: themeA.accent,
              textShadow: `0 0 24px ${themeA.glow}`,
              letterSpacing: "-0.02em",
            }}
          >
            {probAStr}%
          </span>
        </div>

        {/* Dynamic Dual Team Color Probability Bar */}
        <div
          style={{
            height: aspect === "16:9" ? 22 : 28,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 999,
            overflow: "hidden",
            display: "flex",
            padding: 3,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.5)",
            margin: "12px 0",
          }}
        >
          <div
            style={{
              width: `${probAStr}%`,
              background: themeA.gradient,
              borderRadius: "999px 0 0 999px",
              boxShadow: `0 0 16px ${themeA.glow}`,
              transition: "width 0.4s ease",
            }}
          />
          <div
            style={{
              width: `${probBStr}%`,
              background: themeB.gradient,
              borderRadius: "0 999px 999px 0",
              boxShadow: `0 0 16px ${themeB.glow}`,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Team B Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {logoB ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoB}
                alt=""
                width={aspect === "16:9" ? 52 : 64}
                height={aspect === "16:9" ? 52 : 64}
                style={{
                  borderRadius: "50%",
                  boxShadow: `0 0 20px ${themeB.glow}`,
                  border: `2px solid ${themeB.accent}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: themeB.gradient,
                  boxShadow: `0 0 20px ${themeB.glow}`,
                }}
              />
            )}
            <span
              style={{
                fontSize: aspect === "16:9" ? 38 : 46,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {teamB}
            </span>
          </div>

          <span
            style={{
              fontSize: aspect === "16:9" ? 52 : 64,
              fontWeight: 800,
              color: themeB.accent,
              textShadow: `0 0 24px ${themeB.glow}`,
              letterSpacing: "-0.02em",
            }}
          >
            {probBStr}%
          </span>
        </div>
      </div>

      {/* Commentary & Narrative Glass Box */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          padding: aspect === "16:9" ? 20 : 26,
          borderRadius: 20,
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: aspect === "16:9" ? 22 : 26,
            lineHeight: 1.45,
            color: "rgba(255, 255, 255, 0.95)",
            fontWeight: 400,
            fontFamily: "var(--font-space-grotesk), sans-serif",
          }}
        >
          {draft.text}
        </p>
      </div>

      {/* Footer Branding */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          paddingTop: aspect === "16:9" ? 16 : 22,
          fontSize: 18,
          color: "rgba(255, 255, 255, 0.5)",
          fontWeight: 600,
          letterSpacing: 1.5,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e8432e", fontSize: 20 }}>🏏</span> THE CRICKET FAN STUDIO
        </span>
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>#TheCricketFan</span>
      </div>
    </div>
  );
}
