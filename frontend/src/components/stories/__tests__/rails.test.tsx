import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import gsap from "gsap";
import OnThisDayRail from "../OnThisDayRail";
import WireStrip from "../WireStrip";
import type { Story, WireItem } from "@/lib/storiesApi";

const story = {
  content_key: "story:dated",
  category: "story",
  format: "single",
  segments: ["a"],
  source: "test",
  title: "The Dated Classic",
  summary: "s",
  source_type: "wikipedia",
  source_ref: "ref",
  teams: [],
  players: [],
  venue: null,
  year: 2008,
  match_format: "Test",
  tags: [],
  is_published: true,
  event_month_day: "08-13",
} satisfies Story;

const wireItem: WireItem = {
  id: 1,
  category: "record",
  text: "posted tweet text",
  posted_at: "2026-08-10T12:00:00Z",
  content_key: null,
};

describe("OnThisDayRail", () => {
  it("renders nothing when no stories match", () => {
    const { container } = render(<OnThisDayRail stories={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders matching stories with the date stamp", () => {
    render(<OnThisDayRail stories={[story]} />);
    expect(screen.getByText(/on this day/i)).toBeInTheDocument();
    expect(screen.getByText("The Dated Classic")).toBeInTheDocument();
  });

  it("animates once when stories arrive after an empty mount, not on every subsequent update", () => {
    // Mirrors the real app: OnThisDayRail first mounts with stories=[] (async
    // fetch still pending) — the same component instance later re-renders
    // with real data once it arrives, rather than remounting. The entrance
    // animation must key off that data arrival, not the initial (empty) mount.
    const contextSpy = vi.spyOn(gsap, "context");
    const { rerender } = render(<OnThisDayRail stories={[]} />);
    expect(contextSpy).not.toHaveBeenCalled();

    rerender(<OnThisDayRail stories={[story]} />);
    expect(contextSpy).toHaveBeenCalledTimes(1);

    const secondStory = { ...story, content_key: "story:dated-2", title: "Another Classic" };
    rerender(<OnThisDayRail stories={[story, secondStory]} />);
    expect(contextSpy).toHaveBeenCalledTimes(1);

    contextSpy.mockRestore();
  });
});

describe("WireStrip", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<WireStrip items={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders posted items with date", () => {
    render(<WireStrip items={[wireItem]} />);
    expect(screen.getByText(/the wire/i)).toBeInTheDocument();
    expect(screen.getByText(/posted tweet text/)).toBeInTheDocument();
    expect(screen.getByText(/10 AUG 2026/)).toBeInTheDocument();
  });
});
