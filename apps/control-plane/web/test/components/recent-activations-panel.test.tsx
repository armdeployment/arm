import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RecentActivationsPanelView,
  type ActivationRow,
} from "../../src/components/adoption/recent-activations-panel";

const ROWS: ActivationRow[] = [
  {
    ts: "2026-08-20T12:00:00.000Z",
    orgNodeId: "dept_qa",
    userRef: "u_quality_engineer_3",
    jobFunctionKey: "quality_engineer",
    step: "weekly_active",
    outcome: "ok",
    errorCode: "",
  },
  {
    ts: "2026-08-20T11:00:00.000Z",
    orgNodeId: "dept_fin",
    userRef: "u_office_worker_general_9",
    jobFunctionKey: "office_worker_general",
    step: "installed",
    outcome: "error",
    errorCode: "mdm_push_failed",
  },
];

describe("RecentActivationsPanelView", () => {
  it("loading: renders a skeleton", () => {
    render(<RecentActivationsPanelView status="loading" />);
    expect(screen.getByTestId("panel-skeleton")).toBeInTheDocument();
  });

  it("error: renders an alert", () => {
    render(<RecentActivationsPanelView status="error" errorMessage="down" />);
    expect(screen.getByRole("alert")).toHaveTextContent("down");
  });

  it("empty: renders when activations is empty", () => {
    render(<RecentActivationsPanelView status="ready" activations={[]} />);
    expect(screen.getByText(/no recent activations/i)).toBeInTheDocument();
  });

  it("populated: renders pseudonymous user_ref values, never an email, in a table", () => {
    render(<RecentActivationsPanelView status="ready" activations={ROWS} />);
    expect(screen.getByText("u_quality_engineer_3")).toBeInTheDocument();
    expect(screen.getByText("u_office_worker_general_9")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("populated: renders outcome badges", () => {
    render(<RecentActivationsPanelView status="ready" activations={ROWS} />);
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
