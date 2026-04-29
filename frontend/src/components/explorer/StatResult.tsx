import type { BattleData, VenueTeamData } from "@/lib/api";

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "20px", fontWeight: 700 }}>{value}</div>
      <div
        style={{
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginTop: "2px",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "16px",
};

const breakdownStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid var(--border)",
};

type Props =
  | { mode: "pvp"; data: BattleData }
  | { mode: "venue"; data: VenueTeamData };

export default function StatResult(props: Props) {
  if (props.mode === "pvp") {
    const { data } = props;
    const dismissals = data.stats.find((s) => s.label === "DISMISSALS")?.batsman_val ?? 0;
    const balls = data.stats.find((s) => s.label === "BALLS FACED")?.batsman_val ?? 0;
    const sr = data.stats.find((s) => s.label === "STRIKE RATE / ECONOMY")?.batsman_val ?? 0;
    const dotPct = data.stats.find((s) => s.label === "DOT BALL %")?.batsman_val ?? 0;

    return (
      <div style={cardStyle}>
        <div
          style={{
            fontSize: "clamp(64px, 15vw, 96px)",
            fontWeight: 700,
            color: "var(--team-a)",
            lineHeight: 1,
          }}
        >
          {dismissals}
        </div>
        <p style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase", marginTop: "8px" }}>
          {data.bowler} has dismissed {data.batsman}
        </p>
        {dismissals >= 5 && (
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            More than any other bowler in IPL history
          </p>
        )}
        <div style={breakdownStyle}>
          <StatPill value={String(balls)} label="BALLS FACED" />
          <StatPill value={String(sr)} label="STRIKE RATE" />
          <StatPill value={`${dotPct}%`} label="DOT BALL %" />
        </div>
      </div>
    );
  }

  const { data } = props;
  const venueShort = data.venue.split(",")[0];

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: "clamp(64px, 15vw, 96px)",
          fontWeight: 700,
          color: "var(--team-a)",
          lineHeight: 1,
        }}
      >
        {data.win_pct}%
      </div>
      <p style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase", marginTop: "8px" }}>
        {data.team} win {data.win_pct}% at {venueShort}
      </p>
      <div style={breakdownStyle}>
        <StatPill value={String(data.matches_played)} label="MATCHES" />
        <StatPill value={String(data.avg_score)} label="AVG SCORE" />
        <StatPill value={`${data.chase_win_pct}%`} label="CHASE WIN %" />
      </div>
    </div>
  );
}
