/**
 * Connections wizard content (D9 Phase 1.6, roadmap §5.2).
 *
 * Every package ships a connections manifest: tool → auth method → guide id →
 * required scopes. Tier A (OAuth/SSO) is one click through the ARM control
 * plane; Tier B (PAT/service-account) renders server-pushed, versioned
 * step-by-step vendor-console guides here. Guides live in the client so the
 * wizard works offline; the control plane can override them with fresher
 * content (vendor UIs change).
 *
 * SECURITY (Invariants 4/5): guides instruct the user to paste credentials
 * into the ARM wizard, which seals them in the tenant vault. Credentials are
 * never written to agent config files — only env-var references.
 */

/** How a package tool authenticates against its vendor. */
export type ConnectionMethod = "oauth" | "pat" | "service_account" | "none";

/** A versioned, renderable step-by-step vendor guide. */
export interface ConnectionGuide {
  guideId: string;
  title: string;
  steps: string[];
}

/** One row of a package's connections manifest. */
export interface ConnectionsManifestEntry {
  toolId: string;
  toolName: string;
  authMethod: ConnectionMethod;
  guideId: string;
  requiredScopes: string[];
}

/** The built-in guide library (server can push newer versions). */
export const GUIDE_LIBRARY: Record<string, ConnectionGuide> = {
  "jira-pat": {
    guideId: "jira-pat",
    title: "Jira / Atlassian — Personal Access Token (PAT)",
    steps: [
      "Open https://id.atlassian.com/manage-profile/security/api-tokens and sign in.",
      'Click "Create API token".',
      'Label it (e.g. "ARM <role>") and click "Create".',
      "Copy the token — Atlassian shows it only once.",
      "Paste it into the ARM connections wizard; ARM seals it in the tenant vault and mints short-lived scoped tokens (read:jira-work). Never put it in an agent config file.",
    ],
  },
  "github-pat": {
    guideId: "github-pat",
    title: "GitHub — Fine-grained Personal Access Token",
    steps: [
      "Open https://github.com/settings/personal-access-tokens/new and sign in.",
      "Select the repositories your agent may read.",
      'Under "Repository permissions", grant Contents: Read-only and Metadata: Read-only.',
      'Under "Organization permissions", grant Members: Read-only (read:org).',
      'Set an expiration (≤ 90 days recommended) and click "Generate token".',
      "Paste the token into the ARM connections wizard — it is vaulted, never written to config files.",
    ],
  },
  "gcp-bigquery": {
    guideId: "gcp-bigquery",
    title: "Google Cloud BigQuery — Service Account Key",
    steps: [
      "Open https://console.cloud.google.com/iam-admin/serviceaccounts and pick your project.",
      'Click "Create Service Account" and name it (e.g. "arm-bigquery-<role>").',
      'Click "Create and Continue".',
      'Grant the role "BigQuery Job User" (roles/bigquery.jobUser) — least privilege.',
      'Click "Done", open the account, go to "Keys" → "Add Key" → "Create new key".',
      "Choose JSON and download the key file.",
      "Upload the JSON key into the ARM connections wizard — it is sealed into the tenant vault and never written to agent config.",
    ],
  },
  "aws-ssso": {
    guideId: "aws-ssso",
    title: "AWS IAM Identity Center — CLI Access",
    steps: [
      "Open the AWS IAM Identity Center console and select your access portal.",
      "Pick the permission set bound to your role.",
      'From the portal, choose "Command line or programmatic access".',
      "Copy the short-term credentials (Option 1) or configure `aws sso login` (Option 2).",
      'In the ARM connections wizard choose "AWS IAM Identity Center" and sign in — ARM mints short-lived, least-scope session tokens.',
    ],
  },
  "sharepoint-oauth": {
    guideId: "sharepoint-oauth",
    title: "SharePoint / Microsoft 365 — OAuth Consent",
    steps: [
      'In the ARM connections wizard click "Connect" next to SharePoint.',
      "You are redirected to the Microsoft Entra consent screen.",
      "Sign in with your work account.",
      'Review the scopes (Sites.Read.All, Files.Read.All) and click "Accept".',
      "ARM mints a short-lived scoped token via the tenant-vault broker — no copy-paste, nothing lands in config files.",
    ],
  },
  "generic-pat": {
    guideId: "generic-pat",
    title: "Vendor Portal — Token or Service-Account Key",
    steps: [
      "Open your vendor's developer/security settings page.",
      "Create a token or service-account key with the scopes shown in the wizard.",
      "Set the shortest sensible expiration and copy the value.",
      "Paste it into the ARM connections wizard — it is vaulted and never written to config files.",
    ],
  },
  "generic-oauth": {
    guideId: "generic-oauth",
    title: "Vendor — OAuth Connection",
    steps: [
      'Open the ARM connections center and click "Connect" next to the tool.',
      "Authorize in the browser when the vendor consent screen appears.",
      "ARM mints a short-lived, least-scope token — no copy-paste, nothing in config files.",
    ],
  },
};

/** Resolve the guide for a connections-manifest entry (throws if unknown). */
export function getConnectionGuide(entry: ConnectionsManifestEntry): ConnectionGuide {
  const guide = GUIDE_LIBRARY[entry.guideId];
  if (!guide) {
    throw new Error(`unknown connection guide "${entry.guideId}" for tool "${entry.toolName}"`);
  }
  return guide;
}

/** Render a guide's steps as a numbered, printable list. */
export function renderGuideSteps(entry: ConnectionsManifestEntry): string[] {
  return getConnectionGuide(entry).steps.map((step, index) => `${index + 1}. ${step}`);
}
