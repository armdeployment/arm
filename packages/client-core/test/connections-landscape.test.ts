/**
 * Connections wizard landscape coverage (D9 Phase 1.6): every guide added
 * for the automotive engineering tool landscape renders a complete,
 * non-empty step list, and guide resolution prefers the specific guide by
 * tool id, then falls back to the generic guide by auth method.
 */

import { describe, it, expect } from "vitest";
import { GUIDE_LIBRARY, getConnectionGuide, renderGuideSteps } from "../src/connections.js";
import type { ConnectionsManifestEntry } from "../src/connections.js";

const NEW_GUIDE_IDS = [
  "gitlab-pat",
  "azure-devops-oauth",
  "confluence-oauth",
  "jama-pat",
  "polarion-pat",
  "codebeamer-pat",
  "valispace-pat",
  "teamcenter-pat",
  "windchill-pat",
  "net-inspect-pat",
  "aqua-pro-oauth",
  "sap-qm-service-account",
  "omniverse-oauth",
  "cplace-oauth",
  "doors-oauth",
  "vendor-pat",
  "vendor-oauth",
] as const;

function makeEntry(overrides: Partial<ConnectionsManifestEntry> = {}): ConnectionsManifestEntry {
  return {
    componentId: "10000000-0000-4000-8000-00000000abcd",
    componentName: "unknown-tool",
    authMethod: "pat",
    guideId: "unknown-tool-pat",
    requiredScopes: [],
    ...overrides,
  };
}

describe("GUIDE_LIBRARY landscape guides", () => {
  it.each(NEW_GUIDE_IDS)("guide %s exists with a title and ≥3 non-empty steps", (guideId) => {
    const guide = GUIDE_LIBRARY[guideId];
    expect(guide, `missing guide: ${guideId}`).toBeDefined();
    expect(guide!.guideId).toBe(guideId);
    expect(guide!.title.length).toBeGreaterThan(0);
    expect(guide!.steps.length).toBeGreaterThanOrEqual(3);
    for (const step of guide!.steps) {
      expect(step.trim().length, `empty step in ${guideId}`).toBeGreaterThan(0);
    }
  });

  it.each(NEW_GUIDE_IDS)("guide %s renders numbered steps", (guideId) => {
    const entry = makeEntry({ guideId });
    const steps = renderGuideSteps(entry);
    expect(steps).toHaveLength(GUIDE_LIBRARY[guideId]!.steps.length);
    steps.forEach((step, index) => expect(step.startsWith(`${index + 1}. `)).toBe(true));
  });
});

describe("getConnectionGuide resolution", () => {
  it("prefers the specific guide pinned by the manifest entry", () => {
    const entry = makeEntry({ componentName: "gitlab", guideId: "gitlab-pat", authMethod: "pat" });
    expect(getConnectionGuide(entry)).toBe(GUIDE_LIBRARY["gitlab-pat"]);
  });

  it("falls back to vendor-pat for an unknown tool with pat auth", () => {
    const entry = makeEntry({ guideId: "acme-unknown-pat", authMethod: "pat" });
    expect(getConnectionGuide(entry)).toBe(GUIDE_LIBRARY["vendor-pat"]);
  });

  it("falls back to vendor-pat for service_account auth", () => {
    const entry = makeEntry({ guideId: "acme-unknown-sa", authMethod: "service_account" });
    expect(getConnectionGuide(entry)).toBe(GUIDE_LIBRARY["vendor-pat"]);
  });

  it("falls back to vendor-oauth for an unknown tool with oauth auth", () => {
    const entry = makeEntry({ guideId: "acme-unknown-oauth", authMethod: "oauth" });
    expect(getConnectionGuide(entry)).toBe(GUIDE_LIBRARY["vendor-oauth"]);
  });

  it("throws when neither a specific nor a generic guide applies", () => {
    const entry = makeEntry({ guideId: "acme-unknown-none", authMethod: "none" });
    expect(() => getConnectionGuide(entry)).toThrow(/unknown connection guide/);
  });
});
