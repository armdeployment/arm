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
