import { describe, it, expect } from "vitest";
import { canonicalizeComponentManifest, componentManifestSha256 } from "../src/manifest.js";

describe("component manifest canonicalization + hashing", () => {
  it("is deterministic across key insertion order", () => {
    const a = { b: 1, a: { z: 1, y: 2 } };
    const b = { a: { y: 2, z: 1 }, b: 1 };
    expect(componentManifestSha256(a)).toBe(componentManifestSha256(b));
  });

  it("does NOT reorder array elements (arrays hashed in given order)", () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(componentManifestSha256(a)).not.toBe(componentManifestSha256(b));
  });

  it("drops undefined keys canonically", () => {
    expect(componentManifestSha256({ a: 1, b: undefined })).toBe(componentManifestSha256({ a: 1 }));
  });

  it("produces different hashes for different content", () => {
    expect(componentManifestSha256({ a: 1 })).not.toBe(componentManifestSha256({ a: 2 }));
  });

  it("canonicalize recursively sorts nested object keys", () => {
    const canonical = canonicalizeComponentManifest({ z: 1, a: { y: 1, x: 2 } }) as Record<string, unknown>;
    expect(Object.keys(canonical)).toEqual(["a", "z"]);
    expect(Object.keys(canonical.a as Record<string, unknown>)).toEqual(["x", "y"]);
  });

  it("hash is a 64-char lowercase hex string", () => {
    expect(componentManifestSha256({})).toMatch(/^[0-9a-f]{64}$/);
  });
});
