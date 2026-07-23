const LOGO_BY_TEAM: Record<string, string> = {
  "Chennai Super Kings": "csk",
  "Delhi Capitals": "dc",
  "Gujarat Titans": "gt",
  "Kolkata Knight Riders": "kkr",
  "Lucknow Super Giants": "lsg",
  "Mumbai Indians": "mi",
  "Punjab Kings": "pbks",
  "Royal Challengers Bangalore": "rcb",
  "Royal Challengers Bengaluru": "rcb",
  "Rajasthan Royals": "rr",
  "Sunrisers Hyderabad": "srh",
};

export function teamLogoPath(teamName: string): string | null {
  const slug = LOGO_BY_TEAM[teamName];
  return slug ? `/images/logos/${slug}.png` : null;
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
