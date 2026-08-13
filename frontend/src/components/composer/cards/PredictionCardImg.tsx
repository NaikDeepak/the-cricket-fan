import type { Draft } from "@/lib/composerApi";
import { teamLogoPath } from "@/lib/teamLogo";

export default function PredictionCardImg({
  draft,
  aspect = "1:1",
}: {
  draft: Draft;
  aspect?: "1:1" | "16:9" | "4:5";
}) {
  const meta = draft.card_meta ?? {};
  const teamA = (meta.team_a as string) || "TEAM A";
  const teamB = (meta.team_b as string) || "TEAM B";
  const probA = typeof meta.prob_a === "number" ? meta.prob_a : 0.5;
  const probAStr = Math.round(probA * 100);
  const probBStr = 100 - probAStr;
  const logoA = teamLogoPath(teamA);
  const logoB = teamLogoPath(teamB);

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
        background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)",
        color: "#ffffff",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "var(--font-oswald), sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #27272a",
          paddingBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 24,
            letterSpacing: 2,
            color: "#a1a1aa",
            fontWeight: 600,
          }}
        >
          🏏 MATCH PREDICTION
        </span>
        <span
          style={{
            fontSize: 20,
            background: "#27272a",
            padding: "6px 16px",
            borderRadius: 20,
            color: "#e4e4e7",
          }}
        >
          MODEL PICK
        </span>
      </div>

      <div style={{ margin: "32px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoA && (
              // eslint-disable-next-line @next/next/no-img-element -- captured by html-to-image, needs a plain <img>
              <img src={logoA} alt="" width={56} height={56} style={{ borderRadius: "50%" }} />
            )}
            <span style={{ fontSize: 44, fontWeight: 700 }}>{teamA}</span>
          </div>
          <span style={{ fontSize: 56, fontWeight: 800, color: "#38bdf8" }}>
            {probAStr}%
          </span>
        </div>

        {/* Win percentage probability bar */}
        <div
          style={{
            height: 24,
            background: "#27272a",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            margin: "16px 0",
          }}
        >
          <div
            style={{
              width: `${probAStr}%`,
              background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
            }}
          />
          <div
            style={{
              width: `${probBStr}%`,
              background: "linear-gradient(90deg, #e11d48 0%, #fb7185 100%)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoB && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoB} alt="" width={56} height={56} style={{ borderRadius: "50%" }} />
            )}
            <span style={{ fontSize: 44, fontWeight: 700 }}>{teamB}</span>
          </div>
          <span style={{ fontSize: 56, fontWeight: 800, color: "#fb7185" }}>
            {probBStr}%
          </span>
        </div>
      </div>

      <div
        style={{
          background: "rgba(39, 39, 42, 0.6)",
          padding: 24,
          borderRadius: 16,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: 1.4,
            color: "#f4f4f5",
            fontWeight: 400,
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
          borderTop: "2px solid #27272a",
          paddingTop: 24,
          fontSize: 20,
          color: "#71717a",
        }}
      >
        <span>THE CRICKET FAN</span>
        <span>#TheCricketFan</span>
      </div>
    </div>
  );
}

