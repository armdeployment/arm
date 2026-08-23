import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoBar, DEMO_PERSONAS } from "../../src/components/demo-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

describe("DemoBar", () => {
  it("renders the sample-data badge", () => {
    render(<DemoBar />);
    expect(screen.getByTestId("sample-data-badge")).toBeInTheDocument();
  });

  it("lists every persona from apps/public's click paths", () => {
    render(<DemoBar />);
    const select = screen.getByLabelText(/view as persona/i);
    for (const persona of DEMO_PERSONAS) {
      expect(screen.getByRole("option", { name: persona.label })).toBeInTheDocument();
    }
    expect(select).toBeInTheDocument();
  });

  it("navigates to the selected persona's landing route", () => {
    render(<DemoBar />);
    const select = screen.getByLabelText(/view as persona/i);
    fireEvent.change(select, { target: { value: "infosec" } });
    expect(push).toHaveBeenCalledWith("/audit");
  });
});
