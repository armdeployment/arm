/**
 * Shared test fixtures for client-core. Not a spec file — imported by tests.
 * `makeVersion` hashes the canonical (snake_case wire) manifest via the
 * package's own `manifestSha256` so integrity checks pass unless a test
 * tampers with the data. No canonicalizer is duplicated here — the canonical
 * shape is produced by `buildCanonicalManifest` in src/manifest.js.
 */

import { randomUUID } from "node:crypto";
import {
  manifestSha256,
  type CanonicalPackageManifest,
  type ClientPackageManifest,
  type Tool,
  type WorkPackage,
  type WorkPackageVersion,
} from "../src/index.js";

export const TENANT_ID = "99999999-9999-4999-8999-999999999999";
export const OWNER_ID = "88888888-8888-4888-8888-888888888888";
export const JIRA_TOOL_ID = "11111111-1111-4111-8111-111111111111";
export const GITHUB_TOOL_ID = "22222222-2222-4222-8222-222222222222";
export const PACKAGE_ID = "33333333-3333-4333-8333-333333333333";
export const VERSION_ID = "44444444-4444-4444-8444-444444444444";

/** The canonical manifest in its wire (snake_case) shape — the hashed form. */
export const DEFAULT_CANONICAL: CanonicalPackageManifest = {
  tools: [{ tool_id: JIRA_TOOL_ID, tool_version: "2.1.0", scopes: ["read:jira-work"] }],
  skills: ["8d-generator"],
  subagent_configs: ["root-cause"],
  permissions: ["tool:invoke:jira"],
  model_routing: { default: "haiku" },
  budget_template: { monthly_usd_cap: 150 },
  starter_prompts: ["Draft an 8D report"],
  template_refs: ["8d-template-v1"],
  min_agent_version: "0.16.0",
};

export type CanonicalOverrides = Partial<CanonicalPackageManifest>;

/**
 * A wire-format version whose manifest_sha256 is correct by construction.
 * The canonical manifest fields are the wire-shaped fields of the version
 * itself, so the version is built by spreading the canonical object and
 * hashing it with the package's `manifestSha256`.
 */
export function makeVersion(overrides: CanonicalOverrides = {}): WorkPackageVersion {
  const canonical: CanonicalPackageManifest = { ...DEFAULT_CANONICAL, ...overrides };
  return {
    id: VERSION_ID,
    package_id: PACKAGE_ID,
    version: "1.0.0",
    ...canonical,
    manifest_sha256: manifestSha256(canonical),
  };
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
  };
}

export function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: JIRA_TOOL_ID,
    tenant_id: TENANT_ID,
    name: "jira",
    kind: "mcp",
    endpoint: "https://mcp.acme.internal/jira",
    auth_strategy: "pat",
    data_classification: "internal",
    owner_user_id: OWNER_ID,
    review_status: "approved",
    ...overrides,
  };
}

export function makeManifest(
  options: {
    version?: CanonicalOverrides;
    tools?: Tool[];
  } = {},
): ClientPackageManifest {
  return {
    package: makePackage(),
    version: makeVersion(options.version),
    tools: options.tools ?? [
      makeTool(),
      makeTool({
        id: GITHUB_TOOL_ID,
        name: "github-issues",
        kind: "http_api",
        endpoint: "https://api.github.com",
        auth_strategy: "oauth",
      }),
    ],
  };
}

/** A manifest with a tampered hash (integrity checks must fail). */
export function tamperHash(version: WorkPackageVersion): WorkPackageVersion {
  return { ...version, manifest_sha256: "0".repeat(64) };
}

export function randomId(): string {
  return randomUUID();
}
