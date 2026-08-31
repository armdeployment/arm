/**
 * Pain-point free-text classification (installation wizard step 2b,
 * docs/solutions/2026-08-25-gtm-market-tiers-and-wizard-plan.md).
 *
 * A5 / Invariant 1: `@arm/questionnaire` is deliberately pure and
 * deterministic with no LLM in reach (guide 00 §9's questionnaire-
 * determinism guardrail), and prompt/content data never leaves the tenant
 * VPC (spec §11.1). Free text an employee types here must never be logged,
 * stored, or transmitted by any caller of this function — only this
 * function's structured return value (tags) is meant to cross into a
 * questionnaire answer, the same trust boundary as a multiple-choice pick.
 *
 * v1 is intentionally a local, deterministic keyword match — not an
 * embedding model, not an LLM call. That's a real limitation (recall over
 * paraphrase is weak), but it means every match is auditable by construction
 * ("why did I get tagged X" always has a one-line answer: these keywords
 * matched) and it makes zero network calls, so it can run before any model
 * routing exists on the machine. A richer version could route through the
 * tenant's own data-plane proxy later — it must never call ARM's control
 * plane or any third-party API directly with this text.
 */

export interface PainPointTag {
  tag: string;
  jobFunctionHint: string;
  matchedKeywords: string[];
}

interface KeywordRule {
  tag: string;
  jobFunctionHint: string;
  keywords: string[];
}

const RULES: KeywordRule[] = [
  {
    tag: "budget_approval_pain",
    jobFunctionHint: "senior_manager",
    keywords: ["approve", "approval", "budget", "spend", "sign off", "sign-off"],
  },
  {
    tag: "status_reporting_pain",
    jobFunctionHint: "project_manager",
    keywords: ["status update", "blocker", "timeline", "cross-team", "stakeholder"],
  },
  {
    tag: "design_release_pain",
    jobFunctionHint: "design_release_engineer",
    keywords: ["ecn", "ppap", "design release", "bom", "plm"],
  },
  {
    tag: "cad_pain",
    jobFunctionHint: "design_release_engineer",
    keywords: ["cad", "solidworks", "teamcenter", "windchill", "drawing"],
  },
  {
    tag: "code_review_pain",
    jobFunctionHint: "software_engineer",
    keywords: ["pull request", "code review", "pr review", "merge conflict"],
  },
  {
    tag: "ticket_triage_pain",
    jobFunctionHint: "support_engineer",
    keywords: ["ticket", "customer issue", "triage", "zendesk"],
  },
  {
    tag: "spec_writing_pain",
    jobFunctionHint: "product_manager",
    keywords: ["spec", "prd", "roadmap", "prioritiz"],
  },
  {
    tag: "quality_inspection_pain",
    jobFunctionHint: "quality_engineer",
    keywords: ["defect", "inspection", "spc", "control plan", "nonconform"],
  },
  {
    tag: "maintenance_pain",
    jobFunctionHint: "maintenance_technician",
    keywords: ["downtime", "breakdown", "preventive maintenance", "work order"],
  },
];

/** Classify free-text pain points into structured tags. Pure — same text
 *  always yields the same tags, no I/O, no randomness. */
export function classifyPainPoints(text: string): PainPointTag[] {
  const normalized = text.toLowerCase();
  const results: PainPointTag[] = [];
  for (const rule of RULES) {
    const matched = rule.keywords.filter((keyword) => normalized.includes(keyword));
    if (matched.length > 0) {
      results.push({
        tag: rule.tag,
        jobFunctionHint: rule.jobFunctionHint,
        matchedKeywords: matched,
      });
    }
  }
  return results;
}
