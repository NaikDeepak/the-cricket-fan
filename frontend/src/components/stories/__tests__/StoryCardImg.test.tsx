import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoryCardImg from "../StoryCardImg";
import type { Story } from "@/lib/storiesApi";

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

describe("StoryCardImg", () => {
  it("renders title, key line, and branding", () => {
    render(
      <StoryCardImg
        story={{
          ...story,
          segments: ["the key line"],
          venue: "Eden Gardens",
        }}
      />
    );
    expect(screen.getByText("The Dated Classic")).toBeInTheDocument();
    expect(screen.getByText("the key line")).toBeInTheDocument();
    expect(screen.getByText("#TheCricketFan")).toBeInTheDocument();
    expect(screen.getByText(/2008/)).toBeInTheDocument();
    expect(screen.getByText(/Eden Gardens/)).toBeInTheDocument();
  });
  it("falls back to summary when there are no segments", () => {
    render(
      <StoryCardImg
        story={{ ...story, segments: [], summary: "fallback line" }}
      />
    );
    expect(screen.getByText("fallback line")).toBeInTheDocument();
  });
});
