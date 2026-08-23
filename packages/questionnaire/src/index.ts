/**
 * @arm/questionnaire — pure, deterministic questionnaire → job function →
 * package recommendation engine (docs/guides/03-client-downloader.md §2).
 *
 * Deps: `@arm/proto` and `@arm/config` ONLY, enforced by both the
 * `boundaries` guardrail (contracts-owned) and `questionnaire-determinism`
 * (this module's own guard, guide 00 §9 / guide 03 §8). No `fetch`,
 * `Date.now`, `Math.random`, `crypto.randomUUID`, or `process.env` reachable
 * from score.ts or recommend.ts — same answers + same catalog index ⇒
 * byte-identical output, forever. This is what makes a recommendation
 * auditable when a manager asks why an employee got a package.
 */

export { nextQuestion, isComplete, progress } from "./graph.js";
export { score, topJobFunction } from "./score.js";
export type { RankedJobFunction } from "./score.js";
export { recommend } from "./recommend.js";
export type { CatalogPackageEntry, CatalogIndex, RecommendedPackage } from "./recommend.js";
export { validateGraph } from "./validate.js";
export type { ValidateResult } from "./validate.js";

export { manufacturingV1 } from "./graphs/manufacturing.v1.js";
export { techV1 } from "./graphs/tech.v1.js";
export { genericV1 } from "./graphs/generic.v1.js";

import { manufacturingV1 } from "./graphs/manufacturing.v1.js";
import { techV1 } from "./graphs/tech.v1.js";
import { genericV1 } from "./graphs/generic.v1.js";
import type { QuestionnaireGraph } from "@arm/proto";

/** All shipped graphs, keyed by `industry_profile` — the lookup
 *  `onboarding-router.ts`'s `getQuestionnaire` uses for a tenant's profile,
 *  falling back to `generic` when a tenant has no dedicated graph. */
export const SHIPPED_GRAPHS: Record<string, QuestionnaireGraph> = {
  manufacturing: manufacturingV1,
  tech: techV1,
  generic: genericV1,
};

/** Resolve the graph for an industry profile, falling back to generic. */
export function graphForIndustryProfile(industryProfile: string): QuestionnaireGraph {
  return SHIPPED_GRAPHS[industryProfile] ?? genericV1;
}
