# ARM Agent Onboarding Guide

How employees connect their coding agent (OpenCode, Claude Code, Copilot, Pi) to ARM — with a pre-configured **Work Package** for their job role (D9).

---

## Quick Start — the employee path (30 seconds, zero config files)

You need two things from your ARM dashboard (**My Toolkit** page) or your department admin:
1. Your **tenant URL** (e.g. `https://arm.acme.com`)
2. Your **SSO login** + the **role package** you were assigned (e.g. `quality_engineer`, `office_worker_general`)

```bash
# 1. Install the ARM client (desktop app coming in 1.6 — CLI today)
npm i -g @arm-app/cli

# 2. Run setup for your role (ARM_TOKEN = short-lived token from My Toolkit)
ARM_TOKEN=<token from My Toolkit> \
arm setup --role quality_engineer --tenant-url https://arm.acme.com
```

The wizard does everything else:
1. SSO login (browser)
2. Role picker — only packages you're approved for
3. Detects/installs OpenCode if missing
4. Fetches your package manifest and **verifies its integrity** (sha256 over the signed canonical manifest — tampered configs are rejected, never applied)
5. Writes the config: MCP servers, skills, sub-agents, permissions — credentials as env-var references only
6. Connections wizard for third-party tools (see below)
7. Verifies a metered round-trip → *"Online. Dept budget remaining: $X. Tools connected: M/N."*

Your agent token is written to `<agent-home>/.arm-env` with mode `0600` — **never** into the agent config file.

---

## Connections wizard — third-party credentials

Every package tool declares how it authenticates. The wizard renders exactly what your package needs:

### Tier A — one-click OAuth (no copy-paste)
Jira/Atlassian · GitHub · Google (incl. BigQuery) · Microsoft 365/SharePoint · AWS IAM Identity Center
→ "Connect" → authorize in browser → ARM mints a short-lived, least-scope token.

### Tier B — guided PAT / service-account steps
The wizard shows server-pushed, versioned step-by-step guides (exact vendor-console clicks, scopes pre-filled):

| Tool | Guide |
|---|---|
| Jira | Atlassian → **Profile** → **Security** → **Create API token** → scopes: `read:jira-work` |
| GitHub | Settings → **Developer settings** → **Fine-grained PAT** → scopes: `repo` + `read:org` |
| GCP BigQuery | Console → **IAM** → **Service account** → create key JSON → role: `roles/bigquery.jobUser` |
| AWS | **IAM Identity Center** → CLI access → paste device code |
| SharePoint | Entra app consent flow (admin-granted) |

Skip-later is allowed: the package installs fully; unconnected tools show "not connected" until completed. Re-enter anytime.

---

## Manual Setup by Agent Type (advanced / fallback path)

### OpenCode

```json
// ~/.config/opencode/config.json
{
  "base_url": "https://data.arm.acme.com/v1",
  "api_key": "${ARM_AGENT_TOKEN}",
  "extra_headers": {
    "X-ARM-SubAccountId": "sa_your_sub_account",
    "X-ARM-TenantId": "your_tenant"
  }
}
```

### Claude Code

```toml
# ~/.claude/config.toml
[arm]
base_url = "https://data.arm.acme.com/v1"
api_key = "${ARM_AGENT_TOKEN}"
```

### GitHub Copilot

```json
// ~/.copilot/config.json
{
  "copilot_api_endpoint": "https://data.arm.acme.com/v1",
  "copilot_arm_token": "${ARM_AGENT_TOKEN}"
}
```

### Pi Coding Agent

```json
// ~/.pi-agent/config.json
{
  "base_url": "https://data.arm.acme.com/v1",
  "api_key": "${ARM_AGENT_TOKEN}"
}
```

---

## Verification

After setup, verify your agent is routing through ARM:

```bash
curl -H "Authorization: Bearer $ARM_AGENT_TOKEN" \
     https://data.arm.acme.com/health
# → {"status":"ok","service":"closed-proxy"}
```

Make a test LLM call — it appears in the ARM dashboard within seconds, attributed to your package.

---

## How It Works Under the Hood

```
Your Agent (opencode)             ARM Data Plane                    ARM Control Plane
     │  MCPs · skills · sub-agents   │                                  │
     │  permissions from package     │                                  │
     │  POST /v1/messages            │                                  │
     │  Bearer ${ARM_AGENT_TOKEN}    │                                  │
     ├──────────────────────────────►│ 1. Authenticate agent            │
     │                               │ 2. Quota + package budget        │
     │                               │ 3. Tool gate (tool:* verbs)      │
     │                               │ 4. Classification gate (D2)      │
     │                               │ 5. Route to provider             │
     │                               ├───────────────────────────────►  │
     │                               │ 6. Metered event (package_id,    │
     │◄──────────────────────────────┤    work_type, tokens, cache)     │
     │  Your prompt body NEVER       │  Metadata only → ClickHouse      │
     │  leaves the tenant VPC        │  (Invariant §11.1)               │
```

---

## Getting Your Credentials

1. **Via the ARM dashboard**: `/toolkit` → "Get token" → paste into `arm setup`
2. **Via your admin**: your department ARM admin assigns the role package for you
3. **Via the CLI**: `arm setup --role <key> --tenant-url <url>` (token from env)

---

## Troubleshooting

**"Connection refused"** — the ARM data plane proxy isn't running in your tenant VPC.

**"401 Unauthorized"** — tokens are short-lived (Invariant 4). Get a fresh one from My Toolkit.

**"Integrity verification FAILED"** — your package manifest failed its sha256 check. Do NOT edit the config manually; re-run `arm setup` and contact your ARM admin (this is the tamper guard working as designed).

**"403 DLP gate blocked"** — your agent holds confidential/restricted context and tried a closed model (Claude/GPT). Switch to a self-hosted model or reset the session.

**"429 Too Many Requests"** — your package's budget is exhausted. Wait, or request an increase from your department admin (one-tap in the approvals inbox).

**"Tool not connected"** — open the connections wizard and complete the tool's OAuth/PAT steps.
