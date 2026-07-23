import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardPreview from "@/components/composer/CardPreview";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const draft = {
  id: 12,
  source: "freeform",
  category: "anecdote",
  text: "Great cricket moment",
  card_type: "record",
  card_meta: { headline: "RECORD" },
  status: "draft",
  created_at: "t",
  posted_at: null,
} as const;

describe("CardPreview", () => {
  it("renders card headline and actions", () => {
    render(<CardPreview draft={{ ...draft }} />);
    expect(screen.getAllByText("RECORD")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy text/i })
    ).toBeInTheDocument();
  });

  it("Copy text copies to clipboard and logs event", async () => {
    const spy = vi
      .spyOn(composerApi, "logEvent")
      .mockResolvedValue(undefined as never);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock, write: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CardPreview draft={{ ...draft }} />);
    fireEvent.click(screen.getByRole("button", { name: /copy text/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("Great cricket moment");
      expect(spy).toHaveBeenCalledWith(12, { action: "copied" });
    });
  });
});
