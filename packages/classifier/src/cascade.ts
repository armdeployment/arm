/**
 * Work-type classification cascade (D7 §c).
 *
 * Zero-LLM-call cascade:
 *   Stage 1 — structural freebies (model_id, agent type, tool calls, file exts)
 *   Stage 2 — prompt-hash → label LRU cache (repeats are free)
 *   Stage 3 — linear keyword-matching classifier per taxonomy (µs)
 *   Stage 4 — embedding centroid (only when stage 3 confidence < threshold)
 *   QA     — sampled LLM judge (offline, NOT in this hot path)
 *
 * `unknown` is a first-class label — stored as-is, never guessed. The
 * classifier **fails open** for labeling (event emission): if it can't
 * classify in budget, the event is emitted with `unknown` and the call
 * proceeds. Work-type *gates* (Phase 1.4) will fail-closed per policy at
 * gate-design time — a separate decision from the tag.
 *
 * Runs inside the data plane (tenant VPC, Invariant 1). Never blocks or adds
 * tokens to the agent's call (§5.2 budget: stages 1–3 are sub-ms).
 */

import type {
  WorkTypeResult,
  WorkTypeTaxonomy,
  PromptFeatures,
  ClassifierConfig,
  WorkTypeStage,
} from "./types";
import { DEFAULT_CLASSIFIER_CONFIG } from "./types";

// ── Stage 2: bounded LRU cache (prompt-hash → label) ───────────────────────

interface CacheEntry {
  result: WorkTypeResult;
  ts: number;
}

class BoundedLRU {
  private map = new Map<string, CacheEntry>();
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.map.get(key);
    if (entry) {
      // Move to end (most-recently-used) by re-inserting.
      this.map.delete(key);
      this.map.set(key, entry);
    }
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    if (this.map.size >= this.max) {
      // Evict oldest (first key in insertion order).
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, entry);
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ── Hash function for the cache key ────────────────────────────────────────

async function hashPrompt(text: string): Promise<string> {
  // Use Web Crypto (available in Node 18+ and browsers).
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ── Stage 1: structural freebies ───────────────────────────────────────────

/**
 * Classify from already-present metadata: model_id, agent type, tool calls,
 * file extensions, priority tier. Covers ~60% of traffic with zero cost.
 */
function classifyStructural(
  features: PromptFeatures,
  taxonomy: WorkTypeTaxonomy,
): WorkTypeResult | null {
  const tags: string[] = [`model:${features.modelId}`];
  if (features.agentType) tags.push(`agent:${features.agentType}`);
  if (features.toolCallNames?.length) {
    for (const name of features.toolCallNames.slice(0, 3)) {
      tags.push(`tool:${name}`);
    }
  }

  // If the agent's static taskType IS a label in the taxonomy, we can label
  // structurally — but only when the prompt has no free-text intent signal
  // (i.e. it's purely tool-driven). This avoids mislabeling a free-text
  // "explain this bug" prompt as the static taskType.
  if (
    features.taskType &&
    taxonomy.labels.includes(features.taskType) &&
    features.toolCallNames &&
    features.toolCallNames.length > 0
  ) {
    return {
      workType: features.taskType,
      usageTags: tags.slice(0, 5),
      stage: "structural",
      confidence: 1.0,
      classifierVersion: taxonomy.classifierVersion,
    };
  }

  // File-extension → label mapping (structural signal common in coding agents).
  if (features.fileExtensions && features.fileExtensions.length > 0) {
    const label = inferLabelFromFileExtensions(features.fileExtensions, taxonomy);
    if (label) {
      return {
        workType: label,
        usageTags: [...tags, ...features.fileExtensions.map((e) => `file:${e}`)].slice(0, 5),
        stage: "structural",
        confidence: 0.95,
        classifierVersion: taxonomy.classifierVersion,
      };
    }
  }

  return null; // not resolvable structurally
}

/** Map file extensions to taxonomy labels when obvious. */
function inferLabelFromFileExtensions(
  extensions: string[],
  taxonomy: WorkTypeTaxonomy,
): string | null {
  const code = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "rb"];
  const test = ["test.ts", "spec.ts", "test.py", "spec.js"];
  const doc = ["md", "txt", "rst", "adoc"];

  const has = (arr: string[], ext: string) => arr.some((e) => ext.includes(e));

  for (const ext of extensions) {
    const lower = ext.toLowerCase();
    if (test.some((t) => lower.includes(t)) && taxonomy.labels.includes("test_generation")) {
      return "test_generation";
    }
    if (doc.includes(lower) && taxonomy.labels.includes("documentation")) {
      return "documentation";
    }
    if (code.some((c) => lower.includes(c))) {
      // Coding work — pick the matching label if present.
      if (taxonomy.labels.includes("code_review")) return "code_review";
      if (taxonomy.labels.includes("code_generation")) return "code_generation";
      if (taxonomy.labels.includes("hot_issue_resolution")) return "hot_issue_resolution";
    }
  }
  return null;
}

// ── Stage 3: linear keyword-matching classifier (µs) ───────────────────────

/**
 * A lightweight linear classifier: each label has a set of keyword patterns.
 * Score = sum of pattern matches; the highest-scoring label wins if above
 * threshold. This is the F1 0.85–0.92 tier — cheap, deterministic, in-VPC.
 *
 * In production this would be a fastText/TF-IDF-SGD ONNX model trained per
 * taxonomy. For Phase 1 we ship the keyword heuristic; the interface is
 * the same so the model can be swapped without touching the cascade.
 */
const LABEL_KEYWORD_MAP: Record<string, string[]> = {
  code_review: ["review", "diff", "pr", "pull request", "merge", "cr", "codecheck", "lint"],
  code_generation: ["implement", "generate", "write a function", "create", "build", "scaffold"],
  test_generation: ["test", "spec", "coverage", "assert", "expect", "mock", "fixture"],
  documentation: ["document", "docs", "readme", "explain", "comment", "docstring", "guide"],
  hot_issue_resolution: ["bug", "fix", "error", "crash", "issue", "traceback", "stack trace", "hotfix"],
  incident_triage: ["incident", "alert", "page", "oncall", "outage", "sev", "triage"],
  cnc_toolpath_optimization: ["cnc", "toolpath", "gcode", "g-code", "feed rate", "spindle", "machining"],
  defect_analysis: ["defect", "spc", "quality", "inspection", "reject", "yield", "tolerance"],
  demand_forecasting: ["forecast", "demand", "inventory", "supply", "planning", "reorder", "stock"],
  route_optimization: ["route", "logistics", "shipping", "dispatch", "delivery", "vehicle routing"],
  risk_assessment: ["risk", "exposure", "var", "value at risk", "stress test", "limit"],
  compliance_review: ["compliance", "regulation", "sox", "glba", "pci", "audit", "policy"],
  trade_analysis: ["trade", "order", "position", "fill", "execution", "alpha", "signal"],
  quant_research: ["quant", "model", "backtest", "alpha", "factor", "sharpe", "portfolio"],
  regulatory_reporting: ["report", "filing", "regulatory", "sec", "finra", "disclosure"],
  architecture_design: ["architect", "design", "system", "scalability", "diagram", "schema"],
  devops_automation: ["deploy", "pipeline", "ci", "cd", "terraform", "kubernetes", "helm"],
  reconciliation: ["reconcile", "reconciliation", "break", "desk", "settlement", "t+1"],
  financial_consolidation: ["consolidate", "consolidation", "group", "subsidiary", "elimination"],
  board_reporting: ["board", "executive", "summary", "quarterly", "kpi", "leadership"],
  ma_legal_review: ["merger", "acquisition", "m&a", "divestiture", "deal", "term sheet"],
  it_governance: ["governance", "policy", "standard", "control", "framework", "rmf"],
  audit_trail_analysis: ["audit", "trail", "log", "forensic", "tamper", "provenance"],
  research_synthesis: ["research", "summarize", "literature", "synthesize", "survey"],
  ux_optimization: ["ux", "usability", "conversion", "a/b", "experiment", "funnel"],
  dependency_upgrade: ["upgrade", "dependency", "version", "migrate", "patch", "cve"],
  pipeline_monitoring: ["monitor", "alert", "metric", "dashboard", "health", "log"],
  cybersecurity_scan: ["vulnerability", "scan", "cve", "security", "exploit", "pentest"],
};

function classifyLinear(
  features: PromptFeatures,
  taxonomy: WorkTypeTaxonomy,
  threshold: number,
): WorkTypeResult | null {
  const text = features.promptText.toLowerCase();
  const scores = new Map<string, number>();

  for (const label of taxonomy.labels) {
    const keywords = LABEL_KEYWORD_MAP[label];
    if (!keywords) continue;
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > 0) scores.set(label, score);
  }

  if (scores.size === 0) return null;

  // Pick the highest-scoring label.
  let bestLabel = "";
  let bestScore = 0;
  for (const [label, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  // Confidence = normalized score (capped at 1.0).
  const maxPossible = (LABEL_KEYWORD_MAP[bestLabel]?.length ?? 1);
  const confidence = Math.min(bestScore / Math.max(maxPossible * 0.4, 1), 1.0);

  if (confidence >= threshold) {
    const tags: string[] = [`model:${features.modelId}`];
    if (features.agentType) tags.push(`agent:${features.agentType}`);
    return {
      workType: bestLabel,
      usageTags: tags.slice(0, 5),
      stage: "linear",
      confidence,
      classifierVersion: taxonomy.classifierVersion,
    };
  }

  // Below threshold — return low-confidence result for stage 4 to improve.
  return {
    workType: bestLabel,
    usageTags: [`model:${features.modelId}`].slice(0, 5),
    stage: "linear",
    confidence,
    classifierVersion: taxonomy.classifierVersion,
  };
}

// ── Stage 4: embedding centroid fallback (semantic similarity) ────────────

/**
 * Fallback when stage 3 confidence < threshold. Uses a lightweight centroid
 * nearest-label heuristic: each label has a set of representative keywords
 * (the same LABEL_KEYWORD_MAP); the prompt is embedded via a simple
 * token-overlap similarity against each label's centroid.
 *
 * Only fires on the small ambiguous tail. Returns `unknown` if confidence
 * is still below the embedding threshold — never guesses.
 */
function classifyEmbeddingCentroid(
  features: PromptFeatures,
  taxonomy: WorkTypeTaxonomy,
  threshold: number,
): WorkTypeResult {
  const text = features.promptText.toLowerCase();
  const tokens = new Set(text.split(/\s+/).filter((t) => t.length > 2));

  let bestLabel = "unknown";
  let bestSim = 0;

  for (const label of taxonomy.labels) {
    const centroidKeywords = LABEL_KEYWORD_MAP[label] ?? [];
    if (centroidKeywords.length === 0) continue;
    const centroidSet = new Set(centroidKeywords.flatMap((kw) => kw.split(/\s+/)));
    // Jaccard-like overlap.
    let overlap = 0;
    for (const t of tokens) {
      if (centroidSet.has(t)) overlap += 1;
    }
    const sim = overlap / Math.max(tokens.size, 1);
    if (sim > bestSim) {
      bestSim = sim;
      bestLabel = label;
    }
  }

  if (bestSim >= threshold) {
    return {
      workType: bestLabel,
      usageTags: [`model:${features.modelId}`].slice(0, 5),
      stage: "embedding",
      confidence: bestSim,
      classifierVersion: taxonomy.classifierVersion,
    };
  }

  // Could not classify with confidence — unknown is first-class, never guessed.
  return {
    workType: "unknown",
    usageTags: [`model:${features.modelId}`].slice(0, 5),
    stage: "unknown",
    confidence: null,
    classifierVersion: taxonomy.classifierVersion,
  };
}

// ── The cascade ────────────────────────────────────────────────────────────

/**
 * Classify a prompt's work type via the zero-LLM cascade.
 *
 * Must never throw — failures produce `unknown` (fail-open for labeling).
 */
export async function classifyPrompt(
  features: PromptFeatures,
  taxonomy: WorkTypeTaxonomy,
  config: Partial<ClassifierConfig> = {},
): Promise<WorkTypeResult> {
  const cfg = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };

  try {
    // Stage 1: structural freebies (0 ms, covers ~60%).
    const structural = classifyStructural(features, taxonomy);
    if (structural) return structural;

    // Stage 2: prompt-hash cache (ns, covers repeats).
    const cacheKey = `${taxonomy.scopeId}:${taxonomy.classifierVersion}:${await hashPrompt(features.promptText)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return { ...cached.result, stage: "cache" as WorkTypeStage };
    }

    // Stage 3: linear keyword classifier (µs).
    const linear = classifyLinear(features, taxonomy, cfg.linearConfidenceThreshold);
    if (linear && linear.confidence !== null && linear.confidence >= cfg.linearConfidenceThreshold) {
      cache.set(cacheKey, { result: linear, ts: Date.now() });
      return linear;
    }

    // Stage 4: embedding centroid (only on the ambiguous tail).
    const result = classifyEmbeddingCentroid(
      features,
      taxonomy,
      cfg.embeddingConfidenceThreshold,
    );
    // Cache even unknowns — saves work on identical retries.
    cache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch {
    // Fail-open for labeling: unknown, never throw, never block the call.
    return {
      workType: "unknown",
      usageTags: [`model:${features.modelId}`].slice(0, 5),
      stage: "unknown",
      confidence: null,
      classifierVersion: taxonomy.classifierVersion,
    };
  }
}

// ── Cache (module-level, in-process LRU per data-plane node) ───────────────

let cache = new BoundedLRU(DEFAULT_CLASSIFIER_CONFIG.cacheMaxEntries);

/** Reset cache (for tests). */
export function resetCache(): void {
  cache = new BoundedLRU(DEFAULT_CLASSIFIER_CONFIG.cacheMaxEntries);
}

/** Cache size (for diagnostics / tests). */
export function cacheSize(): number {
  return cache.size();
}
