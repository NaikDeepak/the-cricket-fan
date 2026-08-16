import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnThisDayCardImg from "../OnThisDayCardImg";
import type { Story } from "@/lib/storiesApi";

const mockStory: Story = {
  content_key: "story:sachin-birthday",
  category: "story",
  format: "single",
  segments: ["Sachin Tendulkar turns 50 today! #TheCricketFan"],
  source: "wikipedia",
  title: "Happy Birthday Sachin Tendulkar",
  summary: "Legendary batter Sachin Tendulkar celebrates his birthday.",
  source_type: "wikipedia",
  source_ref: "https://en.wikipedia.org/wiki/Sachin_Tendulkar",
  teams: ["India"],
  players: ["Sachin Tendulkar"],
  venue: "Sharjah",
  year: 1973,
  match_format: "ODI",
  tags: ["birthday", "on_this_day"],
  is_published: true,
  event_month_day: "04-24",
};

describe("OnThisDayCardImg", () => {
  it("renders ON THIS DAY header and date", () => {
    render(<OnThisDayCardImg story={mockStory} />);
    expect(screen.getByText(/ON THIS DAY IN CRICKET/i)).toBeInTheDocument();
    expect(screen.getByText(/24 APRIL/i)).toBeInTheDocument();
    expect(screen.getByText(/Happy Birthday Sachin Tendulkar/i)).toBeInTheDocument();
    expect(screen.getByText(/BIRTHDAY TRIBUTE/i)).toBeInTheDocument();
  });
});
