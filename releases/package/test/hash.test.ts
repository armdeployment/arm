import { describe, it, expect } from "vitest";
import { manifestSha256, canonicalize } from "../src/hash.js";

describe("manifestSha256", () => {
  it("is deterministic for the same object", () => {
    const obj = { b: 1, a: { d: [1, 2], c: "x" } };
    expect(manifestSha256(obj)).toBe(manifestSha256(obj));
    expect(manifestSha256(obj)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores key insertion order (sorted keys)", () => {
    const forward = { a: 1, b: 2, nested: { x: 1, y: 2 } };
    const reverse = { b: 2, a: 1, nested: { y: 2, x: 1 } };
    expect(manifestSha256(forward)).toBe(manifestSha256(reverse));
  });

  it("preserves array order (order is meaningful)", () => {
    expect(manifestSha256({ a: [1, 2] })).not.toBe(manifestSha256({ a: [2, 1] }));
  });

  it("produces different hashes for different values", () => {
    expect(manifestSha256({ a: 1 })).not.toBe(manifestSha256({ a: 2 }));
  });
});

describe("canonicalize", () => {
  it("sorts keys recursively and emits no whitespace", () => {
    const json = canonicalize({ z: 1, a: { c: 2, b: 1 } });
    expect(json).toBe('{"a":{"b":1,"c":2},"z":1}');
  });

  it("treats missing vs null values as distinct", () => {
    expect(canonicalize({ a: null })).not.toBe(canonicalize({}));
  });
});
