import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BacktestPage from "@/app/composer/backtest/page";
import { composerApi, type BacktestOptions, type BacktestResult } from "@/lib/composerApi";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockPush.mockClear();
});

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
  upcoming_games: [
    {
      date: "2024-05-27",
      team_a: "Trent Rockets",
      team_b: "Manchester Originals",
      venue: "Lord's, London",
      prob_team_a: 0.74,
      predicted_winner: "Trent Rockets",
      actual_winner: null,
      correct: null,
      status: "upcoming",
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
      expect(screen.getByText(/UPCOMING FIXTURES & MODEL PREDICTIONS/)).toBeInTheDocument();
    });
  });

  it("opens QuickShareModal when clicking Share Card button", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);
    vi.spyOn(composerApi, "runBacktest").mockResolvedValue(mockResult);

    render(<BacktestPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("LEAGUE") as HTMLSelectElement).value).toBe("IPL");
    });

    fireEvent.click(screen.getByRole("button", { name: /run backtest/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Share Card \(X \/ Insta\)/).length).toBeGreaterThan(0);
    });

    // Click the first Share Card button
    fireEvent.click(screen.getAllByText(/Share Card \(X \/ Insta\)/)[0]);

    await waitFor(() => {
      expect(screen.getByText("SHAREABLE MATCH CARD")).toBeInTheDocument();
      expect(screen.getByText(/Copy PNG to Clipboard/)).toBeInTheDocument();
      expect(screen.getByText(/Download PNG File/)).toBeInTheDocument();
      expect(screen.getByText(/Share to X \/ Twitter/)).toBeInTheDocument();
    });
  });

  it("creates a draft and navigates to Composer when clicking Open in Studio Composer", async () => {
    vi.spyOn(composerApi, "backtestOptions").mockResolvedValue(mockOptions);
    vi.spyOn(composerApi, "runBacktest").mockResolvedValue(mockResult);
    const createDraftSpy = vi.spyOn(composerApi, "createDraft").mockResolvedValue({
      id: 42,
      source: "bot",
      category: "prediction",
      text: "Draft text",
      card_type: "prediction",
      card_meta: {},
      status: "draft",
      created_at: new Date().toISOString(),
      posted_at: null,
      content_key: null,
    });

    render(<BacktestPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("LEAGUE") as HTMLSelectElement).value).toBe("IPL");
    });

    fireEvent.click(screen.getByRole("button", { name: /run backtest/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Open in Studio Composer/).length).toBeGreaterThan(0);
    });

    // Click Open in Studio Composer on upcoming game
    fireEvent.click(screen.getAllByText(/Open in Studio Composer/)[0]);

    await waitFor(() => {
      expect(createDraftSpy).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/composer?draft_id=42");
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
