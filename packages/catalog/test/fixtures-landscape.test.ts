/**
 * D9 automotive tool-landscape fixture suite (Aug 2026 OEM survey seeding).
 *
 * ── Documented exception (mirrors guardrail tool-endpoint-scope) ────────────
 * `kind === "cli"` tools are DESKTOP ENGINEERING APPS invoked as
 * local-process invocations on the operator workstation — not
 * credential-bearing remote endpoints. They therefore carry auth_strategy
 * "none" even when their data_classification is confidential; the OS/session
 * login is the auth boundary there. Any NON-cli tool with confidential or
 * restricted data MUST carry a real auth_strategy (oauth/pat/service_account).
 *
 * Tool-version hashes are per-manifest hashes: sha256 over the canonical
 * { config_schema, changelog } object of that version (see fixtures.ts).
 */

import { describe, it, expect } from "vitest";
import {
  toolFixtures,
  toolIdFixtures,
  toolVersionFixtures,
  manifestSha256,
} from "../src/index.js";

describe("D9 automotive landscape tool fixtures", () => {
  it("(a) ships 40 tools (36 landscape + 4 original) with unique names", () => {
    expect(toolFixtures).toHaveLength(40);
    const names = toolFixtures.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("(b) every toolVersionFixtures entry references an existing tool id", () => {
    const toolIds = new Set(toolFixtures.map((t) => t.id));
    expect(toolVersionFixtures).toHaveLength(toolFixtures.length);
    const versionIds = new Set(toolVersionFixtures.map((tv) => tv.id));
    expect(versionIds.size).toBe(toolVersionFixtures.length);
    for (const tv of toolVersionFixtures) {
      expect(toolIds.has(tv.tool_id), `version ${tv.id} dangles on ${tv.tool_id}`).toBe(true);
    }
  });

  it("(c) every slug in toolIdFixtures has a matching toolFixtures row", () => {
    for (const [slug, id] of Object.entries(toolIdFixtures)) {
      const tool = toolFixtures.find((t) => t.id === id);
      expect(tool, `slug ${slug} -> ${id} has no toolFixtures row`).toBeDefined();
      expect(tool!.name).toBe(slug);
    }
  });

  it("(d) kind cli implies a cli:// endpoint", () => {
    for (const t of toolFixtures.filter((t) => t.kind === "cli")) {
      expect(t.endpoint.startsWith("cli://"), `${t.name}: ${t.endpoint}`).toBe(true);
    }
  });

  it("(e) confidential/restricted tools never use auth none — except local cli apps", () => {
    for (const t of toolFixtures) {
      if (
        (t.data_classification === "confidential" ||
          t.data_classification === "restricted") &&
        t.auth_strategy === "none"
      ) {
        expect(
          t.kind,
          `${t.name} classified ${t.data_classification} with auth_strategy none must be a local cli app`,
        ).toBe("cli");
      }
    }
  });

  it("tool-version manifest_sha256 recomputes over { config_schema, changelog } (per-manifest hashes)", () => {
    for (const tv of toolVersionFixtures) {
      expect(tv.manifest_sha256).toBe(
        manifestSha256({ config_schema: tv.config_schema, changelog: tv.changelog }),
      );
    }
  });
});
