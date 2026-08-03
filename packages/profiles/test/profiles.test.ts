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
  financeProfile,
  holdingProfile,
  getProfile,
  listProfiles,
  compileDLPPatterns,
  isValidProfileId,
  flattenOrgTree,
  countOrgNodes,
  countOrgNodesByType,
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

describe("Finance profile", () => {
  it("has all required dimensions", () => {
    for (const key of REQUIRED_KEYS) {
      expect(financeProfile[key]).toBeDefined();
    }
    expect(financeProfile.id).toBe("finance");
  });

  it("has financial regulatory flags (SOX/GLBA/PCI)", () => {
    expect(financeProfile.classification.axes).toContain("regulatory");
    const restricted = financeProfile.classification.levels.find(
      (l) => l.name === "restricted",
    );
    expect(restricted?.regulatoryFlags).toContain("SOX");
    expect(restricted?.regulatoryFlags).toContain("GLBA");
    expect(restricted?.regulatoryFlags).toContain("PCI-DSS");
  });

  it("has financial DLP patterns (SWIFT, insider/MNPI)", () => {
    const dlpNames = financeProfile.dlpPatterns.map((p) => p.name);
    expect(dlpNames.some((n) => n.includes("SWIFT"))).toBe(true);
    expect(dlpNames.some((n) => n.includes("Insider"))).toBe(true);
  });

  it("uses quarterly budget periods", () => {
    expect(financeProfile.budgetPeriods).toContain("quarterly");
  });

  it("uses on-prem model routing", () => {
    expect(financeProfile.modelRouting.strategy).toBe("edge-onprep-first");
  });

  it("has finance personas (trader, compliance, quant)", () => {
    const keys = financeProfile.personas.map((p) => p.key);
    expect(keys).toContain("trader");
    expect(keys).toContain("compliance_officer");
    expect(keys).toContain("quant");
  });

  it("has finance-specific UI panels (risk, compliance, trade)", () => {
    const panelKeys = financeProfile.uiPanels.map((p) => p.key);
    expect(panelKeys).toContain("risk_exposure");
    expect(panelKeys).toContain("compliance_status");
    expect(panelKeys).toContain("trade_volume");
  });
});

describe("Holding company profile", () => {
  it("has all required dimensions", () => {
    for (const key of REQUIRED_KEYS) {
      expect(holdingProfile[key]).toBeDefined();
    }
    expect(holdingProfile.id).toBe("holding");
  });

  it("has subsidiary org structure (multi-org)", () => {
    const deptNames = holdingProfile.orgTree.defaultDepartments.map((d) => d.name);
    expect(deptNames.some((n) => n.includes("Subsidiary"))).toBe(true);
    expect(deptNames.some((n) => n.includes("Corporate"))).toBe(true);
  });

  it("has superset resource types (OT + finance + standard)", () => {
    const types = holdingProfile.resourceTypes.enabled;
    // OT (manufacturing subsidiary)
    expect(types).toContain("mes");
    expect(types).toContain("scada");
    // Finance subsidiary
    expect(types).toContain("trading_system");
    expect(types).toContain("bloomberg");
    // Standard
    expect(types).toContain("s3");
    expect(types).toContain("db");
  });

  it("has cross-entity regulatory flags", () => {
    const restricted = holdingProfile.classification.levels.find(
      (l) => l.name === "restricted",
    );
    expect(restricted?.regulatoryFlags).toContain("SOX");
    expect(restricted?.regulatoryFlags).toContain("ITAR");
    expect(restricted?.regulatoryFlags).toContain("GLBA");
  });

  it("has cross-entity DLP patterns (M&A, pre-earnings)", () => {
    const dlpNames = holdingProfile.dlpPatterns.map((p) => p.name);
    expect(dlpNames.some((n) => n.includes("M&A") || n.includes("Cross-Entity"))).toBe(true);
    expect(dlpNames.some((n) => n.includes("Pre-Earnings"))).toBe(true);
  });

  it("has holding-company personas (portfolio manager, board reporter)", () => {
    const keys = holdingProfile.personas.map((p) => p.key);
    expect(keys).toContain("portfolio_manager");
    expect(keys).toContain("board_reporter");
    expect(keys).toContain("consolidation_analyst");
  });

  it("has consolidated / cross-entity UI panels", () => {
    const panelKeys = holdingProfile.uiPanels.map((p) => p.key);
    expect(panelKeys).toContain("subsidiary_overview");
    expect(panelKeys).toContain("consolidated_spend");
    expect(panelKeys).toContain("cross_entity_audit");
    expect(panelKeys).toContain("portfolio_health");
  });

  it("has agents across multiple subsidiaries", () => {
    const depts = holdingProfile.seedAgents.map((a) => a.departmentName);
    const uniqueDepts = new Set(depts);
    expect(uniqueDepts.size).toBeGreaterThanOrEqual(4); // spread across subsidiaries
  });
});

describe("Profile registry", () => {
  it("listProfiles returns tech + manufacturing + finance + holding + custom", () => {
    const ids = listProfiles().map((p) => p.id);
    expect(ids).toContain("tech");
    expect(ids).toContain("manufacturing");
    expect(ids).toContain("finance");
    expect(ids).toContain("holding");
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
    expect(isValidProfileId("finance")).toBe(true);
    expect(isValidProfileId("holding")).toBe(true);
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

describe("Org tree structure (D6/D7 restructure)", () => {
  it("manufacturing has multiple plants in different locations", () => {
    const plants = flattenOrgTree(manufacturingProfile.orgTree.nodes).filter(
      (n) => n.node.type === "plant",
    );
    expect(plants.length).toBeGreaterThanOrEqual(3);
    const locations = plants.map((p) => p.node.location);
    expect(locations).toContain("Detroit, MI, USA");
    expect(locations).toContain("Stuttgart, Germany");
    expect(locations).toContain("Shenzhen, China");
  });

  it("manufacturing has HQ + plant departments in the tree", () => {
    const types = flattenOrgTree(manufacturingProfile.orgTree.nodes).map((n) => n.node.type);
    expect(types).toContain("hq");
    expect(types).toContain("plant");
    expect(types).toContain("department");
    expect(types).toContain("line");
  });

  it("manufacturing plant Detroit has production lines", () => {
    const detroit = flattenOrgTree(manufacturingProfile.orgTree.nodes).find(
      (n) => n.node.name === "Plant Detroit",
    );
    expect(detroit).toBeDefined();
    const production = detroit!.node.children?.find((c) => c.name === "Production");
    expect(production).toBeDefined();
    const lines = production!.children?.filter((c) => c.type === "line");
    expect(lines!.length).toBeGreaterThanOrEqual(2);
  });

  it("holding company has subsidiaries as organizations", () => {
    const orgs = flattenOrgTree(holdingProfile.orgTree.nodes).filter(
      (n) => n.node.type === "organization",
    );
    expect(orgs.length).toBeGreaterThanOrEqual(3);
    const names = orgs.map((o) => o.node.name);
    expect(names.some((n) => n.includes("Corporate"))).toBe(true);
    expect(names.some((n) => n.includes("Manufacturing"))).toBe(true);
    expect(names.some((n) => n.includes("Finance"))).toBe(true);
  });

  it("holding company manufacturing subsidiary has plants", () => {
    const mfgSub = flattenOrgTree(holdingProfile.orgTree.nodes).find(
      (n) => n.node.name === "Subsidiary: Manufacturing Division",
    );
    expect(mfgSub).toBeDefined();
    const plants = mfgSub!.node.children?.filter((c) => c.type === "plant");
    expect(plants!.length).toBeGreaterThanOrEqual(2);
  });

  it("flattenOrgTree preserves parent-child depth", () => {
    const flat = flattenOrgTree(manufacturingProfile.orgTree.nodes);
    const hq = flat.find((f) => f.node.type === "hq");
    expect(hq?.depth).toBe(0);
    const plant = flat.find((f) => f.node.type === "plant");
    expect(plant?.depth).toBe(0);
    const line = flat.find((f) => f.node.type === "line");
    expect(line?.depth).toBeGreaterThanOrEqual(2);
  });

  it("countOrgNodesByType counts correctly", () => {
    expect(countOrgNodesByType(manufacturingProfile.orgTree.nodes, "plant")).toBe(3);
    expect(countOrgNodesByType(manufacturingProfile.orgTree.nodes, "hq")).toBe(1);
    expect(countOrgNodesByType(holdingProfile.orgTree.nodes, "organization")).toBeGreaterThanOrEqual(3);
  });

  it("countOrgNodes counts all nodes recursively", () => {
    const mfgCount = countOrgNodes(manufacturingProfile.orgTree.nodes);
    expect(mfgCount).toBeGreaterThanOrEqual(20);
    const holdingCount = countOrgNodes(holdingProfile.orgTree.nodes);
    expect(holdingCount).toBeGreaterThanOrEqual(15);
  });
});

describe("D6 governing rule: profiles are pure data", () => {
  it("presets contain no function values in top-level dimensions", () => {
    // The profile preset should be serializable (JSON-safe) — no functions,
    // no class instances, no symbols. This is what makes it "data, not code."
    for (const profile of [techProfile, manufacturingProfile, financeProfile, holdingProfile]) {
      const serialized = JSON.parse(JSON.stringify(profile));
      expect(serialized.id).toBe(profile.id);
      expect(serialized.seedAgents.length).toBe(profile.seedAgents.length);
    }
  });
});
