/**
 * Work-type classifier type definitions (D7).
 *
 * `packages/classifier` is a LEAF package — zero internal imports, sits beside
 * `profiles`/`proto`/`config` in the dependency DAG. The classifier runs in the
 * data plane (inside the tenant VPC, Invariant 1) and never makes an LLM call
 * per prompt. The only LLM spend is a sampled QA judge (offline, batch cron).
 */

import type { WorkTypeStage } from "@arm/proto";

export type { WorkTypeStage } from "@arm/proto";

// ── Taxonomy ───────────────────────────────────────────────────────────────

/**
 * A work-type taxonomy for one scope (department / plant / workstream).
 * Loaded from `WorkTypeTaxonomy` rows (control-plane config) by the proxy.
 */
export interface WorkTypeTaxonomy {
  /** Stable scope id this taxonomy applies to (the agent's department). */
  scopeId: string;
  scopeType: string;
  /** Human-readable name (e.g. "Engineering"). */
  name: string;
  /** Ordered primary labels the classifier picks from. */
  labels: string[];
  /** Monotonic version — incremented on label edits (re-labeling guard). */
  classifierVersion: string;
  /** Optional secondary structural-tag presets. */
  secondaryTagPresets?: string[];
}

// ── Classification result ───────────────────────────────────────────────────

/**
 * The output of the classification cascade for one prompt.
 * `unknown` is a first-class label: stored as-is, never guessed.
 */
export interface WorkTypeResult {
  /** Primary work-type label. `unknown` when the cascade couldn't classify. */
  workType: string;
  /** Secondary structural tags (≤5): tool names, model ids, etc. */
  usageTags: string[];
  /** Which cascade stage resolved the label. */
  stage: WorkTypeStage;
  /** Confidence 0–1 (stage-dependent). NULL for `unknown`. */
  confidence: number | null;
  /** Taxonomy version at classification time (re-labeling guard). */
  classifierVersion: string;
}

// ── Cascade input ───────────────────────────────────────────────────────────

/**
 * Structured features already known at call time (no LLM call needed).
 * These are the freebies stage 1 consumes — all present in the proxy already.
 */
export interface PromptFeatures {
  /** The prompt body (stays in-VPC; never logged to control plane). */
  promptText: string;
  /** Model id requested, e.g. "claude-sonnet-4", "qwen3.5". */
  modelId: string;
  /** Agent type from the request — opencode / claude_code / copilot / pi. */
  agentType: string;
  /** The agent's static taskType (§1.3) — a structural signal, not the label. */
  taskType?: string;
  /** Department name the agent belongs to (selects the taxonomy). */
  departmentName?: string;
  /** Tool-call names present in the prompt, if any (e.g. ["web_search"]). */
  toolCallNames?: string[];
  /** File paths/extensions in the prompt, if any. */
  fileExtensions?: string[];
  /** Priority tier of the agent (structural signal). */
  priorityTier?: string;
}

// ── Classifier config ───────────────────────────────────────────────────────

export interface ClassifierConfig {
  /** LRU cache size for prompt-hash → label (stage 2). Default 10_000. */
  cacheMaxEntries: number;
  /** Stage 3 linear-classifier confidence threshold; below → stage 4. */
  linearConfidenceThreshold: number;
  /** Stage 4 embedding-centroid confidence threshold; below → unknown. */
  embeddingConfidenceThreshold: number;
  /** Max secondary tags (sub-decision D7.s1: 1 + ≤5). Default 5. */
  maxSecondaryTags: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  cacheMaxEntries: 10_000,
  linearConfidenceThreshold: 0.7,
  embeddingConfidenceThreshold: 0.6,
  maxSecondaryTags: 5,
};
