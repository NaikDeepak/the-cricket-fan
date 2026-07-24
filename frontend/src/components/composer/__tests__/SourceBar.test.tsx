import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SourceBar from "@/components/composer/SourceBar";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const draft = {
  id: 7,
  source: "freeform",
  category: null,
  text: "",
  card_type: null,
  card_meta: null,
  status: "draft",
  created_at: "t",
  posted_at: null,
  content_key: null,
} as const;

describe("SourceBar", () => {
  it("Blank creates a freeform draft and calls onCreated", async () => {
    vi.spyOn(composerApi, "createDraft").mockResolvedValue({ ...draft });
    const onCreated = vi.fn();
    render(<SourceBar onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ blank/i }));
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
    );
  });

  it("Browse Bank thread pick sends every segment, not just the first", async () => {
    vi.spyOn(composerApi, "contentBank").mockResolvedValue([
      {
        content_key: "story:thread-1",
        category: "story",
        format: "thread",
        segments: ["Tweet one of the thread.", "Tweet two.", "Tweet three."],
        source: "wikipedia",
        last_used_days: null,
        event_month_day: null,
        on_this_day: false,
      },
    ]);
    vi.spyOn(composerApi, "createDraft").mockResolvedValue({ ...draft });
    render(<SourceBar onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse bank/i }));
    await waitFor(() =>
      expect(screen.getByText(/tweet one of the thread/i)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText(/tweet one of the thread/i).closest("button")!);
    await waitFor(() =>
      expect(composerApi.createDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Tweet one of the thread.\n\nTweet two.\n\nTweet three.",
        })
      )
    );
  });

  it("dims items used within the 14-day freshness window, not older ones", async () => {
    vi.spyOn(composerApi, "contentBank").mockResolvedValue([
      {
        content_key: "anecdote:recent",
        category: "anecdote",
        format: "single",
        segments: ["Used five days ago."],
        source: "wikipedia",
        last_used_days: 5,
        event_month_day: null,
        on_this_day: false,
      },
      {
        content_key: "anecdote:stale",
        category: "anecdote",
        format: "single",
        segments: ["Used forty days ago."],
        source: "wikipedia",
        last_used_days: 40,
        event_month_day: null,
        on_this_day: false,
      },
    ]);
    render(<SourceBar onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse bank/i }));

    const recentCard = await screen.findByText(/used five days ago/i);
    const staleCard = screen.getByText(/used forty days ago/i);

    expect(recentCard.closest("button")).toHaveStyle({ opacity: "0.5" });
    expect(staleCard.closest("button")).toHaveStyle({ opacity: "1" });
    expect(screen.getByText(/used 5d ago/i)).toBeInTheDocument();
    expect(screen.queryByText(/used 40d ago/i)).not.toBeInTheDocument();
  });

  it("badges on-this-day items", async () => {
    vi.spyOn(composerApi, "contentBank").mockResolvedValue([
      {
        content_key: "anecdote:today",
        category: "anecdote",
        format: "single",
        segments: ["Happened on this day."],
        source: "wikipedia",
        last_used_days: null,
        event_month_day: "07-24",
        on_this_day: true,
      },
    ]);
    render(<SourceBar onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse bank/i }));
    await waitFor(() =>
      expect(screen.getByText(/happened on this day/i)).toBeInTheDocument()
    );
    // exact match on the badge only -- must not pass merely because the
    // body text "Happened on this day." also contains this substring
    expect(screen.getByText(/^on this day$/i)).toBeInTheDocument();
  });

  it("LLM 503 shows a disabled message, no crash", async () => {
    vi.spyOn(composerApi, "generateLlm").mockRejectedValue(
      new Error("API /generate/llm → 503")
    );
    render(<SourceBar onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ai prompt/i), {
      target: { value: "a fact" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    await waitFor(() =>
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
    );
  });
});
