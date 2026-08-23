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

/** How a package component authenticates against its vendor. */
export type ConnectionMethod = "oauth" | "pat" | "service_account" | "none";

/** A versioned, renderable step-by-step vendor guide. */
export interface ConnectionGuide {
  guideId: string;
  title: string;
  steps: string[];
}

/** One row of a package's connections manifest (D10: keyed by component, not tool). */
export interface ConnectionsManifestEntry {
  componentId: string;
  componentName: string;
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
  "gitlab-pat": {
    guideId: "gitlab-pat",
    title: "GitLab — Personal Access Token (PAT)",
    steps: [
      "Open your GitLab and sign in, then click your avatar (top right) and choose \"Edit profile\".",
      'In the left menu, click "Access Tokens".',
      'Under "Add new token", give it a name like "ARM agent".',
      'Tick the scopes "api" and "read_repository" — nothing else.',
      'Set an expiration (90 days or less) and click "Create personal access token".',
      "Copy the token — GitLab shows it only once — and paste it into the ARM connections wizard. ARM seals it in the tenant vault; never put it in an agent config file.",
    ],
  },
  "azure-devops-oauth": {
    guideId: "azure-devops-oauth",
    title: "Azure DevOps — OAuth Authorization",
    steps: [
      "Open your Azure DevOps organization (https://dev.azure.com/<your-org>) and sign in.",
      'Click "Organization Settings" (the gear icon, bottom left).',
      'Under "Security", open "Policies".',
      'Find "OAuth policies" — the ARM app appears there once your admin has registered it; if it is missing, ask your org admin to add it.',
      "Click the ARM app and approve the requested scopes.",
      'In the ARM connections wizard click "Connect" — ARM completes the browser authorization and mints a short-lived scoped token.',
    ],
  },
  "confluence-oauth": {
    guideId: "confluence-oauth",
    title: "Confluence / Atlassian — OAuth App Consent",
    steps: [
      "Ask your Confluence admin to approve the ARM app in Atlassian Administration (admin.atlassian.com → Products → Confluence → \"Connected apps\").",
      "The admin grants ARM read access to the spaces your role needs — nothing wider.",
      'In the ARM connections wizard, click "Connect" next to Confluence.',
      'Sign in with your Atlassian account on the consent screen and click "Accept".',
      "ARM mints a short-lived scoped token — nothing is copied, nothing lands in config files.",
    ],
  },
  "jama-pat": {
    guideId: "jama-pat",
    title: "Jama Connect — API Token (PAT)",
    steps: [
      'Sign in to Jama Connect and click "Admin" (the gear) in the top bar.',
      'Go to "Users" and open your own user account.',
      'In your user profile, open the "API tokens" section.',
      'Click "New API token" (or "Generate"), and name it "ARM agent".',
      "Copy the token and paste it into the ARM connections wizard — it is vaulted and never written to config files.",
    ],
  },
  "polarion-pat": {
    guideId: "polarion-pat",
    title: "Siemens Polarion — API Token (PAT)",
    steps: [
      'Sign in to Polarion, then open "Administration" (the gear icon).',
      'Click "Users" and open your own user account.',
      'In your user settings, find "API tokens" and click "Create token".',
      'Name it "ARM agent", set the shortest useful expiry, and create it.',
      "Copy the token value and paste it into the ARM connections wizard — it is vaulted and never written to config files.",
    ],
  },
  "codebeamer-pat": {
    guideId: "codebeamer-pat",
    title: "codebeamer — Personal Access Token (PAT)",
    steps: [
      "Sign in to codebeamer and click your user name (top right).",
      'Open "User Account" settings.',
      'Click "Personal Access Tokens".',
      'Choose "Generate new token", name it "ARM agent", and confirm.',
      "Copy the token — codebeamer shows it only once — and paste it into the ARM connections wizard. It is vaulted and never written to config files.",
    ],
  },
  "valispace-pat": {
    guideId: "valispace-pat",
    title: "Valispace — API Token (PAT)",
    steps: [
      'Sign in to Valispace and open "Account Settings" from your profile menu.',
      'Select "API tokens".',
      'Click "New token" and name it "ARM agent".',
      "Copy the generated token and paste it into the ARM connections wizard — it is vaulted and never written to config files.",
    ],
  },
  "teamcenter-pat": {
    guideId: "teamcenter-pat",
    title: "Siemens Teamcenter — Service Credentials (PLM admin provisions)",
    steps: [
      "Teamcenter service credentials are provisioned by your PLM administrator, not self-service — ask your Teamcenter admin (PLM team) to create service credentials for the ARM agent.",
      'Your admin opens Teamcenter Active Workspace → "Admin" → "Service credentials" and creates a credential with read-only access to the workspaces your role needs.',
      "Your admin shares the credential with you through your company's approved secret store.",
      "Paste the credential into the ARM connections wizard — ARM seals it in the tenant vault and mints short-lived scoped tokens. Never write it into an agent config file.",
    ],
  },
  "windchill-pat": {
    guideId: "windchill-pat",
    title: "PTC Windchill — API Credentials (PLM admin provisions)",
    steps: [
      "Windchill API credentials are provisioned by your PLM administrator — ask your Windchill admin to create credentials for the ARM agent.",
      'Your admin opens Windchill → "Utilities" → "Preference Management" and creates the API credential with read-only access to the objects your role needs.',
      "Your admin shares the credential with you through your company's approved secret store.",
      "Paste the credential into the ARM connections wizard — ARM seals it in the tenant vault and mints short-lived scoped tokens. Never write it into an agent config file.",
    ],
  },
  "net-inspect-pat": {
    guideId: "net-inspect-pat",
    title: "Net-Inspect — API Access Token (PAT)",
    steps: [
      'Sign in to Net-Inspect and open "Administration".',
      'Go to "API access tokens".',
      'Click "New token", name it "ARM agent", and set the shortest useful expiry.',
      "Copy the token and paste it into the ARM connections wizard — it is vaulted and never written to config files.",
    ],
  },
  "aqua-pro-oauth": {
    guideId: "aqua-pro-oauth",
    title: "AQuA Pro — SSO App Consent (admin grants)",
    steps: [
      "Ask your AQuA Pro administrator to approve the ARM application in the AQuA Pro SSO / identity-provider settings.",
      'Once approved, open the ARM connections wizard and click "Connect" next to AQuA Pro.',
      'Sign in on the SSO consent screen and click "Accept".',
      "ARM mints a short-lived scoped token — nothing to copy, nothing lands in config files.",
    ],
  },
  "sap-qm-service-account": {
    guideId: "sap-qm-service-account",
    title: "SAP BTP — Service Instance Key (Quality Management)",
    steps: [
      "Open the SAP BTP cockpit and sign in to your subaccount.",
      'Go to "Security" → "Service instances" and open the Quality Management service instance your admin set up (ask your SAP admin if you do not see it).',
      'On the instance, click "Create service key" (or open the existing key) and pick the role with QM read access — nothing wider.',
      "Download the JSON key file.",
      "IMPORTANT: this is a JSON key file — never paste its contents into an agent config file. Paste it into the ARM connections wizard (or store it in your keychain) so ARM vaults it and mints short-lived scoped tokens from it.",
    ],
  },
  "omniverse-oauth": {
    guideId: "omniverse-oauth",
    title: "NVIDIA Omniverse — Nucleus App Authorization",
    steps: [
      "Open NVIDIA Omniverse and sign in with your NVIDIA account.",
      'Open the "Nucleus" settings for your server.',
      'Under "App authorization" (or "Authorized apps"), find or add the ARM application.',
      "Approve the ARM app with read access to the Nucleus server.",
      'Back in the ARM connections wizard click "Connect" — ARM completes the authorization and mints a short-lived scoped token.',
    ],
  },
  "cplace-oauth": {
    guideId: "cplace-oauth",
    title: "cplace — SSO App Consent (admin grants)",
    steps: [
      "Ask your cplace administrator to approve the ARM application in the cplace admin console (SSO / connected apps).",
      'Once approved, open the ARM connections wizard and click "Connect" next to cplace.',
      'Sign in on the consent screen and click "Accept".',
      "ARM mints a short-lived scoped token — nothing to copy, nothing lands in config files.",
    ],
  },
  "doors-oauth": {
    guideId: "doors-oauth",
    title: "IBM ELM / DOORS — Jazz OAuth Consumer",
    steps: [
      "Ask your IBM ELM administrator to register the ARM application as an OAuth consumer in the Jazz Team Server.",
      'Your admin opens the Jazz Team Server admin page → "OAuth Consumers" (the ELM "Friend" registration) and registers the ARM app with read access to DOORS data.',
      'Once registered, open the ARM connections wizard and click "Connect" next to DOORS.',
      'Sign in on the Jazz authorization page and click "Allow".',
      "ARM mints a short-lived scoped token — nothing to copy, nothing lands in config files.",
    ],
  },
  "vendor-pat": {
    guideId: "vendor-pat",
    title: "Vendor Portal — Personal Access Token or Service Key",
    steps: [
      "Open your vendor's security or developer settings page.",
      "Create a personal access token or API key with the scopes shown in the wizard.",
      "Set the shortest sensible expiration and copy the value.",
      "Paste it into the ARM connections wizard — ARM vaults it and mints short-lived scoped tokens; never put it in an agent config file.",
    ],
  },
  "vendor-oauth": {
    guideId: "vendor-oauth",
    title: "Vendor — OAuth Connection",
    steps: [
      'Open the ARM connections center and click "Connect" next to the tool.',
      "Authorize in the browser when the vendor consent screen appears.",
      "ARM mints a short-lived, least-scope token — no copy-paste, nothing lands in config files.",
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

/**
 * Generic fallback guides by auth method — used when a tool has no specific
 * guide (or its pinned guide id is no longer in the library, e.g. after a
 * vendor UI changed and the server pulled the old guide).
 */
const GENERIC_GUIDE_BY_METHOD: Partial<Record<ConnectionMethod, string>> = {
  oauth: "vendor-oauth",
  pat: "vendor-pat",
  service_account: "vendor-pat",
};

/**
 * Resolve the guide for a connections-manifest entry: prefer the specific
 * guide the manifest pinned (`entry.guideId`), then fall back to the generic
 * guide for the tool's auth method. Throws only when neither exists.
 */
export function getConnectionGuide(entry: ConnectionsManifestEntry): ConnectionGuide {
  const guide = GUIDE_LIBRARY[entry.guideId];
  if (guide) {
    return guide;
  }
  const genericId = GENERIC_GUIDE_BY_METHOD[entry.authMethod];
  if (genericId !== undefined) {
    const generic = GUIDE_LIBRARY[genericId];
    if (generic) {
      return generic;
    }
  }
  throw new Error(`unknown connection guide "${entry.guideId}" for component "${entry.componentName}"`);
}

/** Render a guide's steps as a numbered, printable list. */
export function renderGuideSteps(entry: ConnectionsManifestEntry): string[] {
  return getConnectionGuide(entry).steps.map((step, index) => `${index + 1}. ${step}`);
}
