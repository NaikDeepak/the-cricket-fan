import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BacktestPage from "@/app/composer/backtest/page";
import { composerApi, type BacktestOptions, type BacktestResult } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const mockOptions: BacktestOptions = {
  leagues: ["IPL", "T20I"],
  seasons_by_league: {
    IPL: ["2024", "2023"],
    T20I: ["2024"],
  },
  total_matches: 1095,
  earliest_date: "2008-04-18",
  latest_date: "2024-05-26",
  last_match: {
    date: "2024-05-26",
    league: "IPL",
    team_a: "Kolkata Knight Riders",
    team_b: "Sunrisers Hyderabad",
    venue: "MA Chidambaram Stadium, Chepauk",
  },
  matches_by_league: { IPL: 1095, T20I: 500 },
};

const mockResult: BacktestResult = {
  league: "IPL",
  season: "2024",
  total: 2,
  correct: 1,
  accuracy_pct: 50,
  elo_accuracy_pct: 50,
  home_accuracy_pct: 50,
  games: [
    {
      date: "2024-03-22",
      team_a: "Chennai Super Kings",
      team_b: "Royal Challengers Bengaluru",
      venue: "MA Chidambaram Stadium",
      prob_team_a: 0.65,
      predicted_winner: "Chennai Super Kings",
      actual_winner: "Chennai Super Kings",
      correct: true,
    },
    {
      date: "2024-03-23",
      team_a: "Kolkata Knight Riders",
      team_b: "Sunrisers Hyderabad",
      venue: "Eden Gardens",
      prob_team_a: 0.58,
      predicted_winner: "Kolkata Knight Riders",
      actual_winner: "Sunrisers Hyderabad",
      correct: false,
    },
  ],
};

describe("BacktestPage", () => {
  it("renders page header, ingestion telemetry badge, and populated selectors", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);

    render(<BacktestPage />);

    expect(screen.getByText("Model Backtest Engine")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("INGESTION STORE READY")).toBeInTheDocument();
      expect(screen.getByText(/1,095/)).toBeInTheDocument();
      expect(screen.getByText(/Kolkata Knight Riders/)).toBeInTheDocument();
    });

    const leagueSelect = screen.getByLabelText("LEAGUE") as HTMLSelectElement;
    expect(leagueSelect.value).toBe("IPL");

    const seasonSelect = screen.getByLabelText("SEASON / YEAR") as HTMLSelectElement;
    expect(seasonSelect.value).toBe("2024");
  });

  it("runs backtest on button click and displays accuracy, baselines, and games", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);
    vi.spyOn(composerApi, "runBacktest").mockResolvedValue(mockResult);

    render(<BacktestPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("LEAGUE") as HTMLSelectElement).value).toBe("IPL");
      expect((screen.getByLabelText("SEASON / YEAR") as HTMLSelectElement).value).toBe("2024");
    });

    const runBtn = screen.getByRole("button", { name: /run backtest/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText("1 of 2 Matches Correct")).toBeInTheDocument();
      expect(screen.getAllByText("Chennai Super Kings").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Royal Challengers Bengaluru").length).toBeGreaterThan(0);
    });
  });

  it("filters matches by Hits and Misses tabs", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);
    vi.spyOn(composerApi, "runBacktest").mockResolvedValue(mockResult);

    render(<BacktestPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("LEAGUE") as HTMLSelectElement).value).toBe("IPL");
    });

    const runBtn = screen.getByRole("button", { name: /run backtest/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText("Hits (1)")).toBeInTheDocument();
    });

    // Click Misses filter
    fireEvent.click(screen.getByText("Misses (1)"));
    expect(screen.getByText("Eden Gardens")).toBeInTheDocument();
    expect(screen.queryByText("MA Chidambaram Stadium")).not.toBeInTheDocument();

    // Click Hits filter
    fireEvent.click(screen.getByText("Hits (1)"));
    expect(screen.getByText("MA Chidambaram Stadium")).toBeInTheDocument();
    expect(screen.queryByText("Eden Gardens")).not.toBeInTheDocument();
  });

  it("surfaces honest error banner when runBacktest fails with 503 artifact error", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);
    vi.spyOn(composerApi, "runBacktest").mockRejectedValue(
      new Error("API /predictions/backtest → 503: Prediction model artifact not loaded")
    );

    render(<BacktestPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("LEAGUE") as HTMLSelectElement).value).toBe("IPL");
    });

    const runBtn = screen.getByRole("button", { name: /run backtest/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText("BACKTEST EXECUTION FAILED")).toBeInTheDocument();
      expect(screen.getByText(/Prediction model artifact not loaded/)).toBeInTheDocument();
    });
  });
});
