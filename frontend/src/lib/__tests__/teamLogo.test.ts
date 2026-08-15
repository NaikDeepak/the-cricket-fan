import { describe, expect, it } from "vitest";
import { teamInitials, teamLogoPath } from "@/lib/teamLogo";

describe("teamLogo", () => {
  it("resolves IPL team logos", () => {
    expect(teamLogoPath("Chennai Super Kings")).toBe("/images/logos/chennai_super_kings.png");
    expect(teamLogoPath("Mumbai Indians")).toBe("/images/logos/mumbai_indians.png");
    expect(teamLogoPath("csk")).toBe("/images/logos/chennai_super_kings.png");
    expect(teamLogoPath("RCB")).toBe("/images/logos/royal_challengers_bengaluru.png");
  });

  it("resolves The Hundred team logos", () => {
    expect(teamLogoPath("Trent Rockets")).toBe("/images/logos/trent_rockets.png");
    expect(teamLogoPath("Manchester Originals")).toBe("/images/logos/manchester_originals.png");
    expect(teamLogoPath("London Spirit")).toBe("/images/logos/london_spirit.png");
    expect(teamLogoPath("tre")).toBe("/images/logos/trent_rockets.png");
    expect(teamLogoPath("msg")).toBe("/images/logos/manchester_originals.png");
  });

  it("resolves WBBL & WPL team logos", () => {
    expect(teamLogoPath("Sydney Sixers Women")).toBe("/images/logos/sydney_sixers_women.png");
    expect(teamLogoPath("Delhi Capitals Women")).toBe("/images/logos/delhi_capitals_women.png");
    expect(teamLogoPath("UP Warriorz")).toBe("/images/logos/up_warriorz.png");
  });

  it("computes initials fallback correctly", () => {
    expect(teamInitials("Trent Rockets")).toBe("TR");
    expect(teamInitials("Chennai Super Kings")).toBe("CS");
    expect(teamInitials("India")).toBe("I");
  });
});
