/**
 * score() determinism (docs/guides/03-client-downloader.md §2.1): same
 * answers + same graph ⇒ byte-identical output. The property test proves
 * this holds regardless of the answer object's key insertion order —
 * shuffling must never change the ranked result.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { score, topJobFunction } from "../src/score.js";
import { manufacturingV1 } from "../src/graphs/manufacturing.v1.js";
import type { QuestionnaireAnswer } from "@arm/proto";

describe("score — manufacturing graph", () => {
  it("ranks maintenance_technician top for a maintenance-heavy answer set", () => {
    const answers: QuestionnaireAnswer = {
      role_cluster: "maintenance",
      weekly_tasks: ["troubleshoot_equipment", "preventive_maintenance"],
      systems: ["cmms"],
    };
    const ranked = score(answers, manufacturingV1);
    expect(ranked[0]?.key).toBe("maintenance_technician");
    expect(topJobFunction(answers, manufacturingV1)).toBe("maintenance_technician");
  });

  it("accumulates weight across multiple signals for the same job function", () => {
    const partial: QuestionnaireAnswer = { role_cluster: "plc" }; // weight 3
    const full: QuestionnaireAnswer = {
      role_cluster: "plc", // weight 3
      code_plc: "yes", // weight 2 -> plc_programmer
    };
    const partialScore = score(partial, manufacturingV1).find(
      (r) => r.key === "plc_programmer",
    )!.weight;
    const fullScore = score(full, manufacturingV1).find((r) => r.key === "plc_programmer")!.weight;
    expect(fullScore).toBeGreaterThan(partialScore);
    expect(fullScore).toBe(5);
  });

  it("ignores answers referencing unknown nodes or option values", () => {
    const answers = {
      not_a_real_node: "x",
      role_cluster: "not_a_real_option",
    } as QuestionnaireAnswer;
    expect(score(answers, manufacturingV1)).toEqual([]);
  });

  it("returns an empty ranking for empty answers", () => {
    expect(score({}, manufacturingV1)).toEqual([]);
    expect(topJobFunction({}, manufacturingV1)).toBeNull();
  });

  it("none_of_these carries no job-function signal", () => {
    expect(score({ role_cluster: "none_of_these" }, manufacturingV1)).toEqual([]);
  });

  it("tie-breaks equal weights by job-function key ascending", () => {
    const answers: QuestionnaireAnswer = {
      weekly_tasks: ["troubleshoot_equipment", "review_inspection_reports"], // both weight 1
    };
    const ranked = score(answers, manufacturingV1);
    expect(ranked.map((r) => r.key)).toEqual(["maintenance_technician", "quality_engineer"]);
  });
});

describe("score determinism — answer order never affects the result (property test)", () => {
  const answerEntry = fc.oneof(
    fc.record({
      nodeId: fc.constant("role_cluster"),
      value: fc.constantFrom(
        "maintenance",
        "quality",
        "plc",
        "planning",
        "office",
        "exec_support",
        "none_of_these",
      ),
    }),
    fc.record({
      nodeId: fc.constant("weekly_tasks"),
      value: fc.uniqueArray(
        fc.constantFrom(
          "troubleshoot_equipment",
          "preventive_maintenance",
          "review_inspection_reports",
          "run_spc_charts",
          "write_plc_logic",
          "debug_ladder_logic",
          "track_inventory",
          "review_mrp_exceptions",
          "draft_emails_schedule_meetings",
          "prepare_exec_briefings",
        ),
      ),
    }),
    fc.record({
      nodeId: fc.constant("systems"),
      value: fc.uniqueArray(
        fc.constantFrom("jira", "sap", "cmms", "sharepoint", "tia_portal", "studio5000"),
      ),
    }),
    fc.record({ nodeId: fc.constant("code_plc"), value: fc.constantFrom("yes", "no") }),
  );

  it("shuffling the answers object's key order never changes score()'s result", () => {
    fc.assert(
      fc.property(fc.uniqueArray(answerEntry, { selector: (e) => e.nodeId }), (entries) => {
        const forward: QuestionnaireAnswer = {};
        for (const e of entries) forward[e.nodeId] = e.value;

        const shuffled: QuestionnaireAnswer = {};
        for (const e of [...entries].reverse()) shuffled[e.nodeId] = e.value;

        expect(score(shuffled, manufacturingV1)).toEqual(score(forward, manufacturingV1));
      }),
    );
  });

  it("score is a pure function — calling it twice with the same input is byte-identical", () => {
    fc.assert(
      fc.property(fc.uniqueArray(answerEntry, { selector: (e) => e.nodeId }), (entries) => {
        const answers: QuestionnaireAnswer = {};
        for (const e of entries) answers[e.nodeId] = e.value;
        expect(score(answers, manufacturingV1)).toEqual(score(answers, manufacturingV1));
      }),
    );
  });
});
