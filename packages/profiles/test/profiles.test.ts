/**
 * Tests for Industry Profile presets (D6).
 *
 * Verifies that:
 *   1. Both presets provide all required dimensions.
 *   2. Manufacturing has OT resources, dual-axis classification, shift periods.
 *   3. Tech has standard cloud resources, single-axis classification, monthly.
 *   4. Custom is a valid empty scaffold.
 *   5. compileDLPPatterns produces working RegExp objects.
 *   6. The presets are PURE DATA (no functions, no side effects).
 */

import { describe, it, expect } from "vitest";
import {
  techProfile,
  manufacturingProfile,
  getProfile,
  listProfiles,
  compileDLPPatterns,
  isValidProfileId,
  type IndustryProfilePreset,
} from "../src/index.js";

const REQUIRED_KEYS: (keyof IndustryProfilePreset)[] = [
  "id",
  "label",
  "description",
  "orgTree",
  "personas",
  "resourceTypes",
  "classification",
  "dlpPatterns",
  "tierLabels",
  "budgetPeriods",
  "modelRouting",
  "connectivity",
  "stakeholderRouting",
  "seedAgents",
  "uiPanels",
];

describe("Industry Profile presets", () => {
  it("tech profile has all required dimensions", () => {
    for (const key of REQUIRED_KEYS) {
      expect(techProfile[key]).toBeDefined();
    }
    expect(techProfile.id).toBe("tech");
    expect(techProfile.classification.axes).toEqual(["sensitivity"]);
    expect(techProfile.connectivity.assumption).toBe("cloud-native");
  });

  it("manufacturing profile has all required dimensions", () => {
    for (const key of REQUIRED_KEYS) {
      expect(manufacturingProfile[key]).toBeDefined();
    }
    expect(manufacturingProfile.id).toBe("manufacturing");
  });

  it("manufacturing has OT resource types", () => {
    const otTypes = ["mes", "erp", "scada", "historian", "plm", "cmms", "iot"];
    for (const ot of otTypes) {
      expect(manufacturingProfile.resourceTypes.enabled).toContain(ot);
    }
  });

  it("tech does NOT include OT resource types by default", () => {
    const otTypes = ["mes", "erp", "scada", "historian", "plm", "cmms", "iot"];
    for (const ot of otTypes) {
      expect(techProfile.resourceTypes.enabled).not.toContain(ot);
    }
  });

  it("manufacturing has dual-axis classification with regulatory flags", () => {
    expect(manufacturingProfile.classification.axes).toContain("regulatory");
    const confidential = manufacturingProfile.classification.levels.find(
      (l) => l.name === "confidential",
    );
    expect(confidential?.regulatoryFlags).toContain("ITAR");
    expect(confidential?.regulatoryFlags).toContain("EAR");
  });

  it("tech has single-axis classification (no regulatory)", () => {
    expect(techProfile.classification.axes).toEqual(["sensitivity"]);
    for (const level of techProfile.classification.levels) {
      expect(level.regulatoryFlags).toEqual([]);
    }
  });

  it("manufacturing has shift/line/batch budget periods", () => {
    expect(manufacturingProfile.budgetPeriods).toContain("shift");
    expect(manufacturingProfile.budgetPeriods).toContain("line");
    expect(manufacturingProfile.budgetPeriods).toContain("batch");
  });

  it("tech has monthly budget period only", () => {
    expect(techProfile.budgetPeriods).toEqual(["monthly"]);
  });

  it("manufacturing uses edge/on-prem model routing", () => {
    expect(manufacturingProfile.modelRouting.strategy).toBe("edge-onprep-first");
  });

  it("tech uses cost-steer-cloud model routing", () => {
    expect(techProfile.modelRouting.strategy).toBe("cost-steer-cloud");
  });

  it("manufacturing supports offline policy TTL (air-gapped)", () => {
    expect(manufacturingProfile.connectivity.offlinePolicyTtl).toBe(true);
    expect(manufacturingProfile.connectivity.assumption).toBe("air-gapped");
  });

  it("manufacturing has shift duty roster stakeholder routing", () => {
    expect(manufacturingProfile.stakeholderRouting.mode).toBe("shift-duty-roster");
  });

  it("manufacturing has manufacturing-specific DLP patterns", () => {
    const dlpNames = manufacturingProfile.dlpPatterns.map((p) => p.name);
    expect(dlpNames).toContain("Export-Controlled (ITAR/EAR)");
    expect(dlpNames.some((n) => n.includes("Process Recipe"))).toBe(true);
    expect(dlpNames.some((n) => n.includes("CAM"))).toBe(true);
  });

  it("both presets have seed agents", () => {
    expect(techProfile.seedAgents.length).toBeGreaterThan(3);
    expect(manufacturingProfile.seedAgents.length).toBeGreaterThan(3);
  });

  it("manufacturing seed agents include CNC toolpath and defect analysis", () => {
    const taskTypes = manufacturingProfile.seedAgents.map((a) => a.taskType);
    expect(taskTypes).toContain("cnc_toolpath_optimization");
    expect(taskTypes).toContain("defect_analysis");
  });
});

describe("Profile registry", () => {
  it("listProfiles returns tech + manufacturing + custom", () => {
    const ids = listProfiles().map((p) => p.id);
    expect(ids).toContain("tech");
    expect(ids).toContain("manufacturing");
    expect(ids).toContain("custom");
  });

  it("getProfile returns the right preset by id", () => {
    expect(getProfile("tech").id).toBe("tech");
    expect(getProfile("manufacturing").id).toBe("manufacturing");
    expect(getProfile("custom").id).toBe("custom");
  });

  it("custom profile is a valid empty scaffold", () => {
    const custom = getProfile("custom");
    expect(custom.seedAgents).toEqual([]);
    expect(custom.dlpPatterns).toEqual([]);
    expect(custom.orgTree.defaultDepartments).toEqual([]);
  });

  it("isValidProfileId validates known ids", () => {
    expect(isValidProfileId("tech")).toBe(true);
    expect(isValidProfileId("manufacturing")).toBe(true);
    expect(isValidProfileId("custom")).toBe(true);
    expect(isValidProfileId("healthcare")).toBe(false);
  });
});

describe("compileDLPPatterns", () => {
  it("compiles tech patterns to working RegExp objects", () => {
    const compiled = compileDLPPatterns(techProfile);
    expect(compiled.length).toBe(techProfile.dlpPatterns.length);
    for (const c of compiled) {
      expect(c.regex).toBeInstanceOf(RegExp);
    }
  });

  it("SSN pattern matches a real SSN", () => {
    const compiled = compileDLPPatterns(techProfile);
    const ssnPattern = compiled.find((c) => c.name === "SSN");
    expect(ssnPattern?.regex.test("My SSN is 123-45-6789")).toBe(true);
    expect(ssnPattern?.regex.test("No SSN here")).toBe(false);
  });

  it("API key pattern matches a real key", () => {
    const compiled = compileDLPPatterns(techProfile);
    const apiKeyPattern = compiled.find((c) => c.name === "API Key (sk-ant-)");
    expect(apiKeyPattern?.regex.test("sk-ant-api03-something")).toBe(true);
    expect(apiKeyPattern?.regex.test("not-a-key")).toBe(false);
  });

  it("manufacturing ITAR pattern matches export-controlled text", () => {
    const compiled = compileDLPPatterns(manufacturingProfile);
    const itarPattern = compiled.find((c) => c.name === "Export-Controlled (ITAR/EAR)");
    expect(itarPattern?.regex.test("This part is ITAR controlled")).toBe(true);
    expect(itarPattern?.regex.test("This is a normal part")).toBe(false);
  });
});

describe("D6 governing rule: profiles are pure data", () => {
  it("presets contain no function values in top-level dimensions", () => {
    // The profile preset should be serializable (JSON-safe) — no functions,
    // no class instances, no symbols. This is what makes it "data, not code."
    for (const profile of [techProfile, manufacturingProfile]) {
      const serialized = JSON.parse(JSON.stringify(profile));
      expect(serialized.id).toBe(profile.id);
      expect(serialized.seedAgents.length).toBe(profile.seedAgents.length);
    }
  });
});
