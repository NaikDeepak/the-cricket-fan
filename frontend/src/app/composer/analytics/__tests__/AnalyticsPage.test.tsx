import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/app/composer/analytics/page";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

const mockAnalytics = {
  funnel: { generated: 10, copied: 6, posted: 4 },
  event_totals: { generated: 12, copied: 8, posted: 4 },
  by_category: [
    { category: "anecdote", drafts: 5 },
    { category: "prediction", drafts: 5 },
  ],
  prediction_record: { correct: 8, total: 10 },
};

describe("AnalyticsPage", () => {
  it("renders funnel metrics and prediction accuracy", async () => {
    vi.spyOn(composerApi, "analytics").mockResolvedValue(mockAnalytics);
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument(); // 8/10 accuracy
      expect(screen.getByText(/10 generated/i)).toBeInTheDocument();
      expect(screen.getByText(/6 copied/i)).toBeInTheDocument();
    });
  });
});
