// frontend/src/lib/teamLogo.ts

const SHORT_CODE_MAP: Record<string, string> = {
  csk: "chennai_super_kings",
  mi: "mumbai_indians",
  rcb: "royal_challengers_bengaluru",
  kkr: "kolkata_knight_riders",
  rr: "rajasthan_royals",
  srh: "sunrisers_hyderabad",
  gt: "gujarat_titans",
  lsg: "lucknow_super_giants",
  dc: "delhi_capitals",
  pbks: "punjab_kings",
  tre: "trent_rockets",
  msg: "manchester_originals",
  mo: "manchester_originals",
  ls: "london_spirit",
  mil: "london_spirit",
  oi: "oval_invincibles",
  sb: "southern_brave",
  wf: "welsh_fire",
  nsc: "northern_superchargers",
  srl: "northern_superchargers",
  bp: "birmingham_phoenix",
  trew: "trent_rockets_women",
  sulw: "southern_brave_women",
  asw: "adelaide_strikers_women",
  bhw: "brisbane_heat_women",
  hhw: "hobart_hurricanes_women",
  mrw: "melbourne_renegades_women",
  msw: "melbourne_stars_women",
  psw: "perth_scorchers_women",
  ssw: "sydney_sixers_women",
  stw: "sydney_thunder_women",
};

const KNOWN_LOGOS = new Set([
  "adelaide_strikers_women",
  "afghanistan",
  "antigua_barbuda_falcons",
  "australia",
  "ba11sy_trichy",
  "bangladesh",
  "barbados_royals",
  "birmingham_phoenix",
  "birmingham_phoenix_women",
  "brisbane_heat_women",
  "chennai_super_kings",
  "chepauk_super_gillies",
  "delhi_capitals",
  "delhi_capitals_women",
  "dindigul_dragons",
  "england",
  "gujarat_titans",
  "guyana_amazon_warriors",
  "hobart_hurricanes_women",
  "idream_tiruppur_tamizhans",
  "india",
  "kolkata_knight_riders",
  "london_spirit",
  "london_spirit_women",
  "lucknow_super_giants",
  "lyca_kovai_kings",
  "manchester_originals",
  "manchester_originals_women",
  "melbourne_renegades_women",
  "melbourne_stars_women",
  "mumbai_indians",
  "mumbai_indians_women",
  "nellai_royal_kings",
  "new_zealand",
  "northern_superchargers",
  "northern_superchargers_women",
  "oval_invincibles",
  "oval_invincibles_women",
  "pakistan",
  "perth_scorchers_women",
  "punjab_kings",
  "rajasthan_royals",
  "royal_challengers_bengaluru",
  "royal_challengers_bengaluru_women",
  "saint_lucia_kings",
  "salem_spartans",
  "siechem_madurai_panthers",
  "south_africa",
  "southern_brave",
  "southern_brave_women",
  "sri_lanka",
  "st_kitts_and_nevis_patriots",
  "sunrisers_hyderabad",
  "sydney_sixers_women",
  "sydney_thunder_women",
  "trent_rockets",
  "trent_rockets_women",
  "trinbago_knight_riders",
  "up_warriorz",
  "welsh_fire",
  "welsh_fire_women",
  "west_indies",
]);

function toSlug(name: string): string {
  const s = name.toLowerCase().replace(/[()]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/[-\s]+/g, "_");
  return SHORT_CODE_MAP[s] || s;
}

export function teamLogoPath(teamName: string): string | null {
  if (!teamName) return null;
  const slug = toSlug(teamName);
  
  if (KNOWN_LOGOS.has(slug)) {
    return `/images/logos/${slug}.png`;
  }
  
  // Fallback: strip Men/Women suffix if specific logo not present
  const baseSlug = slug.replace(/_(women|men)$/, "");
  if (KNOWN_LOGOS.has(baseSlug)) {
    return `/images/logos/${baseSlug}.png`;
  }

  return null;
}

export function teamInitials(teamName: string): string {
  return teamName
    .split(" ")
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
