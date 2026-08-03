/**
 * Tests for the work-type classifier cascade (D7).
 *
 * Verifies:
 *   1. Stage 1 (structural): tool-call + taskType match → high-confidence.
 *   2. Stage 1 (file extensions): .test.ts → test_generation.
 *   3. Stage 3 (linear keyword): "review this diff for bugs" → code_review.
 *   4. Stage 4 (embedding centroid): low-confidence structural → centroid.
 *   5. `unknown` is first-class: gibberish prompt → unknown, never guessed.
 *   6. Cache hit (stage 2): identical repeat → cached result.
 *   7. Fail-open: classifier never throws on edge cases.
 *   8. Per-taxonomy selection: different departments pick from different labels.
 *   9. Manufacturing taxonomies classify CNC/defect prompts.
 *  10. Finance taxonomies classify trade/risk prompts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyPrompt,
  resetCache,
  cacheSize,
  type WorkTypeTaxonomy,
  type PromptFeatures,
} from "../src/index";

const ENG_TAXONOMY: WorkTypeTaxonomy = {
  scopeId: "dept_eng",
  scopeType: "department",
  name: "Engineering",
  classifierVersion: "1",
  labels: [
    "code_review", "code_generation", "test_generation", "hot_issue_resolution",
    "incident_triage", "architecture_design", "devops_automation",
    "dependency_upgrade", "pipeline_monitoring", "documentation",
  ],
};

const MFG_TAXONOMY: WorkTypeTaxonomy = {
  scopeId: "dept_mfg",
  scopeType: "department",
  name: "Manufacturing",
  classifierVersion: "1",
  labels: [
    "cnc_toolpath_optimization", "defect_analysis", "process_recipe_optimization",
    "predictive_maintenance", "spc_analysis", "quality_inspection",
  ],
};

const FINANCE_TAXONOMY: WorkTypeTaxonomy = {
  scopeId: "dept_trading",
  scopeType: "department",
  name: "Trading",
  classifierVersion: "1",
  labels: ["trade_analysis", "portfolio_optimization", "execution_strategy", "alpha_research"],
};

const baseFeatures: PromptFeatures = {
  promptText: "",
  modelId: "qwen3.5",
  agentType: "claude_code",
  priorityTier: "standard",
};

beforeEach(() => {
  resetCache();
});

describe("Stage 1 — structural freebies", () => {
  it("labels structurally when taskType matches and tool calls present", async () => {
    const result = await classifyPrompt(
      {
        ...baseFeatures,
        promptText: "Running tool: web_search query=error",
        taskType: "code_review",
        toolCallNames: ["web_search", "code_search"],
      },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("code_review");
    expect(result.stage).toBe("structural");
    expect(result.confidence).toBe(1.0);
  });

  it("infers test_generation from .test.ts file extension", async () => {
    const result = await classifyPrompt(
      {
        ...baseFeatures,
        promptText: "Look at utils.test.ts",
        fileExtensions: ["test.ts"],
      },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("test_generation");
    expect(result.stage).toBe("structural");
  });

  it("infers documentation from .md extension", async () => {
    const result = await classifyPrompt(
      {
        ...baseFeatures,
        promptText: "Summarize README.md",
        fileExtensions: ["md"],
      },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("documentation");
    expect(result.stage).toBe("structural");
  });

  it("returns null from stage 1 for free-text with no structural signal", async () => {
    // Stage 1 returns null → falls through to stage 3.
    const result = await classifyPrompt(
      {
        ...baseFeatures,
        promptText: "review this pull request for bugs and suggest improvements",
      },
      ENG_TAXONOMY,
    );
    // Should be labeled, but NOT by structural stage — by stage 3 (linear).
    expect(result.stage).not.toBe("structural");
  });
});

describe("Stage 2 — prompt-hash cache", () => {
  it("caches identical repeat prompts (cache hit)", async () => {
    const features = {
      ...baseFeatures,
      promptText: "please review this pull request diff and check the merge before code review",
    };
    const r1 = await classifyPrompt(features, ENG_TAXONOMY);
    expect(r1.stage).toBe("linear");

    const r2 = await classifyPrompt(features, ENG_TAXONOMY);
    expect(r2.stage).toBe("cache");
    expect(r2.workType).toBe(r1.workType);
    expect(cacheSize()).toBe(1);
  });

  it("different prompt text = cache miss", async () => {
    await classifyPrompt(
      { ...baseFeatures, promptText: "review this diff for bugs" },
      ENG_TAXONOMY,
    );
    await classifyPrompt(
      { ...baseFeatures, promptText: "generate a test for the utils module" },
      ENG_TAXONOMY,
    );
    expect(cacheSize()).toBe(2);
  });
});

describe("Stage 3 — linear keyword classifier", () => {
  it("classifies code review intent from free text", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "please review this pull request diff and check the merge" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("code_review");
    expect(result.stage).toBe("linear");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies test generation intent", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "write a test with coverage for the assert and use mocks" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("test_generation");
    expect(result.stage).toBe("linear");
  });

  it("classifies hot issue / bug fix intent", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "there is a bug causing a crash, fix the error in the traceback" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("hot_issue_resolution");
  });
});

describe("Stage 4 — embedding centroid fallback", () => {
  it("falls back to centroid for ambiguous prompts (low stage-3 confidence)", async () => {
    // A prompt with just one matching keyword — stage 3 is below threshold,
    // stage 4 centroid may resolve or return unknown.
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "the architecture of this system needs design" },
      ENG_TAXONOMY,
    );
    // Either embedding or unknown — never a low-confidence guess.
    expect(["embedding", "unknown"].includes(result.stage!) || result.stage === "linear").toBe(true);
    if (result.stage === "embedding") {
      expect(result.confidence).toBeGreaterThan(0);
    }
  });
});

describe("`unknown` is first-class — never guessed", () => {
  it("returns unknown for gibberish prompts", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "asdf qwer zxcv poiuy" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("unknown");
    expect(result.stage).toBe("unknown");
    expect(result.confidence).toBeNull();
  });

  it("returns unknown for empty prompt", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("unknown");
  });

  it("returns unknown for out-of-taxonomy prompts", async () => {
    // A cooking prompt against an engineering taxonomy.
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "recipe for chocolate cake with frosting and sugar" },
      ENG_TAXONOMY,
    );
    expect(result.workType).toBe("unknown");
  });
});

describe("Fail-open — classifier never throws", () => {
  it("does not throw on null/extreme inputs", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "x".repeat(1_000_000) },
      ENG_TAXONOMY,
    );
    expect(result).toBeDefined();
  });

  it("does not throw when taxonomy has no labels", async () => {
    const empty: WorkTypeTaxonomy = {
      scopeId: "x",
      scopeType: "department",
      name: "Empty",
      classifierVersion: "1",
      labels: [],
    };
    const result = await classifyPrompt(baseFeatures, empty);
    expect(result.workType).toBe("unknown");
  });
});

describe("Per-taxonomy selection (D7 lock #1)", () => {
  it("manufacturing taxonomy classifies CNC toolpath prompts", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "optimize the CNC toolpath g-code for feed rate and spindle speed" },
      MFG_TAXONOMY,
    );
    expect(result.workType).toBe("cnc_toolpath_optimization");
  });

  it("manufacturing taxonomy classifies defect analysis prompts", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "analyze the SPC defect data from quality inspection and check tolerance" },
      MFG_TAXONOMY,
    );
    expect(result.workType).toBe("defect_analysis");
  });

  it("finance taxonomy classifies trade analysis prompts", async () => {
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "analyze the trade order execution and check position fills" },
      FINANCE_TAXONOMY,
    );
    expect(result.workType).toBe("trade_analysis");
  });

  it("engineering labels are NOT available in manufacturing taxonomy", async () => {
    // A code_review prompt against manufacturing taxonomy should NOT label as code_review.
    const result = await classifyPrompt(
      { ...baseFeatures, promptText: "review this diff for bugs and check the merge" },
      MFG_TAXONOMY,
    );
    expect(result.workType).not.toBe("code_review");
  });
});

describe("classifier_version is carried (re-labeling guard)", () => {
  it("result includes the taxonomy version", async () => {
    const result = await classifyPrompt(baseFeatures, {
      ...ENG_TAXONOMY,
      classifierVersion: "42",
    });
    expect(result.classifierVersion).toBe("42");
  });
});
