import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoryBeats from "../StoryBeats";

describe("StoryBeats", () => {
  it("renders each segment as a numbered beat", () => {
    render(<StoryBeats segments={["first beat", "second beat"]} />);
    expect(screen.getByText("first beat")).toBeInTheDocument();
    expect(screen.getByText("second beat")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-beat]")).toHaveLength(2);
  });
  it("omits the counter for single-segment stories", () => {
    render(<StoryBeats segments={["only beat"]} />);
    expect(screen.queryByText("1/1")).toBeNull();
  });
  it("renders each beat with the ds-quote pull-quote treatment", () => {
    render(<StoryBeats segments={["first beat"]} />);
    const beat = document.querySelector("[data-beat]");
    expect(beat).toHaveClass("ds-quote");
  });
});
