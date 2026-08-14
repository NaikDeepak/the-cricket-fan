import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "../motion";

describe("prefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when the media query matches", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when matchMedia is undefined/not a function", () => {
    // @ts-expect-error simulating an environment without matchMedia (e.g. happy-dom)
    window.matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(true);
  });
});
