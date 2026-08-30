import { describe, it, expect } from "vitest";
import { classifyPainPoints } from "../src/pain-points.js";

describe("classifyPainPoints", () => {
  it("matches a budget/approval pain point to senior_manager", () => {
    const tags = classifyPainPoints("I spend most of my week chasing budget approvals from my team");
    const match = tags.find((t) => t.tag === "budget_approval_pain");
    expect(match).toBeDefined();
    expect(match?.jobFunctionHint).toBe("senior_manager");
    expect(match?.matchedKeywords).toContain("approval");
    expect(match?.matchedKeywords).toContain("budget");
  });

  it("matches a design-release pain point to design_release_engineer", () => {
    const tags = classifyPainPoints("Tracking ECN impacts across the BOM takes forever, and PPAP status is always unclear");
    const hints = tags.map((t) => t.jobFunctionHint);
    expect(hints).toContain("design_release_engineer");
  });

  it("is case-insensitive", () => {
    const tags = classifyPainPoints("BUDGET approvals are a nightmare");
    expect(tags.some((t) => t.tag === "budget_approval_pain")).toBe(true);
  });

  it("returns an empty array for text matching nothing", () => {
    const tags = classifyPainPoints("the weather has been nice lately");
    expect(tags).toEqual([]);
  });

  it("returns an empty array for empty text", () => {
    expect(classifyPainPoints("")).toEqual([]);
  });

  it("is pure — identical input always yields identical output", () => {
    const text = "chasing status updates and blockers across teams all week, plus budget approvals";
    const first = classifyPainPoints(text);
    const second = classifyPainPoints(text);
    expect(second).toEqual(first);
  });

  it("can match multiple distinct pain points in one write-up", () => {
    const tags = classifyPainPoints(
      "Half my day is budget approvals, the other half is chasing status updates and blockers from other teams",
    );
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain("budget_approval_pain");
    expect(tagNames).toContain("status_reporting_pain");
  });
});
