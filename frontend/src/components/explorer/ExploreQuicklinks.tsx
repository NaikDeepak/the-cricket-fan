import Link from "next/link";
import type { StoryData } from "@/lib/api";

export default function ExploreQuicklinks({ data }: { data: StoryData }) {
  const venueShort = data.venue.split(",")[0];

  const links = [
    ...(data.featured_batsman && data.featured_bowler
      ? [
          {
            tag: "PLAYER BATTLE",
            label: `${data.featured_bowler} vs ${data.featured_batsman}`,
            href: `/explore?mode=pvp&p1=${encodeURIComponent(data.featured_batsman)}&p2=${encodeURIComponent(data.featured_bowler)}`,
          },
        ]
      : []),
    {
      tag: "VENUE EDGE",
      label: `${data.team_a.short_name} at ${venueShort}`,
      href: `/explore?mode=venue&venue=${encodeURIComponent(data.venue)}&team=${encodeURIComponent(data.team_a.short_name)}`,
    },
    {
      tag: "VENUE EDGE",
      label: `${data.team_b.short_name} at ${venueShort}`,
      href: `/explore?mode=venue&venue=${encodeURIComponent(data.venue)}&team=${encodeURIComponent(data.team_b.short_name)}`,
    },
  ];

  return (
    <section style={{ padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <p
        style={{
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "var(--muted)",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        EXPLORE THE NUMBERS
      </p>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "var(--fg)",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.15em",
                color: "var(--muted)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              {link.tag}
            </p>
            <p style={{ fontSize: "14px", fontWeight: 600, margin: "2px 0 0" }}>{link.label}</p>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "16px" }}>→</span>
        </Link>
      ))}
    </section>
  );
}
