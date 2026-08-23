import { describe, it, expect } from "vitest";
import { nextQuestion, isComplete, progress } from "../src/graph.js";
import { manufacturingV1 } from "../src/graphs/manufacturing.v1.js";
import type { QuestionnaireGraph } from "@arm/proto";

describe("nextQuestion — manufacturing graph traversal", () => {
  it("returns the entry node with no answers", () => {
    const next = nextQuestion(manufacturingV1, {});
    expect(next?.id).toBe("location");
  });

  it("advances one question per answer", () => {
    const next = nextQuestion(manufacturingV1, { location: "plant_a" });
    expect(next?.id).toBe("role_cluster");
  });

  it("branches to the unmatched terminal on none_of_these", () => {
    const next = nextQuestion(manufacturingV1, { location: "plant_a", role_cluster: "none_of_these" });
    expect(next?.id).toBe("unmatched");
  });

  it("branches to weekly_tasks on a normal role_cluster answer", () => {
    const next = nextQuestion(manufacturingV1, { location: "plant_a", role_cluster: "maintenance" });
    expect(next?.id).toBe("weekly_tasks");
  });

  it("handles multi-select answers when advancing", () => {
    const next = nextQuestion(manufacturingV1, {
      location: "plant_a",
      role_cluster: "maintenance",
      weekly_tasks: ["troubleshoot_equipment", "preventive_maintenance"],
    });
    expect(next?.id).toBe("systems");
  });

  it("completes the flow through platform and reports isComplete", () => {
    const answers = {
      location: "plant_a",
      role_cluster: "maintenance",
      weekly_tasks: ["troubleshoot_equipment"],
      systems: ["cmms"],
      code_plc: "no",
      work_style: "chat_first",
      platform: "macos",
    };
    expect(nextQuestion(manufacturingV1, answers)).toBeNull();
    expect(isComplete(manufacturingV1, answers)).toBe(true);
  });

  it("is not complete partway through", () => {
    expect(isComplete(manufacturingV1, { location: "plant_a" })).toBe(false);
  });

  it("routes to the unmatched node (a final ack question) on none_of_these", () => {
    const answers = { location: "plant_a", role_cluster: "none_of_these" };
    expect(isComplete(manufacturingV1, answers)).toBe(false);
    expect(nextQuestion(manufacturingV1, answers)?.id).toBe("unmatched");
  });

  it("completes once the unmatched node's ack is answered", () => {
    const answers = { location: "plant_a", role_cluster: "none_of_these", unmatched: "ack" };
    expect(isComplete(manufacturingV1, answers)).toBe(true);
  });

  it("never loops forever on a malformed cyclic graph (defensive guard)", () => {
    const cyclic: QuestionnaireGraph = {
      version: 1,
      industry_profile: "test",
      entry: "a",
      nodes: [
        {
          id: "a",
          kind: "single",
          prompt: "p",
          help: "",
          options: [{ value: "x", label: "X", signals: { job_functions: [], components: [], weight: 1 } }],
          next: [{ when: null, goto: "b" }],
        },
        {
          id: "b",
          kind: "single",
          prompt: "p",
          help: "",
          options: [{ value: "x", label: "X", signals: { job_functions: [], components: [], weight: 1 } }],
          next: [{ when: null, goto: "a" }],
        },
      ],
    };
    // Both nodes already answered — traversal would otherwise loop a->b->a forever.
    const result = nextQuestion(cyclic, { a: "x", b: "x" });
    expect(result).toBeNull();
  });
});

describe("progress", () => {
  it("is 0 with no answers and increases monotonically", () => {
    expect(progress(manufacturingV1, {})).toBe(0);
    const p1 = progress(manufacturingV1, { location: "plant_a" });
    const p2 = progress(manufacturingV1, { location: "plant_a", role_cluster: "maintenance" });
    expect(p2).toBeGreaterThan(p1);
    expect(p1).toBeGreaterThan(0);
  });
});
