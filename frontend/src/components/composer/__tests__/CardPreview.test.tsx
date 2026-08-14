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
  content_key: null,
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

  it("Copy + Mark Posted copies text and marks posted in one click", async () => {
    const logSpy = vi
      .spyOn(composerApi, "logEvent")
      .mockResolvedValue(undefined as never);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock, write: vi.fn() },
      writable: true,
      configurable: true,
    });
    const onUpdate = vi.fn();

    render(<CardPreview draft={{ ...draft }} onUpdate={onUpdate} />);
    fireEvent.click(
      screen.getByRole("button", { name: /copy \+ mark posted/i })
    );

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("Great cricket moment");
      expect(logSpy).toHaveBeenCalledWith(12, { action: "copied" });
      expect(logSpy).toHaveBeenCalledWith(12, { action: "posted" });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "posted" })
      );
    });
  });

  it("Copy + Mark Posted is disabled once the draft is already posted", () => {
    render(<CardPreview draft={{ ...draft, status: "posted" }} />);
    expect(
      screen.getByRole("button", { name: /copy \+ mark posted/i })
    ).toBeDisabled();
  });

  it("Duplicate creates a new draft pre-filled from this one's text/category/theme", async () => {
    const created = { ...draft, id: 99, status: "draft" as const };
    const createSpy = vi
      .spyOn(composerApi, "createDraft")
      .mockResolvedValue(created);
    const onDuplicate = vi.fn();

    render(<CardPreview draft={{ ...draft }} onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        source: "freeform",
        category: "anecdote",
        text: "Great cricket moment",
        card_type: "record",
        card_meta: { headline: "RECORD" },
      });
      expect(onDuplicate).toHaveBeenCalledWith(created);
    });
  });

  it("Delete requires a second confirming click before calling the API", async () => {
    const deleteSpy = vi
      .spyOn(composerApi, "deleteDraft")
      .mockResolvedValue(undefined);
    const onDelete = vi.fn();
    render(<CardPreview draft={{ ...draft }} onDelete={onDelete} />);

    const btn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(btn);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(12);
      expect(onDelete).toHaveBeenCalledWith(12);
    });
  });

  it("Delete failure shows an error and resets the confirm state, doesn't call onDelete", async () => {
    vi.spyOn(composerApi, "deleteDraft").mockRejectedValue(
      new Error("API /drafts/12 → 503")
    );
    const onDelete = vi.fn();
    render(<CardPreview draft={{ ...draft }} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
    });
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });
});
