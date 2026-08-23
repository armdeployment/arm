import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoveragePanelView, type CoverageRow } from "../../src/components/adoption/coverage-panel";

const ROWS: CoverageRow[] = [
  { jobFunctionKey: "process_engineer", name: "Process Engineer", departmentName: "R&D", headcountWeight: 15, packages: [], activatedSeats: 0, eligibleSeats: 15, uncoveredWeight: 15 },
  { jobFunctionKey: "quality_engineer", name: "Quality Engineer", departmentName: "Quality Assurance", headcountWeight: 42, packages: ["Quality Engineer"], activatedSeats: 11, eligibleSeats: 42, uncoveredWeight: 31 },
];

describe("CoveragePanelView", () => {
  it("loading: renders a skeleton", () => {
    render(<CoveragePanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
  });

  it("error: renders an alert", () => {
    render(<CoveragePanelView status="error" errorMessage="down" />);
    expect(screen.getByRole("alert")).toHaveTextContent("down");
  });

  it("empty: renders when rows is empty", () => {
    render(<CoveragePanelView status="ready" rows={[]} />);
    expect(screen.getByText(/no job functions in scope/i)).toBeInTheDocument();
  });

  it("populated: flags the uncovered gap job function with a 'No package' badge", () => {
    render(<CoveragePanelView status="ready" rows={ROWS} />);
    expect(screen.getByText("Process Engineer")).toBeInTheDocument();
    expect(screen.getByText(/no package — gap/i)).toBeInTheDocument();
    // "Quality Engineer" appears twice: job-function name + package badge.
    expect(screen.getAllByText("Quality Engineer").length).toBe(2);
  });
});
