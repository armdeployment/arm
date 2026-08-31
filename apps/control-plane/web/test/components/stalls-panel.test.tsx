import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StallsPanelView, type StallRow } from "../../src/components/adoption/stalls-panel";

const ROWS: StallRow[] = [
  {
    step: "installed",
    errorCode: "mdm_push_failed",
    label: "MDM push failed on corporate device",
    count: 30,
    share: 45.2,
  },
  {
    step: "connections_completed",
    errorCode: "jira_auth_failed",
    label: "Failed connecting Jira",
    count: 9,
    share: 13.6,
  },
];

describe("StallsPanelView", () => {
  it("loading: renders a skeleton", () => {
    render(<StallsPanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
  });

  it("error: renders an alert", () => {
    render(<StallsPanelView status="error" errorMessage="boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });

  it("empty: renders when rows is empty (clean funnel — no stalls)", () => {
    render(<StallsPanelView status="ready" rows={[]} />);
    expect(screen.getByText(/converting cleanly/i)).toBeInTheDocument();
  });

  it("populated: renders plain-language labels, never raw snake_case codes, via the accessible table", () => {
    render(<StallsPanelView status="ready" rows={ROWS} />);
    expect(screen.getByText(/MDM push failed on corporate device/)).toBeInTheDocument();
    expect(screen.getByText(/Failed connecting Jira/)).toBeInTheDocument();
    expect(screen.queryByText("mdm_push_failed")).not.toBeInTheDocument();
  });
});
