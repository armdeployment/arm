/**
 * Tests for content-addressed manifest hashing (D9 `package-integrity`).
 *
 * Verifies:
 *   1. Determinism across key insertion order (deep and shallow).
 *   2. Distinct inputs produce distinct hashes.
 *   3. A known sha256 of a tiny canonical string is reproduced exactly.
 */

import { describe, it, expect } from "vitest";
import { manifestSha256 } from "../src/index.js";

const KNOWN_SHA256 = "efbd0040190fb0871831e606c581f8a66db79d8e2bb836745a70051306956070";

describe("manifestSha256", () => {
  it("is deterministic across key insertion order", () => {
    const a = {
      tools: [{ toolId: "t1", toolVersion: "1.0.0", scopes: ["read", "invoke"] }],
      skills: ["8d-reporting"],
      minAgentVersion: "0.9.0",
    };
    const b = {
      minAgentVersion: "0.9.0",
      skills: ["8d-reporting"],
      tools: [{ scopes: ["read", "invoke"], toolVersion: "1.0.0", toolId: "t1" }],
    };
    expect(manifestSha256(a)).toBe(manifestSha256(b));
  });

  it("produces different hashes when content differs", () => {
    expect(manifestSha256({ a: 1 })).not.toBe(manifestSha256({ a: 2 }));
    expect(manifestSha256({ a: 1, b: 2 })).not.toBe(manifestSha256({ a: 1 }));
  });

  it("matches a known sha256 of a tiny canonical string", () => {
    expect(manifestSha256({ a: 1, b: [2, 3] })).toBe(KNOWN_SHA256);
  });

  it("drops undefined keys canonically", () => {
    const withUndefined = { a: 1, b: undefined };
    expect(manifestSha256(withUndefined)).toBe(manifestSha256({ a: 1 }));
  });
});
