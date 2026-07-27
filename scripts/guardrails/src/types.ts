/**
 * Guardrail contract + runner (spec §14.2).
 *
 * Every check returns a CheckResult. A check is:
 *   - PASS  if it found the protected property present and no violations.
 *   - FAIL  if it found a concrete violation.
 *   - VACUOUS (treated as FAIL) if it asserted a negative over an EMPTY input set.
 *
 * A lint that scans zero files is red, not green (spec §14.2 "vacuous guards").
 */

export type CheckStatus = "pass" | "fail";

export interface CheckResult {
  /** Stable id; referenced by mutation proofs and CI output. */
  id: string;
  status: CheckStatus;
  /** Human-readable finding. Required when status === "fail". */
  detail?: string;
  /** Inputs the check actually scanned. Vacuous-guard enforcement: a check
   *  asserting a negative (no violations) over an empty scanned set is FAIL. */
  scanned: number;
  /** Marks checks that assert a NEGATIVE ("no X found"). Subject to the
   *  vacuous-guard rule: if scanned === 0 and assertsNegative, the runner
   *  forces status to fail. */
  assertsNegative?: boolean;
}

export interface Check {
  id: string;
  description: string;
  /** Invariant this guard protects (docs/arm-spec.md §11 / §14.1). */
  invariant: string;
  run: () => CheckResult | Promise<CheckResult>;
}

export const REGISTRY: Check[] = [];

export function register(check: Check): Check {
  if (REGISTRY.some((c) => c.id === check.id)) {
    throw new Error(`duplicate guardrail id: ${check.id}`);
  }
  REGISTRY.push(check);
  return check;
}
