import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LivePredictPage from "@/app/composer/live-predict/page";
import { composerApi, type MatchInput, type LivePredictionResult } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

describe("LivePredictPage", () => {
  it("renders match form and executes prediction", async () => {
    const mockPrediction: LivePredictionResult = {
      team_a: "Chennai Super Kings",
      team_b: "Mumbai Indians",
      prob_team_a: 0.62,
      reasons: ["Strong form", "Home advantage"],
      phase: "pre_match",
      score_projection: {
        phase: "pre_match",
        projected_text: "Projected score: 165–185",
      },
      tweet_text: "IPL: Chennai Super Kings 62% to beat Mumbai Indians. #Cricket #TheCricketFan",
      card_meta: {
        team_a: "Chennai Super Kings",
        team_b: "Mumbai Indians",
        prob_a: 0.62,
        phase: "pre_match",
      },
    };

    vi.spyOn(composerApi, "runLivePrediction").mockResolvedValue(mockPrediction);

    render(<LivePredictPage />);

    expect(screen.getByText(/Match Predictor & Score Studio/i)).toBeInTheDocument();

    const predictBtn = screen.getByRole("button", { name: /Run Live Prediction/i });
    fireEvent.click(predictBtn);

    await waitFor(() => {
      expect(screen.getAllByText("62%").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("38%").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Projected score: 165–185/i)).toBeInTheDocument();
    });
  });

  it("parses pasted raw text and populates fields", async () => {
    const mockParsed: MatchInput = {
      team_a: "Antigua & Barbuda Falcons",
      team_b: "St Kitts and Nevis Patriots",
      league: "CPL",
      venue: "Sir Vivian Richards Stadium",
      phase: "innings_break",
      innings1_team: "Antigua & Barbuda Falcons",
      innings1_runs: 163,
      innings1_wickets: 4,
      innings1_overs: 20.0,
    };

    vi.spyOn(composerApi, "parseLiveMatch").mockResolvedValue(mockParsed);

    render(<LivePredictPage />);

    const textarea = screen.getByPlaceholderText(/Paste match scorecard/i);
    fireEvent.change(textarea, { target: { value: "ABF vs SKNP 163/4 (20.0)" } });

    const parseBtn = screen.getByRole("button", { name: /Extract & Populate/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("Antigua & Barbuda Falcons").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByDisplayValue("St Kitts and Nevis Patriots").length).toBeGreaterThanOrEqual(1);
    });
  });
});
