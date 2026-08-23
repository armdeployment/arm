/**
 * Every shipped graph must be well-formed (validate.ts), and must contain
 * no "text" question kind anywhere (A5 — enforced independently by the
 * no-content-in-activation guardrail against questionNodeSchema itself, but
 * checked here too as a fast, graph-specific regression test).
 */

import { describe, it, expect } from "vitest";
import { validateGraph } from "../src/validate.js";
import { SHIPPED_GRAPHS, graphForIndustryProfile, manufacturingV1, techV1, genericV1 } from "../src/index.js";

describe("shipped graphs are well-formed", () => {
  for (const [profile, graph] of Object.entries(SHIPPED_GRAPHS)) {
    it(`${profile} graph passes validateGraph`, () => {
      const result = validateGraph(graph);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it(`${profile} graph has 6-9 questions and no free-text kind (A5)`, () => {
      expect(graph.nodes.length).toBeGreaterThanOrEqual(6);
      expect(graph.nodes.length).toBeLessThanOrEqual(9);
      for (const node of graph.nodes) {
        expect(node.kind).not.toBe("text");
        expect(["single", "multi", "scale"]).toContain(node.kind);
      }
    });
  }
});

describe("graphForIndustryProfile", () => {
  it("resolves known profiles directly", () => {
    expect(graphForIndustryProfile("manufacturing")).toBe(manufacturingV1);
    expect(graphForIndustryProfile("tech")).toBe(techV1);
    expect(graphForIndustryProfile("generic")).toBe(genericV1);
  });

  it("falls back to generic for an unknown profile", () => {
    expect(graphForIndustryProfile("logistics")).toBe(genericV1);
  });
});
