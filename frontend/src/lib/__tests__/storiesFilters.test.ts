import { describe, expect, it } from "vitest";
import { filtersFromSearchParams, queryStringFromFilters } from "../storiesFilters";

describe("storiesFilters", () => {
  it("reads q and tag from search params", () => {
    const sp = new URLSearchParams("q=laxman&tag=comeback");
    expect(filtersFromSearchParams(sp)).toEqual({ q: "laxman", tag: "comeback" });
  });

  it("defaults to empty filters", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({ q: "", tag: null });
  });

  it("round-trips filters to a query string", () => {
    expect(queryStringFromFilters({ q: "laxman", tag: "comeback" })).toBe(
      "?q=laxman&tag=comeback"
    );
    expect(queryStringFromFilters({ q: "", tag: null })).toBe("");
  });
});
