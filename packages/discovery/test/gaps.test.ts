import { describe, it, expect } from "vitest";
import { computeGaps } from "../src/gaps.js";

describe("computeGaps", () => {
  it("returns job functions with weight > 0 and no covering package", () => {
    const jobFunctions = [
      { key: "quality_engineer", headcountWeight: 14 },
      { key: "covered_role", headcountWeight: 10 },
    ];
    const packages = [{ packageId: "p1", jobFunctions: ["covered_role"] }];
    const gaps = computeGaps(jobFunctions, packages);
    expect(gaps.map((g) => g.key)).toEqual(["quality_engineer"]);
  });

  it("excludes zero-weight job functions even if uncovered", () => {
    const jobFunctions = [{ key: "zero_weight", headcountWeight: 0 }];
    const gaps = computeGaps(jobFunctions, []);
    expect(gaps).toEqual([]);
  });

  it("ranks by headcountWeight descending", () => {
    const jobFunctions = [
      { key: "low", headcountWeight: 5 },
      { key: "high", headcountWeight: 45 },
      { key: "mid", headcountWeight: 14 },
    ];
    const gaps = computeGaps(jobFunctions, []);
    expect(gaps.map((g) => g.key)).toEqual(["high", "mid", "low"]);
  });

  it("breaks weight ties by key ascending (deterministic)", () => {
    const jobFunctions = [
      { key: "zeta", headcountWeight: 10 },
      { key: "alpha", headcountWeight: 10 },
    ];
    const gaps = computeGaps(jobFunctions, []);
    expect(gaps.map((g) => g.key)).toEqual(["alpha", "zeta"]);
  });

  it("a job function covered by ANY package version is not a gap, even among many packages", () => {
    const jobFunctions = [{ key: "x", headcountWeight: 10 }];
    const packages = [
      { packageId: "p1", jobFunctions: ["other"] },
      { packageId: "p2", jobFunctions: ["x"] },
    ];
    expect(computeGaps(jobFunctions, packages)).toEqual([]);
  });

  it("returns [] on empty job-function input (not vacuously all-gaps)", () => {
    expect(computeGaps([], [])).toEqual([]);
  });
});
