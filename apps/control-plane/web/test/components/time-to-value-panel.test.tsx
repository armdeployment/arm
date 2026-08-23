import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeToValuePanelView, type TTVBucket } from "../../src/components/adoption/time-to-value-panel";

const BUCKETS: TTVBucket[] = [
  { ltMinutes: 5, count: 10 },
  { ltMinutes: 10, count: 20 },
  { ltMinutes: 15, count: 5 },
  { ltMinutes: 30, count: 3 },
  { ltMinutes: 60, count: 1 },
  { ltMinutes: Infinity, count: 1 },
];

describe("TimeToValuePanelView", () => {
  it("loading: renders a skeleton", () => {
    render(<TimeToValuePanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
  });

  it("error: renders an alert", () => {
    render(<TimeToValuePanelView status="error" errorMessage="oops" />);
    expect(screen.getByRole("alert")).toHaveTextContent("oops");
  });

  it("empty: renders when sampleCount is 0", () => {
    render(<TimeToValuePanelView status="ready" buckets={[]} sampleCount={0} />);
    expect(screen.getByText(/no completed activations/i)).toBeInTheDocument();
  });

  it("populated: shows p50/p90/target and the 10-minute target subtitle", () => {
    render(<TimeToValuePanelView status="ready" buckets={BUCKETS} p50={8.2} p90={34.5} targetMinutes={10} sampleCount={40} />);
    expect(screen.getByText(/target 10 min/i)).toBeInTheDocument();
    // p50/p90 appear both in the stat strip and the sr-only table fallback.
    expect(screen.getAllByText("8.2m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("34.5m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});
