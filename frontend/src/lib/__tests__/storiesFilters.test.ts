import { describe, expect, it } from "vitest";
import {
  filtersFromSearchParams,
  nextFiltersOnTagSelect,
  queryStringFromFilters,
  resolveQSync,
  storiesUrl,
} from "../storiesFilters";

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

  describe("storiesUrl", () => {
    it("builds the full /stories path with query string", () => {
      expect(storiesUrl({ q: "laxman", tag: "comeback" })).toBe(
        "/stories?q=laxman&tag=comeback"
      );
    });

    it("builds bare /stories when filters are empty", () => {
      expect(storiesUrl({ q: "", tag: null })).toBe("/stories");
    });
  });

  describe("nextFiltersOnTagSelect", () => {
    it("selects a new tag, carrying the live qInput (not committed filters.q)", () => {
      expect(nextFiltersOnTagSelect("sachin", null, "comeback")).toEqual({
        q: "sachin",
        tag: "comeback",
      });
    });

    it("toggles off a tag that is already active", () => {
      expect(nextFiltersOnTagSelect("sachin", "comeback", "comeback")).toEqual({
        q: "sachin",
        tag: null,
      });
    });

    it("switches from one active tag to another", () => {
      expect(nextFiltersOnTagSelect("", "comeback", "record")).toEqual({
        q: "",
        tag: "record",
      });
    });
  });

  describe("resolveQSync", () => {
    it("resyncs when the URL's q was changed externally (e.g. back/forward)", () => {
      // lastPushedQ still says "sachin" (what we last committed), but the
      // URL now reads "kohli" — something other than our own debounce
      // pushed it there, so the local buffer must catch up.
      expect(resolveQSync("kohli", "sachin")).toEqual({
        qInput: "kohli",
        lastPushedQ: "kohli",
      });
    });

    it("does nothing when the URL just echoes back our own debounce push", () => {
      expect(resolveQSync("sachin", "sachin")).toBeNull();
    });

    it("does nothing when the URL echoes back a q a tag click carried", () => {
      // selectTag sets lastPushedQ to the qInput it carried before the
      // router.replace lands; once the URL reflects that same q, this must
      // stay a no-op or it would clobber in-flight typed text.
      expect(resolveQSync("just typed this", "just typed this")).toBeNull();
    });

    it("resyncs to empty string when the URL's q is cleared externally", () => {
      expect(resolveQSync("", "sachin")).toEqual({ qInput: "", lastPushedQ: "" });
    });
  });
});
