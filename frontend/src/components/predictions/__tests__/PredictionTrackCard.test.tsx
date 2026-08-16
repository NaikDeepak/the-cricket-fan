import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PredictionTrackCard from "../PredictionTrackCard";
import type { Prediction } from "@/lib/composerApi";

const base: Prediction = {
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
};

describe("PredictionTrackCard", () => {
  it("shows the model pick and probability", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText(/Manchester Super Giants · 52%/)).toBeInTheDocument();
    expect(screen.getByText(/51%|52%/)).toBeInTheDocument();
  });

  it("labels a pending prediction distinctly, not as a skeleton", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    expect(document.querySelector(".ds-skeleton")).toBeNull();
  });

  it("shows the actual result on a correct prediction", () => {
    render(
      <PredictionTrackCard
        prediction={{
          ...base,
          outcome: "correct",
          actual_winner: "Manchester Super Giants",
          result_summary: "won by 5 wickets",
        }}
      />
    );
    expect(screen.getByText(/Correct/i)).toBeInTheDocument();
    expect(screen.getByText(/won by 5 wickets/)).toBeInTheDocument();
  });

  it("labels an incorrect prediction without implying an error", () => {
    render(
      <PredictionTrackCard
        prediction={{ ...base, outcome: "incorrect", actual_winner: "Trent Rockets" }}
      />
    );
    const badge = screen.getByText(/Incorrect/i);
    expect(badge).toBeInTheDocument();
    expect(badge.style.color).toBe("var(--warning)"); // --warning (#d97706), never --error
  });

  it("labels a void prediction distinctly from pending", () => {
    render(<PredictionTrackCard prediction={{ ...base, outcome: "void" }} />);
    expect(screen.getByText(/No Result/i)).toBeInTheDocument();
  });

  it("renders the predicted-on date", () => {
    render(<PredictionTrackCard prediction={base} />);
    expect(screen.getByText("16 AUG 2026")).toBeInTheDocument();
  });
});
