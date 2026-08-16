import Image from "next/image";
import { teamInitials, teamLogoPath } from "@/lib/teamLogo";

export default function TeamBadge({
  team,
  size = 28,
}: {
  team: string;
  size?: number;
}) {
  const logo = teamLogoPath(team);
  if (logo) {
    return (
      <Image
        src={logo}
        alt={`${team} logo`}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--border)",
        color: "var(--muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {teamInitials(team)}
    </span>
  );
}
