import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  formatDigest,
  digestOf,
  isValidDigest,
  parseDigest,
  assertDigestMatches,
} from "../src/digest.js";

describe("digest helpers", () => {
  it("sha256Hex is a 64-char lowercase hex string", () => {
    const hex = sha256Hex(new TextEncoder().encode("hello"));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("formatDigest prefixes sha256:", () => {
    expect(formatDigest("a".repeat(64))).toBe(`sha256:${"a".repeat(64)}`);
    expect(formatDigest(new TextEncoder().encode("x"))).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("digestOf is deterministic and content-addressed", () => {
    const a = digestOf(new TextEncoder().encode("same content"));
    const b = digestOf(new TextEncoder().encode("same content"));
    const c = digestOf(new TextEncoder().encode("different"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("isValidDigest accepts well-formed digests and rejects everything else", () => {
    expect(isValidDigest(`sha256:${"a".repeat(64)}`)).toBe(true);
    expect(isValidDigest("https://cdn.example.com/blob.tar")).toBe(false);
    expect(isValidDigest("sha256:not-hex")).toBe(false);
    expect(isValidDigest("a".repeat(64))).toBe(false); // missing prefix
  });

  it("parseDigest extracts the hex portion and throws on malformed input", () => {
    const hex = "b".repeat(64);
    expect(parseDigest(`sha256:${hex}`)).toBe(hex);
    expect(() => parseDigest("https://example.com/x")).toThrow(/not a well-formed/);
  });

  it("assertDigestMatches passes on a correct digest and throws on mismatch", () => {
    const body = new TextEncoder().encode("verify me");
    const digest = digestOf(body);
    expect(() => assertDigestMatches(digest, body)).not.toThrow();
    expect(() => assertDigestMatches(`sha256:${"0".repeat(64)}`, body)).toThrow(/digest mismatch/);
  });
});
