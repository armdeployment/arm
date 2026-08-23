import { describe, it, expect } from "vitest";
import { recommendForJobFunction, type RecommendCandidate } from "../src/recommend.js";

function candidate(overrides: Partial<RecommendCandidate>): RecommendCandidate {
  return {
    slug: "x",
    jobFunctions: [],
    reviewStatus: "approved",
    installCountByDepartment: {},
    publishedAt: null,
    ...overrides,
  };
}

describe("recommendForJobFunction", () => {
  it("excludes non-approved candidates entirely (required, not weighted)", () => {
    const candidates = [
      candidate({ slug: "draft", reviewStatus: "draft", jobFunctions: ["qe"] }),
      candidate({ slug: "approved", jobFunctions: ["qe"] }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe" });
    expect(r.map((c) => c.slug)).toEqual(["approved"]);
  });

  it("job-function match scores higher than a non-matching candidate", () => {
    const candidates = [
      candidate({ slug: "match", jobFunctions: ["qe"] }),
      candidate({ slug: "no-match", jobFunctions: ["other"] }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe" });
    expect(r[0]!.slug).toBe("match");
    expect(r[0]!.score).toBeGreaterThan(r[1]!.score);
  });

  it("same-department install count adds to the score", () => {
    const candidates = [
      candidate({ slug: "popular", jobFunctions: ["qe"], installCountByDepartment: { dept1: 20 } }),
      candidate({ slug: "unused", jobFunctions: ["qe"], installCountByDepartment: {} }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe", departmentId: "dept1" });
    expect(r[0]!.slug).toBe("popular");
  });

  it("install counts from OTHER departments do not count", () => {
    const candidates = [
      candidate({ slug: "a", jobFunctions: ["qe"], installCountByDepartment: { dept2: 100 } }),
      candidate({ slug: "b", jobFunctions: ["qe"], installCountByDepartment: {} }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe", departmentId: "dept1" });
    expect(r[0]!.score).toBe(r[1]!.score); // both zero — dept2 count irrelevant to dept1 requester
  });

  it("recency tiebreak: newer publishedAt wins when scores tie", () => {
    const candidates = [
      candidate({ slug: "older", jobFunctions: ["qe"], publishedAt: "2026-01-01T00:00:00Z" }),
      candidate({ slug: "newer", jobFunctions: ["qe"], publishedAt: "2026-06-01T00:00:00Z" }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe" });
    expect(r.map((c) => c.slug)).toEqual(["newer", "older"]);
  });

  it("final tiebreak: slug ascending when score AND recency tie", () => {
    const candidates = [
      candidate({ slug: "zeta", jobFunctions: ["qe"] }),
      candidate({ slug: "alpha", jobFunctions: ["qe"] }),
    ];
    const r = recommendForJobFunction(candidates, { jobFunctionKey: "qe" });
    expect(r.map((c) => c.slug)).toEqual(["alpha", "zeta"]);
  });

  it("is deterministic: same input always produces the same ordering", () => {
    const candidates = [
      candidate({ slug: "a", jobFunctions: ["qe"], installCountByDepartment: { d: 5 } }),
      candidate({ slug: "b", jobFunctions: ["qe"], installCountByDepartment: { d: 3 } }),
      candidate({ slug: "c", jobFunctions: [] }),
    ];
    const input = { jobFunctionKey: "qe", departmentId: "d" };
    const r1 = recommendForJobFunction(candidates, input).map((c) => c.slug);
    const r2 = recommendForJobFunction(candidates, input).map((c) => c.slug);
    expect(r1).toEqual(r2);
  });

  it("no LLM / no randomness — pure function of its inputs", () => {
    // Structural proof: calling twice with fresh array copies yields identical results.
    const candidates: RecommendCandidate[] = [candidate({ slug: "a", jobFunctions: ["qe"] })];
    const a = recommendForJobFunction([...candidates], { jobFunctionKey: "qe" });
    const b = recommendForJobFunction([...candidates], { jobFunctionKey: "qe" });
    expect(a).toEqual(b);
  });
});
