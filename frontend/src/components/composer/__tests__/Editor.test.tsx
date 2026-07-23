import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Editor from "@/components/composer/Editor";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const draft = {
  id: 3,
  source: "freeform",
  category: null,
  text: "hi",
  card_type: null,
  card_meta: null,
  status: "draft",
  created_at: "t",
  posted_at: null,
} as const;

describe("Editor", () => {
  it("counter warns past 280 without blocking input", () => {
    render(
      <Editor
        draft={{ ...draft, text: "x".repeat(285) }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/285\s*\/\s*280/)).toBeInTheDocument();
    expect(screen.getByLabelText(/post text/i)).toHaveValue("x".repeat(285));
  });

  it("debounced edit calls patchDraft once", async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(composerApi, "patchDraft")
      .mockResolvedValue({ ...draft, text: "hiya" });
    render(<Editor draft={{ ...draft }} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/post text/i), {
      target: { value: "hiya" },
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ text: "hiya" })
    );
    vi.useRealTimers();
  });
});
