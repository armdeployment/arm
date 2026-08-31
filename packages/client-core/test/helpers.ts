/**
 * Shared test fixtures for client-core (D10 manifest v2 / components).
 * Not a spec file — imported by tests. `makeVersion` hashes the canonical
 * manifest v2 object via the package's own `manifestSha256`/
 * `buildCanonicalManifest` so integrity checks pass unless a test tampers
 * with the data. No canonicalizer is duplicated here.
 */

import { randomUUID, createHash } from "node:crypto";
import {
  manifestSha256,
  buildCanonicalManifest,
  type ClientPackageManifest,
  type Component,
  type ComponentVersion,
  type ResolvedComponent,
  type WorkPackage,
  type WorkPackageVersion,
} from "../src/index.js";

export const TENANT_ID = "99999999-9999-4999-8999-999999999999";
export const OWNER_ID = "88888888-8888-4888-8888-888888888888";
export const JIRA_COMPONENT_ID = "11111111-1111-4111-8111-111111111111";
export const GITHUB_COMPONENT_ID = "22222222-2222-4222-8222-222222222222";
export const SKILL_COMPONENT_ID = "22222222-2222-4222-8222-222222222299";
export const PACKAGE_ID = "33333333-3333-4333-8333-333333333333";
export const VERSION_ID = "44444444-4444-4444-8444-444444444444";

const SKILL_BLOB_CONTENT = "# 8D Report Generator\n\nSkill content fixture.\n";
export const SKILL_BLOB_DIGEST = `sha256:${createHash("sha256").update(SKILL_BLOB_CONTENT).digest("hex")}`;

export type CanonicalOverrides = Partial<{
  components: WorkPackageVersion["components"];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  min_agent_version: string;
  job_functions: string[];
}>;

const DEFAULT_COMPONENT_REFS: WorkPackageVersion["components"] = [
  { component_id: JIRA_COMPONENT_ID, version: "2.1.0", kind: "mcp", scopes: ["read:jira-work"] },
  { component_id: GITHUB_COMPONENT_ID, version: "1.0.0", kind: "http_api", scopes: [] },
  { component_id: SKILL_COMPONENT_ID, version: "1.0.0", kind: "skill", scopes: [] },
];

/**
 * A wire-format version whose manifest_sha256 is correct by construction —
 * built by feeding overridable canonical fields through the package's own
 * `buildCanonicalManifest` + `manifestSha256`.
 */
export function makeVersion(overrides: CanonicalOverrides = {}): WorkPackageVersion {
  const draft: WorkPackageVersion = {
    id: VERSION_ID,
    package_id: PACKAGE_ID,
    version: "1.0.0",
    manifest_version: 2,
    components: overrides.components ?? DEFAULT_COMPONENT_REFS,
    permissions: overrides.permissions ?? ["tool:invoke:jira"],
    model_routing: overrides.model_routing ?? { default: "haiku" },
    budget_template: overrides.budget_template ?? { monthly_usd_cap: 150 },
    starter_prompts: overrides.starter_prompts ?? ["Draft an 8D report"],
    min_agent_version: overrides.min_agent_version ?? "0.16.0",
    job_functions: overrides.job_functions ?? ["quality_engineer"],
    manifest_sha256: "0".repeat(64),
  };
  return { ...draft, manifest_sha256: manifestSha256(buildCanonicalManifest(draft)) };
}

export function makePackage(): WorkPackage {
  return {
    id: PACKAGE_ID,
    tenant_id: TENANT_ID,
    role_key: "quality_engineer",
    name: "Quality Engineer",
    family: "quality",
    mode: "copilot",
    description: "8D/PPAP/SPC toolkit",
    approval_required: false,
  };
}

export function makeComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: JIRA_COMPONENT_ID,
    tenant_id: TENANT_ID,
    slug: "jira",
    name: "jira",
    kind: "mcp",
    description: "",
    owner_user_id: OWNER_ID,
    review_status: "approved",
    source_kind: "first_party",
    source_ref: "",
    endpoint: "https://mcp.acme.internal/jira",
    auth_strategy: "pat",
    data_classification: "internal",
    homepage_url: null,
    ...overrides,
  };
}

export function makeComponentVersion(overrides: Partial<ComponentVersion> = {}): ComponentVersion {
  const manifest = overrides.manifest ?? {};
  return {
    id: randomUUID(),
    tenant_id: TENANT_ID,
    component_id: JIRA_COMPONENT_ID,
    version: "2.1.0",
    manifest,
    manifest_sha256: manifestSha256(manifest),
    blob_digest: null,
    blob_size_bytes: null,
    blob_media_type: null,
    config_schema: {},
    requires: [],
    changelog: "",
    yanked: false,
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

export function makeResolvedComponent(
  overrides: Partial<ResolvedComponent> = {},
): ResolvedComponent {
  return {
    component: overrides.component ?? makeComponent(),
    version: overrides.version ?? makeComponentVersion(),
  };
}

/** Default resolved components matching DEFAULT_COMPONENT_REFS above. */
export function defaultResolvedComponents(): ResolvedComponent[] {
  return [
    makeResolvedComponent({
      component: makeComponent({ id: JIRA_COMPONENT_ID, slug: "jira", name: "jira" }),
      version: makeComponentVersion({
        id: "aa000000-0000-4000-8000-000000000001",
        component_id: JIRA_COMPONENT_ID,
        version: "2.1.0",
      }),
    }),
    makeResolvedComponent({
      component: makeComponent({
        id: GITHUB_COMPONENT_ID,
        slug: "github-issues",
        name: "github-issues",
        kind: "http_api",
        endpoint: "https://api.github.com",
        auth_strategy: "oauth",
      }),
      version: makeComponentVersion({
        id: "aa000000-0000-4000-8000-000000000002",
        component_id: GITHUB_COMPONENT_ID,
        version: "1.0.0",
      }),
    }),
    makeResolvedComponent({
      component: makeComponent({
        id: SKILL_COMPONENT_ID,
        slug: "8d-generator",
        name: "8d-generator",
        kind: "skill",
        endpoint: null,
        auth_strategy: null,
      }),
      version: makeComponentVersion({
        id: "aa000000-0000-4000-8000-000000000003",
        component_id: SKILL_COMPONENT_ID,
        version: "1.0.0",
        blob_digest: SKILL_BLOB_DIGEST,
        blob_size_bytes: SKILL_BLOB_CONTENT.length,
        blob_media_type: "text/markdown",
      }),
    }),
  ];
}

export function makeManifest(
  options: {
    version?: CanonicalOverrides;
    components?: ResolvedComponent[];
  } = {},
): ClientPackageManifest {
  return {
    package: makePackage(),
    version: makeVersion(options.version),
    components: options.components ?? defaultResolvedComponents(),
  };
}

/** A manifest with a tampered hash (integrity checks must fail). */
export function tamperHash(version: WorkPackageVersion): WorkPackageVersion {
  return { ...version, manifest_sha256: "0".repeat(64) };
}

export function randomId(): string {
  return randomUUID();
}

export const SKILL_BLOB_TEXT = SKILL_BLOB_CONTENT;
