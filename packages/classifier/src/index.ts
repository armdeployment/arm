/**
 * Work-type classifier package entry point (D7).
 *
 * `packages/classifier` is a LEAF package — zero internal imports except
 * `@arm/proto` (for the WorkTypeStage enum type). The classifier runs in the
 * data plane (Closed-Proxy / Open-Gateway) inside the tenant VPC.
 *
 * The cascade never makes an LLM call per prompt. The only LLM spend is a
 * sampled QA judge (1–5%, batch cron) — not in this hot path.
 *
 * Usage:
 *   const result = await classifyPrompt(features, taxonomy);
 *   // => { workType: "code_review", stage: "linear", confidence: 0.85, ... }
 */

export { classifyPrompt, resetCache, cacheSize } from "./cascade";
export type {
  WorkTypeTaxonomy,
  WorkTypeResult,
  PromptFeatures,
  ClassifierConfig,
  WorkTypeStage,
} from "./types";
export { DEFAULT_CLASSIFIER_CONFIG } from "./types";
