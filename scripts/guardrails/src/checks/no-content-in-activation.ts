/**
 * guardrail: no-content-in-activation (D10, guide 00 §9 — extends
 * `no-content-egress`; STUB scope owned by `client` for future extension,
 * but implemented for real here since it only needs contracts `contracts`
 * already ships).
 *
 * Polices: `activationEventSchema` carries no content-bearing field name
 * (mirrors `no-content-egress`'s FORBIDDEN-substring scan, applied to the
 * proto schema instead of ClickHouse SQL — the two guards are redundant by
 * design: SQL column names AND the zod schema field names must both stay
 * clean); and `questionnaireAnswerSchema`'s companion type,
 * `questionNodeSchema.kind`, never re-admits a `"text"` question kind — THAT
 * is the actual A5 enforcement point (questionnaireAnswerSchema's *values*
 * are typed `string | string[] | number | boolean`, which on its own would
 * still permit an arbitrary string; what makes it non-free-text is that no
 * question node can ever collect one, because `kind` has no `"text"`
 * option — guide 00 §5.1 note).
 *
 * Unlike the other 4 new D10 stubs, this one scans real, already-shipped
 * data (the `@arm/proto` schemas landed in this same PR) — so it is
 * non-vacuous and PASSING today, not a placeholder awaiting Wave 1.
 */

import { register, type CheckResult } from "../types.js";

const FORBIDDEN = [
  "prompt",
  "completion",
  "response_text",
  "response_body",
  "content",
  "body",
  "secret",
  "free_text",
  "answer_text",
  "raw_text",
];

/** Allowlist of substrings that look forbidden but are safe. */
const SAFE = ["job_function_key"];

export interface ActivationContentCheckInput {
  /** Field names of activationEventSchema.shape. */
  activationFields: string[];
  /** Enum values of questionNodeSchema.shape.kind (guide 00 §5.1). */
  questionKinds: string[];
}

/** Pure function form — used by mutation proofs. */
export function checkNoContentInActivation(input: ActivationContentCheckInput): CheckResult {
  const violations: string[] = [];
  for (const f of input.activationFields) {
    const lower = f.toLowerCase();
    if (SAFE.some((s) => lower === s)) continue;
    const hit = FORBIDDEN.find((needle) => lower.includes(needle));
    if (hit) violations.push(`activation_event.${f} (matched "${hit}")`);
  }
  if (input.questionKinds.includes("text")) {
    violations.push(
      `questionNodeSchema.kind admits "text" — A5 forbids free-text questionnaire input`,
    );
  }
  const scanned = input.activationFields.length + input.questionKinds.length;
  if (violations.length > 0) {
    return {
      id: "no-content-in-activation",
      status: "fail",
      detail: `content-bearing surface detected (Invariant 1 / A5): ${violations.join(", ")}`,
      scanned,
      assertsNegative: true,
    };
  }
  return { id: "no-content-in-activation", status: "pass", scanned, assertsNegative: true };
}

register({
  id: "no-content-in-activation",
  description:
    "activationEventSchema carries no content-bearing field name, and questionNodeSchema.kind never re-admits a free-text question kind (Invariant 1 / A5, extends no-content-egress).",
  invariant: "§11.1 + A5: structured-answers-only questionnaire, metadata-only activation events",
  run: async () => {
    const proto = await import("@arm/proto");
    const activationFields = Object.keys(proto.activationEventSchema.shape);
    const questionKinds = [...proto.questionNodeSchema.shape.kind.options] as string[];
    return checkNoContentInActivation({ activationFields, questionKinds });
  },
});
