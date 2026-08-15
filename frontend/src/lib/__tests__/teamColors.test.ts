import { describe, expect, it } from "vitest";
import {
  generateThemeFromHex,
  getLeagueTeams,
  getTeamTheme,
  isLightColor,
  listAllTeams,
  listLeagues,
} from "@/lib/teamColors";

describe("teamColors", () => {
  it("resolves built-in IPL, TNPL, MPL, and CPL teams", () => {
    const csk = getTeamTheme("Chennai Super Kings");
    expect(csk.primary).toBe("#FDB913");

    const lkk = getTeamTheme("Lyca Kovai Kings");
    expect(lkk.primary).toBe("#4A154B");

    const puneri = getTeamTheme("Puneri Bappa");
    expect(puneri.primary).toBe("#FF6600");

    const tkr = getTeamTheme("Trinbago Knight Riders");
    expect(tkr.primary).toBe("#E50914");
  });

  it("resolves abbreviations like CSK, LKK, PB, TKR", () => {
    expect(getTeamTheme("csk").primary).toBe("#FDB913");
    expect(getTeamTheme("lkk").primary).toBe("#4A154B");
    expect(getTeamTheme("pb").primary).toBe("#FF6600");
    expect(getTeamTheme("tkr").primary).toBe("#E50914");
  });

  it("generates theme dynamically from hex with correct gradients & glows", () => {
    const custom = generateThemeFromHex("#00AAFF", "#004488");
    expect(custom.primary).toBe("#00AAFF");
    expect(custom.secondary).toBe("#004488");
    expect(custom.gradient).toContain("linear-gradient");
    expect(custom.glow).toContain("rgba(");
  });

  it("correctly identifies light colors for dark text readability", () => {
    expect(isLightColor("#FFFFFF")).toBe(true);
    expect(isLightColor("#FFEA00")).toBe(true);
    expect(isLightColor("#000000")).toBe(false);
    expect(isLightColor("#002B49")).toBe(false);
  });

  it("lists all available leagues and teams", () => {
    const leagues = listLeagues();
    expect(leagues).toContain("IPL");
    expect(leagues).toContain("TNPL");
    expect(leagues).toContain("MPL");
    expect(leagues).toContain("CPL");

    const tnplTeams = getLeagueTeams("TNPL");
    expect(tnplTeams.length).toBeGreaterThanOrEqual(8);

    const all = listAllTeams();
    expect(all.length).toBeGreaterThan(25);
  });
});
