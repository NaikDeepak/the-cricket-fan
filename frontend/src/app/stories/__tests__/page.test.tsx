import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StoriesPage from "../page";
import { storiesApi } from "@/lib/storiesApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const story = (key: string, title: string) => ({
  content_key: key,
  category: "anecdote",
  format: "odi",
  segments: ["x"],
  source: "wiki",
  title,
  summary: "s",
  source_type: "wikipedia",
  source_ref: "",
  teams: [],
  players: [],
  venue: null,
  year: 2020,
  match_format: null,
  tags: [],
  is_published: true,
  event_month_day: null,
});

beforeEach(() => {
  vi.spyOn(storiesApi, "getWire").mockResolvedValue([]);
});

describe("Vault low-count placeholder", () => {
  it("shows a 'more stories coming' tile when fewer than 6 stories are loaded", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue([
      story("a", "Story A"),
      story("b", "Story B"),
    ]);
    render(<StoriesPage />);
    expect(await screen.findByText(/MORE STORIES COMING/i)).toBeInTheDocument();
  });

  it("does not show the placeholder tile at 6 or more stories", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => story(`k${i}`, `Story ${i}`))
    );
    render(<StoriesPage />);
    await screen.findByText("Story 0");
    expect(screen.queryByText(/MORE STORIES COMING/i)).toBeNull();
  });

  it("applies ds-tag-scroll to the tag row for mobile horizontal scroll", async () => {
    vi.spyOn(storiesApi, "listStories").mockResolvedValue([
      { ...story("a", "Story A"), tags: ["rivalry", "iconic"] },
    ]);
    render(<StoriesPage />);
    await screen.findByText("Story A");
    expect(screen.getByText("All Stories").parentElement).toHaveClass("ds-tag-scroll");
  });
});
