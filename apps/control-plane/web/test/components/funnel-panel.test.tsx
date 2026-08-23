/**
 * FunnelPanelView tests — loading/empty/error/populated (guide 02 §7).
 * Tests the presentational view directly (no tRPC/network mocking needed);
 * the data-fetching container (FunnelPanel) is exercised by e2e.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FunnelPanelView, type FunnelStepRow } from "../../src/components/adoption/funnel-panel";

const STEPS: FunnelStepRow[] = [
  { step: "invited", label: "Invited", count: 100, conversionFromPrev: null },
  { step: "questionnaire_started", label: "Questionnaire started", count: 80, conversionFromPrev: 80 },
  { step: "weekly_active", label: "Weekly active", count: 40, conversionFromPrev: 50 },
];

describe("FunnelPanelView", () => {
  it("loading: renders a skeleton, no data rows", () => {
    render(<FunnelPanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /activation funnel/i })).not.toBeInTheDocument();
  });

  it("error: renders an alert with the error message", () => {
    render(<FunnelPanelView status="error" errorMessage="network down" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("empty: renders when steps is an empty array", () => {
    render(<FunnelPanelView status="ready" steps={[]} />);
    expect(screen.getByText(/no activation events/i)).toBeInTheDocument();
  });

  it("empty: renders when every step count is zero (e.g. a coverage-gap job function)", () => {
    render(<FunnelPanelView status="ready" steps={STEPS.map((s) => ({ ...s, count: 0, conversionFromPrev: null }))} />);
    expect(screen.getByText(/no activation events/i)).toBeInTheDocument();
  });

  it("populated: renders every step's label and count, and an accessible table fallback", () => {
    render(<FunnelPanelView status="ready" steps={STEPS} />);
    for (const s of STEPS) {
      // Each label appears twice: once in the visible list, once in the
      // sr-only accessible table fallback (WCAG 2.1 AA — guide 02 §2).
      expect(screen.getAllByText(s.label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("40").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/activation funnel — step, count, conversion/i)).toBeInTheDocument();
  });

  it("populated: clicking a step calls onStepClick with that step", () => {
    const onStepClick = vi.fn();
    render(<FunnelPanelView status="ready" steps={STEPS} onStepClick={onStepClick} />);
    fireEvent.click(screen.getByRole("button", { name: /questionnaire started/i }));
    expect(onStepClick).toHaveBeenCalledWith("questionnaire_started");
  });

  it("shows the sample-data badge when meta.sampleData is true", () => {
    render(<FunnelPanelView status="ready" steps={STEPS} sampleData />);
    expect(screen.getByTestId("sample-data-badge")).toBeInTheDocument();
  });
});
