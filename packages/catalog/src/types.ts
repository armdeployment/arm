/**
 * Wire types mirroring z.infer of the catalog schemas in @arm/proto.
 *
 * @arm/proto exports the zod SCHEMAS (toolSchema, workPackageVersionSchema,
 * …) but not their inferred types, and @arm/catalog has no zod dependency
 * (its deps are fixed: proto/db/config). The inferred shapes are therefore
 * declared structurally here. Keep them in sync with
 * packages/proto/src/index.ts; if proto later exports the inferred types,
 * replace these with re-exports.
 */

import type {
  ToolKind,
  ToolReviewStatus,
  WorkPackageMode,
  PackageAssignmentStatus,
} from "@arm/proto";

/** z.infer<typeof toolSchema> */
export interface Tool {
  id: string;
  tenant_id: string;
  name: string;
  kind: ToolKind;
  endpoint: string;
  auth_strategy: "oauth" | "pat" | "service_account" | "none";
  data_classification: "public" | "internal" | "confidential" | "restricted";
  owner_user_id: string;
  review_status: ToolReviewStatus;
}

/** z.infer<typeof toolVersionSchema> */
export interface ToolVersion {
  id: string;
  tool_id: string;
  version: string;
  manifest_sha256: string;
  config_schema: Record<string, unknown>;
  changelog: string;
}

/** z.infer<typeof workPackageSchema> */
export interface WorkPackage {
  id: string;
  tenant_id: string;
  role_key: string;
  name: string;
  family: string;
  mode: WorkPackageMode;
  description: string;
}

/** z.infer<typeof workPackageToolRefSchema> */
export interface WorkPackageToolRefWire {
  tool_id: string;
  tool_version: string;
  scopes: string[];
}

/** z.infer<typeof workPackageVersionSchema> */
export interface WorkPackageVersion {
  id: string;
  package_id: string;
  version: string;
  tools: WorkPackageToolRefWire[];
  skills: string[];
  subagent_configs: string[];
  permissions: string[];
  model_routing: Record<string, unknown>;
  budget_template: Record<string, unknown>;
  starter_prompts: string[];
  template_refs: string[];
  min_agent_version: string;
  manifest_sha256: string;
}

/** z.infer<typeof packageAssignmentSchema> */
export interface PackageAssignment {
  id: string;
  tenant_id: string;
  package_version_id: string;
  assignee_type: "user" | "agent" | "org_node";
  assignee_id: string;
  status: PackageAssignmentStatus;
  approver_user_id: string | null;
  approved_at: string | null;
}
