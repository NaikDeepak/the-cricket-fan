import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PredictionsPage from "../page";
import { composerApi } from "@/lib/composerApi";
import type { Prediction, PredictionAccuracyStats } from "@/lib/composerApi";

const accuracy: PredictionAccuracyStats = {
  total: 10,
  evaluated: 8,
  pending: 2,
  correct: 5,
  incorrect: 3,
  void: 0,
  accuracy_pct: 63,
  streak: 2,
  streak_type: "win",
  recent_outcomes: ["correct", "correct"],
  by_league: [],
};

const pred = (over: Partial<Prediction>): Prediction => ({
  id: 1,
  fixture_id: 1,
  team_a: "Trent Rockets",
  team_b: "Manchester Super Giants",
  venue: "Lord's, London",
  league: "The Hundred",
  prob_team_a: 0.4843,
  reasons: [],
  predicted_winner: "Manchester Super Giants",
  actual_winner: null,
  result_summary: null,
  outcome: "pending",
  created_at: "2026-08-16T12:00:00Z",
  evaluated_at: null,
  ...over,
});

beforeEach(() => {
  vi.spyOn(composerApi, "predictionAccuracy").mockResolvedValue(accuracy);
  vi.spyOn(composerApi, "predictionLeagues").mockResolvedValue(["IPL", "The Hundred"]);
});

describe("PredictionsPage", () => {
  it("renders pending predictions above settled history", async () => {
    const predictionsSpy = vi
      .spyOn(composerApi, "predictions")
      .mockImplementation(async (q) => {
        if (q?.outcome === "pending") return [pred({ id: 1, team_a: "Trent Rockets" })];
        return [pred({ id: 2, outcome: "correct", team_a: "Mumbai Indians", team_b: "Chennai Super Kings", predicted_winner: "Mumbai Indians", actual_winner: "Mumbai Indians" })];
      });
    render(<PredictionsPage />);

    const pendingCard = await screen.findByText(/Trent Rockets vs Manchester Super Giants/);
    const settledCard = await screen.findByText(/Mumbai Indians vs Chennai Super Kings/);
    expect(pendingCard.compareDocumentPosition(settledCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(predictionsSpy).toHaveBeenCalledWith(expect.objectContaining({ outcome: "pending" }));
    expect(predictionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "correct,incorrect,void" })
    );
  });

  it("renders the accuracy summary strip", async () => {
    vi.spyOn(composerApi, "predictions").mockResolvedValue([]);
    render(<PredictionsPage />);
    expect(await screen.findByText(/63%/)).toBeInTheDocument();
    expect(screen.getByText(/8 Evaluated/)).toBeInTheDocument();
  });

  it("shows an explicit empty state when a league has no predictions", async () => {
    vi.spyOn(composerApi, "predictions").mockResolvedValue([]);
    render(<PredictionsPage />);
    expect(await screen.findByText(/No predictions recorded/i)).toBeInTheDocument();
  });

  it("load more appends the next offset page without duplicating", async () => {
    const settled = Array.from({ length: 20 }, (_, i) =>
      pred({ id: 100 + i, outcome: "correct", team_a: `Team ${i}` })
    );
    vi.spyOn(composerApi, "predictions").mockImplementation(async (q) => {
      if (q?.outcome === "pending") return [];
      if ((q?.offset ?? 0) === 0) return settled;
      return [pred({ id: 999, outcome: "correct", team_a: "Team Next Page" })];
    });
    render(<PredictionsPage />);

    await screen.findByText(/Team 0/);
    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => expect(screen.getByText(/Team Next Page/)).toBeInTheDocument());
    expect(screen.getAllByText(/Team 0/).length).toBe(1);
  });
});
