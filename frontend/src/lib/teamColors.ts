// Team color definitions for IPL, WPL, TNPL, MPL, CPL, BBL, SA20, PSL, MLC, and International teams

export interface TeamColorTheme {
  primary: string;
  secondary: string;
  gradient: string;
  accent: string;
  glow: string;
  textDark?: boolean;
}

export interface TeamInfo {
  name: string;
  short: string;
  league: string;
  theme: TeamColorTheme;
}

export const DEFAULT_THEME: TeamColorTheme = {
  primary: "#e8432e",
  secondary: "#ff6b57",
  gradient: "linear-gradient(135deg, #e8432e 0%, #ff6b57 100%)",
  accent: "#e8432e",
  glow: "rgba(232, 67, 46, 0.4)",
  textDark: false,
};

// Helper to determine if a hex color is light (needs dark text)
export function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return false;
  const fullHex =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  // Perceived luminance formula (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

// Convert Hex to RGBA string
export function hexToRgba(hex: string, alpha = 0.4): string {
  const clean = hex.replace("#", "");
  const fullHex =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(fullHex.substring(0, 2) || "0", 16) || 0;
  const g = parseInt(fullHex.substring(2, 4) || "0", 16) || 0;
  const b = parseInt(fullHex.substring(4, 6) || "0", 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Dynamically generate a cohesive theme from any primary (and optional secondary) hex color
export function generateThemeFromHex(
  primaryHex: string,
  secondaryHex?: string
): TeamColorTheme {
  const primary = primaryHex.startsWith("#") ? primaryHex : `#${primaryHex}`;
  const secondary = secondaryHex
    ? secondaryHex.startsWith("#")
      ? secondaryHex
      : `#${secondaryHex}`
    : primary;
  const textDark = isLightColor(primary);
  const glow = hexToRgba(primary, 0.4);
  const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;

  return {
    primary,
    secondary,
    gradient,
    accent: primary,
    glow,
    textDark,
  };
}

export const LEAGUE_TEAMS: Record<string, TeamInfo[]> = {
  IPL: [
    {
      name: "Chennai Super Kings",
      short: "CSK",
      league: "IPL",
      theme: {
        primary: "#FDB913",
        secondary: "#F3A100",
        gradient: "linear-gradient(135deg, #FDB913 0%, #F58220 100%)",
        accent: "#FDB913",
        glow: "rgba(253, 185, 19, 0.4)",
        textDark: true,
      },
    },
    {
      name: "Mumbai Indians",
      short: "MI",
      league: "IPL",
      theme: {
        primary: "#004BA0",
        secondary: "#0077D4",
        gradient: "linear-gradient(135deg, #004BA0 0%, #0088FF 100%)",
        accent: "#0088FF",
        glow: "rgba(0, 136, 255, 0.4)",
      },
    },
    {
      name: "Royal Challengers Bengaluru",
      short: "RCB",
      league: "IPL",
      theme: {
        primary: "#D41E24",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #E61C24 0%, #8B0000 100%)",
        accent: "#E61C24",
        glow: "rgba(230, 28, 36, 0.4)",
      },
    },
    {
      name: "Kolkata Knight Riders",
      short: "KKR",
      league: "IPL",
      theme: {
        primary: "#3A225D",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #3A225D 0%, #6A2C91 100%)",
        accent: "#D4AF37",
        glow: "rgba(106, 44, 145, 0.4)",
      },
    },
    {
      name: "Rajasthan Royals",
      short: "RR",
      league: "IPL",
      theme: {
        primary: "#EA1A85",
        secondary: "#001D48",
        gradient: "linear-gradient(135deg, #EA1A85 0%, #FF64B0 100%)",
        accent: "#EA1A85",
        glow: "rgba(234, 26, 133, 0.4)",
      },
    },
    {
      name: "Sunrisers Hyderabad",
      short: "SRH",
      league: "IPL",
      theme: {
        primary: "#FF6600",
        secondary: "#F7A721",
        gradient: "linear-gradient(135deg, #FF6600 0%, #F7A721 100%)",
        accent: "#FF6600",
        glow: "rgba(255, 102, 0, 0.4)",
      },
    },
    {
      name: "Gujarat Titans",
      short: "GT",
      league: "IPL",
      theme: {
        primary: "#1C2833",
        secondary: "#B19B61",
        gradient: "linear-gradient(135deg, #1C2833 0%, #2E4053 100%)",
        accent: "#B19B61",
        glow: "rgba(177, 155, 97, 0.35)",
      },
    },
    {
      name: "Lucknow Super Giants",
      short: "LSG",
      league: "IPL",
      theme: {
        primary: "#0057E7",
        secondary: "#00B4D8",
        gradient: "linear-gradient(135deg, #0057E7 0%, #00B4D8 100%)",
        accent: "#00B4D8",
        glow: "rgba(0, 180, 216, 0.4)",
      },
    },
    {
      name: "Delhi Capitals",
      short: "DC",
      league: "IPL",
      theme: {
        primary: "#004C93",
        secondary: "#E02020",
        gradient: "linear-gradient(135deg, #004C93 0%, #0077D4 100%)",
        accent: "#0077D4",
        glow: "rgba(0, 119, 212, 0.4)",
      },
    },
    {
      name: "Punjab Kings",
      short: "PBKS",
      league: "IPL",
      theme: {
        primary: "#ED1B24",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #ED1B24 0%, #AA151B 100%)",
        accent: "#ED1B24",
        glow: "rgba(237, 27, 36, 0.4)",
      },
    },
  ],
  TNPL: [
    {
      name: "Chepauk Super Gillies",
      short: "CSG",
      league: "TNPL",
      theme: {
        primary: "#002B49",
        secondary: "#FDB913",
        gradient: "linear-gradient(135deg, #002B49 0%, #FDB913 100%)",
        accent: "#FDB913",
        glow: "rgba(253, 185, 19, 0.4)",
      },
    },
    {
      name: "Dindigul Dragons",
      short: "DD",
      league: "TNPL",
      theme: {
        primary: "#0077D4",
        secondary: "#FFE600",
        gradient: "linear-gradient(135deg, #0077D4 0%, #FFE600 100%)",
        accent: "#0077D4",
        glow: "rgba(0, 119, 212, 0.4)",
      },
    },
    {
      name: "Lyca Kovai Kings",
      short: "LKK",
      league: "TNPL",
      theme: {
        primary: "#4A154B",
        secondary: "#F4B41A",
        gradient: "linear-gradient(135deg, #4A154B 0%, #8A2B9B 100%)",
        accent: "#F4B41A",
        glow: "rgba(244, 180, 26, 0.4)",
      },
    },
    {
      name: "Nellai Royal Kings",
      short: "NRK",
      league: "TNPL",
      theme: {
        primary: "#C8102E",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #C8102E 0%, #8A0B20 100%)",
        accent: "#D4AF37",
        glow: "rgba(200, 16, 46, 0.4)",
      },
    },
    {
      name: "Salem Spartans",
      short: "SLS",
      league: "TNPL",
      theme: {
        primary: "#005A36",
        secondary: "#C0C0C0",
        gradient: "linear-gradient(135deg, #005A36 0%, #008751 100%)",
        accent: "#008751",
        glow: "rgba(0, 135, 81, 0.4)",
      },
    },
    {
      name: "Siechem Madurai Panthers",
      short: "SMP",
      league: "TNPL",
      theme: {
        primary: "#FF6F00",
        secondary: "#0B132B",
        gradient: "linear-gradient(135deg, #FF6F00 0%, #E65100 100%)",
        accent: "#FF6F00",
        glow: "rgba(255, 111, 0, 0.4)",
      },
    },
    {
      name: "IDream Tiruppur Tamizhans",
      short: "IDT",
      league: "TNPL",
      theme: {
        primary: "#0099FF",
        secondary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #0099FF 0%, #0055AA 100%)",
        accent: "#0099FF",
        glow: "rgba(0, 153, 255, 0.4)",
      },
    },
    {
      name: "Ba11sy Trichy",
      short: "BT",
      league: "TNPL",
      theme: {
        primary: "#008751",
        secondary: "#E5A823",
        gradient: "linear-gradient(135deg, #008751 0%, #004D20 100%)",
        accent: "#E5A823",
        glow: "rgba(229, 168, 35, 0.4)",
      },
    },
  ],
  MPL: [
    {
      name: "Puneri Bappa",
      short: "PB",
      league: "MPL",
      theme: {
        primary: "#FF6600",
        secondary: "#FFD700",
        gradient: "linear-gradient(135deg, #FF6600 0%, #FF8C00 100%)",
        accent: "#FFD700",
        glow: "rgba(255, 102, 0, 0.4)",
      },
    },
    {
      name: "Kolhapur Tuskers",
      short: "KT",
      league: "MPL",
      theme: {
        primary: "#4B0082",
        secondary: "#DFFF00",
        gradient: "linear-gradient(135deg, #4B0082 0%, #7B1FA2 100%)",
        accent: "#DFFF00",
        glow: "rgba(223, 255, 0, 0.4)",
      },
    },
    {
      name: "Eagle Nashik Titans",
      short: "ENT",
      league: "MPL",
      theme: {
        primary: "#008080",
        secondary: "#001F3F",
        gradient: "linear-gradient(135deg, #008080 0%, #004D40 100%)",
        accent: "#00B4D8",
        glow: "rgba(0, 180, 216, 0.4)",
      },
    },
    {
      name: "Ratnagiri Jets",
      short: "RJ",
      league: "MPL",
      theme: {
        primary: "#00BCD4",
        secondary: "#0A192F",
        gradient: "linear-gradient(135deg, #00BCD4 0%, #0288D1 100%)",
        accent: "#00BCD4",
        glow: "rgba(0, 188, 212, 0.4)",
      },
    },
    {
      name: "Chhatrapati Sambhaji Kings",
      short: "CSKM",
      league: "MPL",
      theme: {
        primary: "#800000",
        secondary: "#DAA520",
        gradient: "linear-gradient(135deg, #800000 0%, #B71C1C 100%)",
        accent: "#DAA520",
        glow: "rgba(218, 165, 32, 0.4)",
      },
    },
    {
      name: "Raigad Royals",
      short: "RR_MPL",
      league: "MPL",
      theme: {
        primary: "#DC143C",
        secondary: "#1E3A8A",
        gradient: "linear-gradient(135deg, #DC143C 0%, #990000 100%)",
        accent: "#DC143C",
        glow: "rgba(220, 20, 60, 0.4)",
      },
    },
  ],
  CPL: [
    {
      name: "Trinbago Knight Riders",
      short: "TKR",
      league: "CPL",
      theme: {
        primary: "#E50914",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #E50914 0%, #800000 100%)",
        accent: "#D4AF37",
        glow: "rgba(229, 9, 20, 0.4)",
      },
    },
    {
      name: "Barbados Royals",
      short: "BR",
      league: "CPL",
      theme: {
        primary: "#002F6C",
        secondary: "#E91E63",
        gradient: "linear-gradient(135deg, #002F6C 0%, #00509E 100%)",
        accent: "#E91E63",
        glow: "rgba(233, 30, 99, 0.4)",
      },
    },
    {
      name: "Guyana Amazon Warriors",
      short: "GAW",
      league: "CPL",
      theme: {
        primary: "#00843D",
        secondary: "#FFB81C",
        gradient: "linear-gradient(135deg, #00843D 0%, #FFB81C 100%)",
        accent: "#FFB81C",
        glow: "rgba(255, 184, 28, 0.4)",
      },
    },
    {
      name: "Saint Lucia Kings",
      short: "SLK",
      league: "CPL",
      theme: {
        primary: "#41B6E6",
        secondary: "#0C2340",
        gradient: "linear-gradient(135deg, #41B6E6 0%, #0077B6 100%)",
        accent: "#41B6E6",
        glow: "rgba(65, 182, 230, 0.4)",
      },
    },
    {
      name: "St Kitts and Nevis Patriots",
      short: "SKNP",
      league: "CPL",
      theme: {
        primary: "#005A36",
        secondary: "#D22630",
        gradient: "linear-gradient(135deg, #005A36 0%, #D22630 100%)",
        accent: "#D22630",
        glow: "rgba(210, 38, 48, 0.4)",
      },
    },
    {
      name: "Antigua & Barbuda Falcons",
      short: "ABF",
      league: "CPL",
      theme: {
        primary: "#00A3E0",
        secondary: "#C8102E",
        gradient: "linear-gradient(135deg, #00A3E0 0%, #0C2340 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.4)",
      },
    },
  ],
  WPL: [
    {
      name: "Royal Challengers Bengaluru Women",
      short: "RCBW",
      league: "WPL",
      theme: {
        primary: "#D41E24",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #D41E24 0%, #8B0000 100%)",
        accent: "#D4AF37",
        glow: "rgba(212, 30, 36, 0.4)",
      },
    },
    {
      name: "Mumbai Indians Women",
      short: "MIW",
      league: "WPL",
      theme: {
        primary: "#004BA0",
        secondary: "#F3A100",
        gradient: "linear-gradient(135deg, #004BA0 0%, #0088FF 100%)",
        accent: "#0088FF",
        glow: "rgba(0, 136, 255, 0.4)",
      },
    },
    {
      name: "Delhi Capitals Women",
      short: "DCW",
      league: "WPL",
      theme: {
        primary: "#004C93",
        secondary: "#E02020",
        gradient: "linear-gradient(135deg, #004C93 0%, #0077D4 100%)",
        accent: "#0077D4",
        glow: "rgba(0, 119, 212, 0.4)",
      },
    },
    {
      name: "UP Warriorz",
      short: "UPW",
      league: "WPL",
      theme: {
        primary: "#6A1B9A",
        secondary: "#FFD600",
        gradient: "linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)",
        accent: "#FFD600",
        glow: "rgba(255, 214, 0, 0.4)",
      },
    },
    {
      name: "Gujarat Giants Women",
      short: "GGW",
      league: "WPL",
      theme: {
        primary: "#FF6F00",
        secondary: "#D4AF37",
        gradient: "linear-gradient(135deg, #FF6F00 0%, #E65100 100%)",
        accent: "#FF6F00",
        glow: "rgba(255, 111, 0, 0.4)",
      },
    },
  ],
  "The Hundred Women": [
    {
      name: "Birmingham Phoenix Women",
      short: "BPW",
      league: "The Hundred Women",
      theme: {
        primary: "#E65C00",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #E65C00 0%, #FF8533 100%)",
        accent: "#FF8533",
        glow: "rgba(230, 92, 0, 0.4)",
      },
    },
    {
      name: "London Spirit Women",
      short: "LSW",
      league: "The Hundred Women",
      theme: {
        primary: "#002B49",
        secondary: "#00A3E0",
        gradient: "linear-gradient(135deg, #002B49 0%, #00A3E0 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.4)",
      },
    },
    {
      name: "Manchester Originals Women",
      short: "MOW",
      league: "The Hundred Women",
      theme: {
        primary: "#1C1C1C",
        secondary: "#666666",
        gradient: "linear-gradient(135deg, #1C1C1C 0%, #383838 100%)",
        accent: "#E50914",
        glow: "rgba(229, 9, 20, 0.35)",
      },
    },
    {
      name: "Northern Superchargers Women",
      short: "NSCW",
      league: "The Hundred Women",
      theme: {
        primary: "#6A1B9A",
        secondary: "#00BCD4",
        gradient: "linear-gradient(135deg, #6A1B9A 0%, #00BCD4 100%)",
        accent: "#00BCD4",
        glow: "rgba(0, 188, 212, 0.4)",
      },
    },
    {
      name: "Oval Invincibles Women",
      short: "OIW",
      league: "The Hundred Women",
      theme: {
        primary: "#007A53",
        secondary: "#003366",
        gradient: "linear-gradient(135deg, #007A53 0%, #003366 100%)",
        accent: "#00A86B",
        glow: "rgba(0, 168, 107, 0.4)",
      },
    },
    {
      name: "Southern Brave Women",
      short: "SBW",
      league: "The Hundred Women",
      theme: {
        primary: "#008751",
        secondary: "#FEE12B",
        gradient: "linear-gradient(135deg, #008751 0%, #004D20 100%)",
        accent: "#FEE12B",
        glow: "rgba(254, 225, 43, 0.4)",
      },
    },
    {
      name: "Trent Rockets Women",
      short: "TRW",
      league: "The Hundred Women",
      theme: {
        primary: "#FFC72C",
        secondary: "#1C355E",
        gradient: "linear-gradient(135deg, #FFC72C 0%, #E65100 100%)",
        accent: "#FFC72C",
        glow: "rgba(255, 199, 44, 0.4)",
        textDark: true,
      },
    },
    {
      name: "Welsh Fire Women",
      short: "WFW",
      league: "The Hundred Women",
      theme: {
        primary: "#D22630",
        secondary: "#005A36",
        gradient: "linear-gradient(135deg, #D22630 0%, #8A0B20 100%)",
        accent: "#D22630",
        glow: "rgba(210, 38, 48, 0.4)",
      },
    },
  ],
  WBBL: [
    {
      name: "Adelaide Strikers Women",
      short: "ASW",
      league: "WBBL",
      theme: {
        primary: "#00843D",
        secondary: "#00A3E0",
        gradient: "linear-gradient(135deg, #00A3E0 0%, #004B87 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.4)",
      },
    },
    {
      name: "Brisbane Heat Women",
      short: "BHW",
      league: "WBBL",
      theme: {
        primary: "#008A9B",
        secondary: "#F37021",
        gradient: "linear-gradient(135deg, #008A9B 0%, #004D5A 100%)",
        accent: "#00BCD4",
        glow: "rgba(0, 188, 212, 0.4)",
      },
    },
    {
      name: "Hobart Hurricanes Women",
      short: "HHW",
      league: "WBBL",
      theme: {
        primary: "#5A2D81",
        secondary: "#FFC20E",
        gradient: "linear-gradient(135deg, #5A2D81 0%, #8B4513 100%)",
        accent: "#7B3F00",
        glow: "rgba(90, 45, 129, 0.4)",
      },
    },
    {
      name: "Melbourne Renegades Women",
      short: "MRW",
      league: "WBBL",
      theme: {
        primary: "#D31145",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #D31145 0%, #8A0B20 100%)",
        accent: "#D31145",
        glow: "rgba(211, 17, 69, 0.4)",
      },
    },
    {
      name: "Melbourne Stars Women",
      short: "MSW",
      league: "WBBL",
      theme: {
        primary: "#008542",
        secondary: "#1C1C1C",
        gradient: "linear-gradient(135deg, #008542 0%, #004D20 100%)",
        accent: "#00A86B",
        glow: "rgba(0, 168, 107, 0.4)",
      },
    },
    {
      name: "Perth Scorchers Women",
      short: "PSW",
      league: "WBBL",
      theme: {
        primary: "#F37021",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #F37021 0%, #D84315 100%)",
        accent: "#F37021",
        glow: "rgba(243, 112, 33, 0.4)",
      },
    },
    {
      name: "Sydney Sixers Women",
      short: "SSW",
      league: "WBBL",
      theme: {
        primary: "#E5007D",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #E5007D 0%, #C2185B 100%)",
        accent: "#FF4081",
        glow: "rgba(229, 0, 125, 0.4)",
      },
    },
    {
      name: "Sydney Thunder Women",
      short: "STW",
      league: "WBBL",
      theme: {
        primary: "#A4D233",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #A4D233 0%, #689F38 100%)",
        accent: "#A4D233",
        glow: "rgba(164, 210, 51, 0.4)",
        textDark: true,
      },
    },
  ],
  "The Hundred": [
    {
      name: "Birmingham Phoenix",
      short: "BP",
      league: "The Hundred",
      theme: {
        primary: "#E65C00",
        secondary: "#1A1A1A",
        gradient: "linear-gradient(135deg, #E65C00 0%, #FF8533 100%)",
        accent: "#FF8533",
        glow: "rgba(230, 92, 0, 0.4)",
      },
    },
    {
      name: "London Spirit",
      short: "LS",
      league: "The Hundred",
      theme: {
        primary: "#002B49",
        secondary: "#00A3E0",
        gradient: "linear-gradient(135deg, #002B49 0%, #00A3E0 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.4)",
      },
    },
    {
      name: "Manchester Originals",
      short: "MO",
      league: "The Hundred",
      theme: {
        primary: "#1C1C1C",
        secondary: "#666666",
        gradient: "linear-gradient(135deg, #1C1C1C 0%, #383838 100%)",
        accent: "#E50914",
        glow: "rgba(229, 9, 20, 0.35)",
      },
    },
    {
      name: "Northern Superchargers",
      short: "NSC",
      league: "The Hundred",
      theme: {
        primary: "#6A1B9A",
        secondary: "#00BCD4",
        gradient: "linear-gradient(135deg, #6A1B9A 0%, #00BCD4 100%)",
        accent: "#00BCD4",
        glow: "rgba(0, 188, 212, 0.4)",
      },
    },
    {
      name: "Oval Invincibles",
      short: "OI",
      league: "The Hundred",
      theme: {
        primary: "#007A53",
        secondary: "#003366",
        gradient: "linear-gradient(135deg, #007A53 0%, #003366 100%)",
        accent: "#00A86B",
        glow: "rgba(0, 168, 107, 0.4)",
      },
    },
    {
      name: "Southern Brave",
      short: "SB",
      league: "The Hundred",
      theme: {
        primary: "#008751",
        secondary: "#FEE12B",
        gradient: "linear-gradient(135deg, #008751 0%, #004D20 100%)",
        accent: "#FEE12B",
        glow: "rgba(254, 225, 43, 0.4)",
      },
    },
    {
      name: "Trent Rockets",
      short: "TR",
      league: "The Hundred",
      theme: {
        primary: "#FFC72C",
        secondary: "#1C355E",
        gradient: "linear-gradient(135deg, #FFC72C 0%, #E65100 100%)",
        accent: "#FFC72C",
        glow: "rgba(255, 199, 44, 0.4)",
        textDark: true,
      },
    },
    {
      name: "Welsh Fire",
      short: "WF",
      league: "The Hundred",
      theme: {
        primary: "#D22630",
        secondary: "#005A36",
        gradient: "linear-gradient(135deg, #D22630 0%, #8A0B20 100%)",
        accent: "#D22630",
        glow: "rgba(210, 38, 48, 0.4)",
      },
    },
  ],
  International: [
    {
      name: "India",
      short: "IND",
      league: "International",
      theme: {
        primary: "#0077D4",
        secondary: "#FF9933",
        gradient: "linear-gradient(135deg, #0077D4 0%, #00A3E0 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.4)",
      },
    },
    {
      name: "Australia",
      short: "AUS",
      league: "International",
      theme: {
        primary: "#006400",
        secondary: "#FFD700",
        gradient: "linear-gradient(135deg, #FFCC00 0%, #006400 100%)",
        accent: "#FFD700",
        glow: "rgba(255, 215, 0, 0.4)",
        textDark: true,
      },
    },
    {
      name: "England",
      short: "ENG",
      league: "International",
      theme: {
        primary: "#0C2340",
        secondary: "#C8102E",
        gradient: "linear-gradient(135deg, #C8102E 0%, #0C2340 100%)",
        accent: "#C8102E",
        glow: "rgba(200, 16, 46, 0.4)",
      },
    },
    {
      name: "Pakistan",
      short: "PAK",
      league: "International",
      theme: {
        primary: "#006400",
        secondary: "#90EE90",
        gradient: "linear-gradient(135deg, #004D20 0%, #00873E 100%)",
        accent: "#00873E",
        glow: "rgba(0, 135, 62, 0.4)",
      },
    },
    {
      name: "South Africa",
      short: "SA",
      league: "International",
      theme: {
        primary: "#007A3D",
        secondary: "#FFB81C",
        gradient: "linear-gradient(135deg, #007A3D 0%, #FFB81C 100%)",
        accent: "#007A3D",
        glow: "rgba(0, 122, 61, 0.4)",
      },
    },
    {
      name: "New Zealand",
      short: "NZ",
      league: "International",
      theme: {
        primary: "#1A1A1A",
        secondary: "#00A3E0",
        gradient: "linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)",
        accent: "#00A3E0",
        glow: "rgba(0, 163, 224, 0.35)",
      },
    },
    {
      name: "West Indies",
      short: "WI",
      league: "International",
      theme: {
        primary: "#7B1113",
        secondary: "#F8B612",
        gradient: "linear-gradient(135deg, #7B1113 0%, #D41E24 100%)",
        accent: "#F8B612",
        glow: "rgba(212, 30, 36, 0.4)",
      },
    },
    {
      name: "Sri Lanka",
      short: "SL",
      league: "International",
      theme: {
        primary: "#003366",
        secondary: "#FFCC00",
        gradient: "linear-gradient(135deg, #003366 0%, #FFCC00 100%)",
        accent: "#FFCC00",
        glow: "rgba(255, 204, 0, 0.4)",
      },
    },
    {
      name: "Bangladesh",
      short: "BAN",
      league: "International",
      theme: {
        primary: "#006A4E",
        secondary: "#F42A41",
        gradient: "linear-gradient(135deg, #006A4E 0%, #F42A41 100%)",
        accent: "#006A4E",
        glow: "rgba(0, 106, 78, 0.4)",
      },
    },
    {
      name: "Afghanistan",
      short: "AFG",
      league: "International",
      theme: {
        primary: "#0055A5",
        secondary: "#D32011",
        gradient: "linear-gradient(135deg, #0055A5 0%, #002B49 100%)",
        accent: "#0055A5",
        glow: "rgba(0, 85, 165, 0.4)",
      },
    },
  ],
};

// Flattened lookup map
const TEAM_PALETTES: Record<string, TeamColorTheme> = {};

// Populate palettes
for (const teams of Object.values(LEAGUE_TEAMS)) {
  for (const t of teams) {
    TEAM_PALETTES[t.name.toLowerCase().trim()] = t.theme;
    TEAM_PALETTES[t.short.toLowerCase().trim()] = t.theme;
  }
}

export function listLeagues(): string[] {
  return Object.keys(LEAGUE_TEAMS);
}

export function getLeagueTeams(league: string): TeamInfo[] {
  return LEAGUE_TEAMS[league] || [];
}

export function listAllTeams(): TeamInfo[] {
  return Object.values(LEAGUE_TEAMS).flat();
}

export function getTeamTheme(
  teamNameOrCustom?: string | TeamColorTheme | null
): TeamColorTheme {
  if (!teamNameOrCustom) return DEFAULT_THEME;

  // If a custom TeamColorTheme object is provided directly
  if (typeof teamNameOrCustom === "object" && "primary" in teamNameOrCustom) {
    return teamNameOrCustom;
  }

  const key = String(teamNameOrCustom).toLowerCase().trim();
  if (TEAM_PALETTES[key]) return TEAM_PALETTES[key];

  // Try partial matching
  for (const [name, theme] of Object.entries(TEAM_PALETTES)) {
    if (key.includes(name) || name.includes(key)) {
      return theme;
    }
  }

  return DEFAULT_THEME;
}

export function registerDbTeams(
  dbTeams: Array<{
    name: string;
    short_name: string;
    league: string;
    primary_color: string;
    secondary_color: string;
    accent_color?: string | null;
    gradient?: string | null;
    glow?: string | null;
    text_dark?: boolean;
    aliases?: string[];
  }>
): void {
  for (const t of dbTeams) {
    const theme: TeamColorTheme = {
      primary: t.primary_color,
      secondary: t.secondary_color,
      accent: t.accent_color || t.primary_color,
      gradient:
        t.gradient ||
        `linear-gradient(135deg, ${t.primary_color} 0%, ${t.secondary_color} 100%)`,
      glow: t.glow || "rgba(255, 255, 255, 0.4)",
      textDark: Boolean(t.text_dark),
    };
    TEAM_PALETTES[t.name.toLowerCase().trim()] = theme;
    TEAM_PALETTES[t.short_name.toLowerCase().trim()] = theme;
    if (t.aliases) {
      for (const a of t.aliases) {
        TEAM_PALETTES[a.toLowerCase().trim()] = theme;
      }
    }
  }
}


