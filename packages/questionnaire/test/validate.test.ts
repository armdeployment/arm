import { describe, it, expect } from "vitest";
import { validateGraph } from "../src/validate.js";
import type { QuestionnaireGraph } from "@arm/proto";

function node(
  id: string,
  next: { when: string | null; goto: string | null }[],
): QuestionnaireGraph["nodes"][number] {
  return {
    id,
    kind: "single",
    prompt: `prompt ${id}`,
    help: "",
    options: [{ value: "a", label: "A", signals: { job_functions: [], components: [], weight: 1 } }],
    next,
  };
}

describe("validateGraph", () => {
  it("accepts a simple linear graph with a terminal", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [node("a", [{ when: null, goto: "b" }]), node("b", [{ when: null, goto: null }])],
    };
    expect(validateGraph(graph)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a missing entry node", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "missing",
      nodes: [node("a", [{ when: null, goto: null }])],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/entry node "missing" does not exist/);
  });

  it("rejects a dangling goto reference", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [node("a", [{ when: null, goto: "nowhere" }])],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown node "nowhere"'))).toBe(true);
  });

  it("rejects an unreachable node", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [
        node("a", [{ when: null, goto: null }]),
        node("orphan", [{ when: null, goto: null }]),
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"orphan" is unreachable'))).toBe(true);
  });

  it("rejects a cycle", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [node("a", [{ when: null, goto: "b" }]), node("b", [{ when: null, goto: "a" }])],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cycle detected"))).toBe(true);
    // No terminal either, since the only reachable nodes form a cycle.
    expect(result.errors.some((e) => e.includes("no terminal node"))).toBe(true);
  });

  it("rejects a graph with no terminal at all", () => {
    // Self-loop: "a" is its own only edge, never ends.
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [node("a", [{ when: null, goto: "a" }])],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no terminal node"))).toBe(true);
  });

  it("accepts a node with an empty next[] as terminal", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [node("a", [])],
    };
    expect(validateGraph(graph)).toEqual({ valid: true, errors: [] });
  });

  it("accepts branching graphs with a conditional edge + default edge", () => {
    const graph: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [
        node("a", [
          { when: "special", goto: "terminal_special" },
          { when: null, goto: "b" },
        ]),
        node("b", [{ when: null, goto: null }]),
        node("terminal_special", []),
      ],
    };
    expect(validateGraph(graph)).toEqual({ valid: true, errors: [] });
  });
});
