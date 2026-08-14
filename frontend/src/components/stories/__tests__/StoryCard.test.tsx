import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoryCard from "../StoryCard";
import type { Story } from "@/lib/storiesApi";

const mockStory: Story = {
  content_key: "story:test-key",
  category: "anecdote",
  format: "single",
  segments: ["Segment 1"],
  source: "wiki",
  title: "Sensational Test Story Title",
  summary: "A brief summary of the sensational test story.",
  source_type: "wikipedia",
  source_ref: "http://example.com",
  teams: ["CSK", "MI"],
  players: ["Dhoni", "Rohit"],
  venue: "Wankhede",
  year: 2019,
  match_format: "IPL",
  tags: ["rivalry"],
  is_published: true,
  event_month_day: "05-12",
};

describe("StoryCard", () => {
  it("renders story title, category, year, and teams", () => {
    render(<StoryCard story={mockStory} />);
    expect(screen.getByText("Sensational Test Story Title")).toBeInTheDocument();
    expect(screen.getByText("Anecdote")).toBeInTheDocument();
    expect(screen.getByText("2019")).toBeInTheDocument();
    expect(screen.getByText("CSK vs MI")).toBeInTheDocument();
  });

  it("renders featured badge when featured prop is true", () => {
    render(<StoryCard story={mockStory} featured={true} />);
    expect(screen.getByText("FEATURED STORY")).toBeInTheDocument();
  });

  it("omits featured badge when featured prop is false", () => {
    render(<StoryCard story={mockStory} featured={false} />);
    expect(screen.queryByText("FEATURED STORY")).toBeNull();
  });
});
