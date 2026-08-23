import { describe, it, expect } from "vitest";
import { digestOf, isValidDigest, verifyDigest, DIGEST_RE } from "../src/digest.js";

describe("digest (copied verification helpers)", () => {
  it("digestOf is deterministic and content-addressed", () => {
    const a = digestOf(new TextEncoder().encode("x"));
    const b = digestOf(new TextEncoder().encode("x"));
    expect(a).toBe(b);
    expect(a).toMatch(DIGEST_RE);
  });

  it("isValidDigest rejects URLs and bare hex", () => {
    expect(isValidDigest("https://cdn.example.com/x")).toBe(false);
    expect(isValidDigest("a".repeat(64))).toBe(false);
    expect(isValidDigest(`sha256:${"a".repeat(64)}`)).toBe(true);
  });

  it("verifyDigest returns true only for matching bytes, never re-derives/rewrites", () => {
    const body = new TextEncoder().encode("real bytes");
    const digest = digestOf(body);
    expect(verifyDigest(digest, body)).toBe(true);
    expect(verifyDigest(digest, new TextEncoder().encode("tampered bytes"))).toBe(false);
  });
});
