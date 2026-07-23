import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// GSAP touches layout APIs happy-dom doesn't implement; stub it for tests.
vi.mock("@/lib/gsap", () => ({
  gsap: {
    to: vi.fn(),
    from: vi.fn(),
    set: vi.fn(),
    timeline: () => ({ to: vi.fn(), from: vi.fn() }),
  },
}));
