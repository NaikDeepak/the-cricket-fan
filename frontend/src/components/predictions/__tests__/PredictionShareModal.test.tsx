// frontend/src/components/predictions/__tests__/PredictionShareModal.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PredictionShareModal from "../PredictionShareModal";
import type { Prediction } from "@/lib/composerApi";

const samplePrediction: Prediction = {
  id: 1,
  fixture_id: 14,
  team_a: "Trent Rockets",
  team_b: "Manchester Super Giants",
  venue: "Lord's, London",
  league: "The Hundred",
  prob_team_a: 0.4843,
  reasons: ["bat_rr_a", "h2h_a_rate", "form10_a"],
  predicted_winner: "Manchester Super Giants",
  actual_winner: null,
  result_summary: null,
  outcome: "pending",
  created_at: "2026-08-16T12:00:00Z",
  evaluated_at: null,
};

describe("PredictionShareModal", () => {
  it("renders the modal header and team matchup", () => {
    render(<PredictionShareModal prediction={samplePrediction} onClose={vi.fn()} />);
    expect(screen.getByText(/SHAREABLE MATCH CARD/i)).toBeInTheDocument();
    expect(screen.getByText(/Trent Rockets vs Manchester Super Giants/)).toBeInTheDocument();
  });

  it("provides 1:1, 16:9, and 4:5 aspect ratio options", () => {
    render(<PredictionShareModal prediction={samplePrediction} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /1:1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /16:9/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /4:5/i })).toBeInTheDocument();
  });

  it("provides share actions: Copy PNG, Download, Share to X, and WhatsApp", () => {
    render(<PredictionShareModal prediction={samplePrediction} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Copy PNG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PNG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share to X/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<PredictionShareModal prediction={samplePrediction} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "✕" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
