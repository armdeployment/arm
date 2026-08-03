/**
 * Industry Profile registry + provisioning API (D6).
 *
 * `packages/profiles` is a LEAF package — zero internal imports. Sits beside
 * `proto`/`config` in the dependency DAG.
 *
 * Usage at provisioning time:
 *   const profile = getProfile("manufacturing");
 *   // seed departments, classification levels, DLP patterns, etc. from profile
 *
 * Runtime code NEVER calls getProfile(). It reads per-tenant config rows.
 * The `guardrails/no-profile-branching` check enforces this.
 */

import type { IndustryProfilePreset, ProfileId } from "./types";
import type { OrgNodeSeed } from "./types";
import { techProfile } from "./tech.profile";
import { manufacturingProfile } from "./manufacturing.profile";
import { financeProfile } from "./finance.profile";
import { holdingProfile } from "./holding.profile";

export { techProfile } from "./tech.profile";
export { manufacturingProfile } from "./manufacturing.profile";
export { financeProfile } from "./finance.profile";
export { holdingProfile } from "./holding.profile";
export * from "./types";

/** All built-in profiles. "custom" is the à-la-carte escape hatch (empty preset). */
const REGISTRY: Record<ProfileId, IndustryProfilePreset | undefined> = {
  tech: techProfile,
  manufacturing: manufacturingProfile,
  finance: financeProfile,
  holding: holdingProfile,
  custom: undefined, // Custom is computed per-tenant, not a static preset
};

/** List available profile ids for the onboarding wizard. */
export function listProfiles(): { id: ProfileId; label: string; description: string }[] {
  return [
    { id: "tech", label: techProfile.label, description: techProfile.description },
    {
      id: "manufacturing",
      label: manufacturingProfile.label,
      description: manufacturingProfile.description,
    },
    {
      id: "finance",
      label: financeProfile.label,
      description: financeProfile.description,
    },
    {
      id: "holding",
      label: holdingProfile.label,
      description: holdingProfile.description,
    },
    { id: "custom", label: "Custom", description: "À-la-carte: start empty, configure every capability individually." },
  ];
}

/**
 * Get a profile preset by id.
 *
 * For "custom", returns a minimal empty preset — the tenant configures each
 * dimension individually during or after onboarding.
 */
export function getProfile(id: ProfileId): IndustryProfilePreset {
  const preset = REGISTRY[id];
  if (preset) return preset;

  // Custom: empty scaffold — every dimension starts empty/neutral.
  return {
    id: "custom",
    label: "Custom",
    description: "À-la-carte tenant configuration.",
    orgTree: {
      style: "flat",
      description: "No default org tree — configure manually.",
      nodes: [],
      defaultDepartments: [],
    },
    personas: [],
    resourceTypes: { enabled: [] },
    classification: {
      axes: ["sensitivity"],
      levels: [
        { rank: 0, name: "public", regulatoryFlags: [] },
        { rank: 1, name: "internal", regulatoryFlags: [] },
      ],
    },
    dlpPatterns: [],
    tierLabels: {
      critical: "Critical",
      standard: "Standard",
      background: "Background",
    },
    budgetPeriods: ["monthly"],
    modelRouting: {
      strategy: "cost-steer-cloud",
      description: "No default model routing — configure manually.",
    },
    connectivity: {
      assumption: "cloud-native",
      offlinePolicyTtl: false,
    },
    stakeholderRouting: {
      mode: "single-human",
      description: "No default stakeholder routing — configure manually.",
    },
    seedAgents: [],
    uiPanels: [
      { key: "spend", label: "Spend Overview", order: 0 },
      { key: "agents", label: "Agent Fleet", order: 1 },
    ],
    rolePresets: [
      {
        key: "org_admin", label: "Org Admin",
        description: "Full authority — configure every role afterwards.",
        scopeType: "org", singleton: true,
        permissions: ["org_node:create", "org_node:rename", "org_node:reparent", "org_node:delete", "*"]
      },
    ],
    workTypeTaxonomies: [],
  };
}

/**
 * Compile DLP patterns from string sources to RegExp objects.
 * Used by the provisioning step and proxy loader — NOT at runtime per-call
 * (patterns are cached as compiled regex per tenant).
 */
export function compileDLPPatterns(
  profile: IndustryProfilePreset,
): { name: string; regex: RegExp; severity: string; category: string }[] {
  return profile.dlpPatterns.map((p) => ({
    name: p.name,
    regex: new RegExp(p.pattern, p.flags ?? ""),
    severity: p.severity,
    category: p.category,
  }));
}

/** Validate that a profile id is a known preset. */
export function isValidProfileId(id: string): id is ProfileId {
  return (
    id === "tech" ||
    id === "manufacturing" ||
    id === "finance" ||
    id === "holding" ||
    id === "custom"
  );
}

// ── Org tree utilities (D6/D7 restructure) ─────────────────────────────────

/**
 * Flatten the org tree into a list of nodes with parent paths.
 * Used by the provisioning step to seed hierarchical department rows.
 */
export function flattenOrgTree(
  nodes: OrgNodeSeed[],
): { node: OrgNodeSeed; path: string[]; depth: number }[] {
  const result: { node: OrgNodeSeed; path: string[]; depth: number }[] = [];
  function walk(ns: OrgNodeSeed[], path: string[], depth: number) {
    for (const n of ns) {
      result.push({ node: n, path: [...path, n.name], depth });
      if (n.children) walk(n.children, [...path, n.name], depth + 1);
    }
  }
  walk(nodes, [], 0);
  return result;
}

/** Count all nodes in the tree (recursive). */
export function countOrgNodes(nodes: OrgNodeSeed[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1;
    if (n.children) count += countOrgNodes(n.children);
  }
  return count;
}

/** Count nodes of a specific type (e.g. "plant", "organization"). */
export function countOrgNodesByType(
  nodes: OrgNodeSeed[],
  type: OrgNodeSeed["type"],
): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === type) count += 1;
    if (n.children) count += countOrgNodesByType(n.children, type);
  }
  return count;
}

/** Sum all budgetMonthlyCents values in the tree. */
export function sumOrgBudgets(nodes: OrgNodeSeed[]): number {
  let total = 0;
  for (const n of nodes) {
    if (n.budgetMonthlyCents) total += n.budgetMonthlyCents;
    // Note: we sum ALL nodes, not just leaves — parent budgets may be aggregate.
    // The provisioning step decides whether to use parent or leaf budgets.
  }
  return total;
}
