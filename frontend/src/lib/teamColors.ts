// Team color definitions for IPL, International, and T20 Franchise teams

export interface TeamColorTheme {
  primary: string;
  secondary: string;
  gradient: string;
  accent: string;
  glow: string;
  textDark?: boolean;
}

const DEFAULT_THEME: TeamColorTheme = {
  primary: "#0071e3",
  secondary: "#38bdf8",
  gradient: "linear-gradient(135deg, #0071e3 0%, #38bdf8 100%)",
  accent: "#38bdf8",
  glow: "rgba(56, 189, 248, 0.35)",
  textDark: false,
};

const TEAM_PALETTES: Record<string, TeamColorTheme> = {
  // IPL
  "chennai super kings": {
    primary: "#FDB913",
    secondary: "#F3A100",
    gradient: "linear-gradient(135deg, #FDB913 0%, #F58220 100%)",
    accent: "#FDB913",
    glow: "rgba(253, 185, 19, 0.4)",
    textDark: true,
  },
  "csk": {
    primary: "#FDB913",
    secondary: "#F3A100",
    gradient: "linear-gradient(135deg, #FDB913 0%, #F58220 100%)",
    accent: "#FDB913",
    glow: "rgba(253, 185, 19, 0.4)",
    textDark: true,
  },
  "mumbai indians": {
    primary: "#004BA0",
    secondary: "#0077D4",
    gradient: "linear-gradient(135deg, #004BA0 0%, #0088FF 100%)",
    accent: "#0088FF",
    glow: "rgba(0, 136, 255, 0.4)",
  },
  "mi": {
    primary: "#004BA0",
    secondary: "#0077D4",
    gradient: "linear-gradient(135deg, #004BA0 0%, #0088FF 100%)",
    accent: "#0088FF",
    glow: "rgba(0, 136, 255, 0.4)",
  },
  "royal challengers bangalore": {
    primary: "#D41E24",
    secondary: "#1A1A1A",
    gradient: "linear-gradient(135deg, #E61C24 0%, #8B0000 100%)",
    accent: "#E61C24",
    glow: "rgba(230, 28, 36, 0.4)",
  },
  "rcb": {
    primary: "#D41E24",
    secondary: "#1A1A1A",
    gradient: "linear-gradient(135deg, #E61C24 0%, #8B0000 100%)",
    accent: "#E61C24",
    glow: "rgba(230, 28, 36, 0.4)",
  },
  "kolkata knight riders": {
    primary: "#3A225D",
    secondary: "#D4AF37",
    gradient: "linear-gradient(135deg, #3A225D 0%, #6A2C91 100%)",
    accent: "#D4AF37",
    glow: "rgba(106, 44, 145, 0.4)",
  },
  "kkr": {
    primary: "#3A225D",
    secondary: "#D4AF37",
    gradient: "linear-gradient(135deg, #3A225D 0%, #6A2C91 100%)",
    accent: "#D4AF37",
    glow: "rgba(106, 44, 145, 0.4)",
  },
  "rajasthan royals": {
    primary: "#EA1A85",
    secondary: "#001D48",
    gradient: "linear-gradient(135deg, #EA1A85 0%, #FF64B0 100%)",
    accent: "#EA1A85",
    glow: "rgba(234, 26, 133, 0.4)",
  },
  "rr": {
    primary: "#EA1A85",
    secondary: "#001D48",
    gradient: "linear-gradient(135deg, #EA1A85 0%, #FF64B0 100%)",
    accent: "#EA1A85",
    glow: "rgba(234, 26, 133, 0.4)",
  },
  "sunrisers hyderabad": {
    primary: "#F7A721",
    secondary: "#E8432E",
    gradient: "linear-gradient(135deg, #FF6600 0%, #F7A721 100%)",
    accent: "#FF6600",
    glow: "rgba(255, 102, 0, 0.4)",
  },
  "srh": {
    primary: "#F7A721",
    secondary: "#E8432E",
    gradient: "linear-gradient(135deg, #FF6600 0%, #F7A721 100%)",
    accent: "#FF6600",
    glow: "rgba(255, 102, 0, 0.4)",
  },
  "gujarat titans": {
    primary: "#1C1C1C",
    secondary: "#B19B61",
    gradient: "linear-gradient(135deg, #1C2833 0%, #2E4053 100%)",
    accent: "#B19B61",
    glow: "rgba(177, 155, 97, 0.35)",
  },
  "gt": {
    primary: "#1C1C1C",
    secondary: "#B19B61",
    gradient: "linear-gradient(135deg, #1C2833 0%, #2E4053 100%)",
    accent: "#B19B61",
    glow: "rgba(177, 155, 97, 0.35)",
  },
  "lucknow super giants": {
    primary: "#0057E7",
    secondary: "#E05A47",
    gradient: "linear-gradient(135deg, #0057E7 0%, #00B4D8 100%)",
    accent: "#00B4D8",
    glow: "rgba(0, 180, 216, 0.4)",
  },
  "lsg": {
    primary: "#0057E7",
    secondary: "#E05A47",
    gradient: "linear-gradient(135deg, #0057E7 0%, #00B4D8 100%)",
    accent: "#00B4D8",
    glow: "rgba(0, 180, 216, 0.4)",
  },
  "delhi capitals": {
    primary: "#004C93",
    secondary: "#E02020",
    gradient: "linear-gradient(135deg, #004C93 0%, #0077D4 100%)",
    accent: "#0077D4",
    glow: "rgba(0, 119, 212, 0.4)",
  },
  "dc": {
    primary: "#004C93",
    secondary: "#E02020",
    gradient: "linear-gradient(135deg, #004C93 0%, #0077D4 100%)",
    accent: "#0077D4",
    glow: "rgba(0, 119, 212, 0.4)",
  },
  "punjab kings": {
    primary: "#ED1B24",
    secondary: "#D4AF37",
    gradient: "linear-gradient(135deg, #ED1B24 0%, #AA151B 100%)",
    accent: "#ED1B24",
    glow: "rgba(237, 27, 36, 0.4)",
  },
  "pbks": {
    primary: "#ED1B24",
    secondary: "#D4AF37",
    gradient: "linear-gradient(135deg, #ED1B24 0%, #AA151B 100%)",
    accent: "#ED1B24",
    glow: "rgba(237, 27, 36, 0.4)",
  },

  // International
  "india": {
    primary: "#0077D4",
    secondary: "#FF9933",
    gradient: "linear-gradient(135deg, #0077D4 0%, #00A3E0 100%)",
    accent: "#00A3E0",
    glow: "rgba(0, 163, 224, 0.4)",
  },
  "australia": {
    primary: "#006400",
    secondary: "#FFD700",
    gradient: "linear-gradient(135deg, #FFCC00 0%, #006400 100%)",
    accent: "#FFD700",
    glow: "rgba(255, 215, 0, 0.4)",
    textDark: true,
  },
  "england": {
    primary: "#0C2340",
    secondary: "#C8102E",
    gradient: "linear-gradient(135deg, #C8102E 0%, #0C2340 100%)",
    accent: "#C8102E",
    glow: "rgba(200, 16, 46, 0.4)",
  },
  "pakistan": {
    primary: "#006400",
    secondary: "#90EE90",
    gradient: "linear-gradient(135deg, #004D20 0%, #00873E 100%)",
    accent: "#00873E",
    glow: "rgba(0, 135, 62, 0.4)",
  },
  "south africa": {
    primary: "#007A3D",
    secondary: "#FFB81C",
    gradient: "linear-gradient(135deg, #007A3D 0%, #FFB81C 100%)",
    accent: "#007A3D",
    glow: "rgba(0, 122, 61, 0.4)",
  },
  "new zealand": {
    primary: "#1A1A1A",
    secondary: "#00A3E0",
    gradient: "linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)",
    accent: "#00A3E0",
    glow: "rgba(0, 163, 224, 0.35)",
  },
  "west indies": {
    primary: "#7B1113",
    secondary: "#F8B612",
    gradient: "linear-gradient(135deg, #7B1113 0%, #D41E24 100%)",
    accent: "#F8B612",
    glow: "rgba(212, 30, 36, 0.4)",
  },
};

export function getTeamTheme(teamName?: string | null): TeamColorTheme {
  if (!teamName) return DEFAULT_THEME;
  const key = teamName.toLowerCase().trim();
  if (TEAM_PALETTES[key]) return TEAM_PALETTES[key];

  // Try partial match
  for (const [name, theme] of Object.entries(TEAM_PALETTES)) {
    if (key.includes(name) || name.includes(key)) {
      return theme;
    }
  }

  return DEFAULT_THEME;
}
