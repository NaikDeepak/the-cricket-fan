import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PostsPage from "@/app/composer/posts/page";
import { composerApi, type Post } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const posts: Post[] = [
  {
    id: 1,
    fixture_id: 1,
    post_type: "prediction",
    state: "posted",
    text: "CSK to win",
    tweet_count: 1,
    posted_at: "2026-07-20T10:00:00Z",
    team_a: "CSK",
    team_b: "MI",
  },
  {
    id: 2,
    fixture_id: null,
    post_type: "standalone_trivia",
    state: "posted",
    text: "Did you know...",
    tweet_count: 1,
    posted_at: "2026-07-21T10:00:00Z",
    team_a: null,
    team_b: null,
  },
];

describe("PostsPage", () => {
  it("filters by post_type in addition to state", async () => {
    vi.spyOn(composerApi, "posts").mockResolvedValue(posts);
    render(<PostsPage />);

    await waitFor(() => {
      expect(screen.getByText("CSK to win")).toBeInTheDocument();
      expect(screen.getByText("Did you know...")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /^prediction \(1\)$/i })
    );

    expect(screen.getByText("CSK to win")).toBeInTheDocument();
    expect(screen.queryByText("Did you know...")).not.toBeInTheDocument();
  });
});
