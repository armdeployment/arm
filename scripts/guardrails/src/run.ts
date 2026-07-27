/**
 * Guardrail runner. Discovers all registered checks, applies the vacuous-guard
 * rule (§14.2), and exits non-zero on any failure.
 *
 * Used by `pnpm guardrails` and CI. Mutation proofs live in test/ and call the
 * same check fns directly (see §14.2).
 */

import { REGISTRY, type CheckResult } from "./types.js";
// Side-effect import: registers all checks into REGISTRY.
import "./index.js";

function applyVacuousGuardRule(r: CheckResult): CheckResult {
  if (r.assertsNegative && r.scanned === 0 && r.status === "pass") {
    return {
      ...r,
      status: "fail",
      detail:
        (r.detail ?? r.id) +
        " — VACUOUS GUARD: asserted a negative over an empty input set. " +
          "A lint that scans zero files is red, not green (spec §14.2).",
    };
  }
  return r;
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];
  for (const check of REGISTRY) {
    const raw = await check.run();
    results.push(applyVacuousGuardRule(raw));
  }

  const failures = results.filter((r) => r.status === "fail");
  for (const r of results) {
    const check = REGISTRY.find((c) => c.id === r.id);
    const mark = r.status === "pass" ? "✓" : "✗";
    const inv = check ? ` [${check.invariant}]` : "";
    const detail = r.detail ? ` — ${r.detail}` : "";
    console.log(`${mark} ${r.id}${inv}${detail}`);
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`All ${results.length} guardrails passed.`);
    return;
  }
  console.error(`${failures.length}/${results.length} guardrails FAILED.`);
  process.exit(1);
}

void main();
