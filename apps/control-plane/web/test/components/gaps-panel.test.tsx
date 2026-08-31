import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GapsPanelView, type GapRow } from "../../src/components/adoption/gaps-panel";

const ROWS: GapRow[] = [
  { jobFunctionKey: "process_engineer", name: "Process Engineer", uncoveredWeight: 15 },
];

describe("GapsPanelView", () => {
  it("loading: renders a skeleton", () => {
    render(<GapsPanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
  });

  it("error: renders an alert", () => {
    render(<GapsPanelView status="error" errorMessage="down" />);
    expect(screen.getByRole("alert")).toHaveTextContent("down");
  });

  it("empty: renders the placeholder-router empty state (library.gaps returns [] until `library` lands)", () => {
    render(<GapsPanelView status="ready" rows={[]} />);
    expect(screen.getByText(/no gaps reported/i)).toBeInTheDocument();
  });

  it("populated: each row links to /library prefiltered by the gap's job function key", () => {
    render(<GapsPanelView status="ready" rows={ROWS} />);
    const link = screen.getByRole("link", { name: /uncovered/i });
    expect(link).toHaveAttribute("href", "/library?gap=process_engineer");
    expect(screen.getByText("Process Engineer")).toBeInTheDocument();
  });
});
