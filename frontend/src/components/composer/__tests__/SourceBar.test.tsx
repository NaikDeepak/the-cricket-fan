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
