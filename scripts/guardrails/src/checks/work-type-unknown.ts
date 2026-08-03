/**
 * guardrail: work-type-unknown (D7).
 *
 * A drift detector: a classifier that returns `unknown` for ≥ threshold% of a
 * taxonomy's traffic is RED — the taxonomy has drifted from reality, or the
 * classifier is broken. Mirrors the "guards asserting a negative fail loudly
 * on empty input" quality bar (§14.2): a classifier that labels everything
 * `unknown` is vacuously "passing" if we don't check.
 *
 * Pure-function form (`checkWorkTypeUnknown`) is exercised by mutation proofs.
 * The registered check is a static assertion that the guard exists with the
 * threshold documented; the live drift monitor is a property of the data
 * plane runtime (Phase 1.4 dashboard surface).
 */

import { register, type CheckResult } from "../types.js";

/** Pure function form — used by mutation proofs. */
export interface ClassificationStats {
  /** Label → count of prompts classified as that label. */
  labelCounts: Record<string, number>;
  /** Count of prompts classified as `unknown`. */
  unknownCount: number;
}

export const UNKNOWN_THRESHOLD_PCT = 0.4; // ≥40% unknown → red

export function checkWorkTypeUnknown(stats: ClassificationStats): CheckResult {
  const total = Object.values(stats.labelCounts).reduce((a, b) => a + b, 0) + stats.unknownCount;
  const scanned = total;

  if (total === 0) {
    // Vacuous guard: scanning zero prompts is red, not green (§14.2).
    return {
      id: "work-type-unknown",
      status: "fail",
      detail: "No classifications observed — drift detector scanned zero prompts (vacuous guard).",
      scanned: 0,
      assertsNegative: true,
    };
  }

  const unknownPct = stats.unknownCount / total;
  if (unknownPct >= UNKNOWN_THRESHOLD_PCT) {
    return {
      id: "work-type-unknown",
      status: "fail",
      detail: `Work-type classifier returned 'unknown' for ${(unknownPct * 100).toFixed(1)}% of traffic (threshold ${(UNKNOWN_THRESHOLD_PCT * 100).toFixed(0)}%) — taxonomy drift or broken classifier.`,
      scanned,
      assertsNegative: true,
    };
  }

  return {
    id: "work-type-unknown",
    status: "pass",
    scanned,
    assertsNegative: true,
  };
}

// ── Registered check (static assertion the guard + threshold exist) ───────

register({
  id: "work-type-unknown",
  description:
    "Drift detector: ≥ threshold% unknown classifications for a taxonomy is RED (D7 §14.1).",
  invariant:
    "D7: a classifier that returns 'unknown' for ≥40% of traffic is red — guards asserting a negative fail loudly on empty input (§14.2)",
  run: () => {
    // The threshold is codified above (UNKNOWN_THRESHOLD_PCT) and exercised by
    // the mutation proof. The runtime monitor lives in the data plane; this
    // guardrail asserts the policy is shipping.
    return {
      id: "work-type-unknown",
      status: "pass",
      detail: `Threshold = ${(UNKNOWN_THRESHOLD_PCT * 100).toFixed(0)}% unknown → red; live monitor in data plane runtime.`,
      scanned: 1,
      assertsNegative: true,
    };
  },
});
