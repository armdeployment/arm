/**
 * Spend panels in real mode.
 *
 * `spend.byModel` and `spend.trend` carried `TODO(1.1): scope-filter from
 * ClickHouse` and returned fixtures unconditionally — so even once the
 * metering pipeline was writing real rows to `token_usage_event`, the
 * dashboard could not show them. These cover the classification the real path
 * depends on, which is where the interesting decisions are.
 */

import { describe, it, expect } from "vitest";
import { classifyModel } from "../src/index.js";

describe("classifyModel", () => {
  it("maps the model ids the proxy actually sends", () => {
    expect(classifyModel("claude-sonnet-4-20250514")).toMatchObject({
      provider: "Anthropic",
      kind: "closed",
      bucket: "claude",
    });
    expect(classifyModel("gpt-4o")).toMatchObject({
      provider: "OpenAI",
      kind: "closed",
      bucket: "gpt",
    });
    expect(classifyModel("glm-5.2")).toMatchObject({
      provider: "Self-hosted",
      kind: "self_hosted",
      bucket: "glm",
    });
  });

  it("treats the other self-hosted families as self-hosted", () => {
    expect(classifyModel("deepseek-v3").kind).toBe("self_hosted");
    expect(classifyModel("qwen2.5-72b").kind).toBe("self_hosted");
  });

  it("recognises OpenAI's o-series", () => {
    expect(classifyModel("o3-mini").bucket).toBe("gpt");
    expect(classifyModel("o1-preview").provider).toBe("OpenAI");
  });

  it("is case-insensitive — ids arrive however the caller typed them", () => {
    expect(classifyModel("Claude-Sonnet-4").bucket).toBe("claude");
    expect(classifyModel("GPT-4O").provider).toBe("OpenAI");
  });

  it("calls an UNKNOWN model closed, never self-hosted", () => {
    // `kind` is load-bearing: self_hosted is what lets confidential and
    // restricted workloads run at all. Guessing self_hosted for something
    // unrecognised would understate the exposure of unclassified traffic, so
    // the default errs the safe way.
    expect(classifyModel("some-new-frontier-model").kind).toBe("closed");
    expect(classifyModel("").kind).toBe("closed");
  });

  it("keeps the raw id as the display name, so spend is attributable", () => {
    // Collapsing "claude-sonnet-4-20250514" to "Claude" would merge two model
    // versions whose costs differ.
    expect(classifyModel("claude-sonnet-4-20250514").model).toBe("claude-sonnet-4-20250514");
  });
});
