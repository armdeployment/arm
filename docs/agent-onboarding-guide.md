# ARM Agent Onboarding Guide

How employees connect their coding agent (OpenCode, Claude Code, Copilot, Pi) to ARM — with a pre-configured **Work Package** for their job role (D9, updated D10/D11 — `docs/solutions/2026-08-21-d11-questionnaire-provisioning.md`).

---

## Quick Start — the employee path (a few minutes, zero config files, zero role keys)

You need one thing: **a link from your admin**, or your company's ARM setup URL
(e.g. `https://arm.acme.com/start`).

1. **Open the link.** Answer a handful of multiple-choice questions about your
   day-to-day work — no free text, ever (Invariant 1). ARM figures out your
   job function and recommends a package: _"We recommend the **Quality
   Engineer** package."_
2. **Download.** This issues a signed, single-use setup token (15-minute TTL)
   that travels as a small `.armsetup` file, or as a 6-character activation
   code you can read aloud or type.
3. **Double-click the downloaded file.** That's it — no terminal.
   (Prefer the terminal? `arm setup --token <the-code>` does the same thing.
   Just running `arm setup` with nothing prompts you for the code.)

The client does everything else, and asks you nothing else:

1. Redeems the setup token exactly once against the control plane
2. Detects/installs OpenCode if missing
3. Verifies the package manifest's integrity (sha256 over the signed
   canonical manifest — tampered configs are rejected, never applied)
4. Installs each component by verified digest — a mismatch is a hard
   failure, never a silent skip
5. Writes the config: MCP servers, skills, sub-agents, permissions —
   credentials as env-var references only
6. Connections wizard for third-party tools (see below)
7. Verifies a metered round-trip → _"Online. Dept budget remaining: $X. Tools connected: M/N."_

If your recommended package needs manager approval, you still get a working
agent right away — you'll see _"your agent is installed; tool access is
waiting on your manager"_ instead of a blocked install.

Your agent token is written to `<agent-home>/.arm-env` with mode `0600` — **never** into the agent config file.

### No link? No installer yet?

Ask your IT team for your company's ARM setup link. Once the ARM client is
installed (an MSI/pkg/deb your IT team pushes, or `npm i -g @arm-app/cli` for
now), running `arm setup` with no arguments prints the link and prompts you
for an activation code.

---

## Connections wizard — third-party credentials

Every package component declares how it authenticates. The wizard renders exactly what your package needs:

### Tier A — one-click OAuth (no copy-paste)

Jira/Atlassian · GitHub · Google (incl. BigQuery) · Microsoft 365/SharePoint · AWS IAM Identity Center
→ "Connect" → authorize in browser → ARM mints a short-lived, least-scope token.

### Tier B — guided PAT / service-account steps

The wizard shows server-pushed, versioned step-by-step guides (exact vendor-console clicks, scopes pre-filled):

| Tool         | Guide                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| Jira         | Atlassian → **Profile** → **Security** → **Create API token** → scopes: `read:jira-work`   |
| GitHub       | Settings → **Developer settings** → **Fine-grained PAT** → scopes: `repo` + `read:org`     |
| GCP BigQuery | Console → **IAM** → **Service account** → create key JSON → role: `roles/bigquery.jobUser` |
| AWS          | **IAM Identity Center** → CLI access → paste device code                                   |
| SharePoint   | Entra app consent flow (admin-granted)                                                     |

Skip-later is allowed: the package installs fully; unconnected tools show "not connected" until completed. Re-enter anytime.

---

## Advanced / CI path — direct role provisioning

Power users, CI pipelines, and automated-agent fleets that already know their
role key can skip the questionnaire entirely:

```bash
npm i -g @arm-app/cli

# ARM_TOKEN = short-lived control-plane catalog token
ARM_TOKEN=<token from My Toolkit> \
arm setup --role quality_engineer --tenant-url https://arm.acme.com
```

This is the same D9 Phase 1.6 wire behaviour as before, unchanged: SSO-scoped
role assignment, manifest fetch by role key, config render, connections
wizard, metered verification. `arm doctor` re-runs verification and prints
the full failure-code reference at any time.

---

## Manual Setup by Agent Type (fallback path)

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
Employee                    apps/onboarding                packages/trpc
   │  opens link              (port 3300)                  onboarding-router
   │  answers questions   ───────────────────────────►  score()/recommend()
   │                          "We recommend X"              (pure, deterministic,
   │  downloads .armsetup ◄───────────────────────────      no free text stored)
   │                          setup token issued
   │
   ▼
arm (packages/client-core)        ARM Data Plane                ARM Control Plane
   │  redeems token once            │                                  │
   │  verifies manifest sha256      │                                  │
   │  installs components by digest │                                  │
   │  POST /v1/messages             │                                  │
   │  Bearer ${ARM_AGENT_TOKEN}     │                                  │
   ├────────────────────────────────►│ 1. Authenticate agent            │
   │                                 │ 2. Quota + package budget        │
   │                                 │ 3. Tool gate (tool:* verbs)      │
   │                                 │ 4. Classification gate (D2)      │
   │                                 │ 5. Route to provider             │
   │                                 ├───────────────────────────────►  │
   │                                 │ 6. Metered event (package_id,    │
   │◄────────────────────────────────┤    work_type, tokens, cache)     │
   │  Your prompt body NEVER         │  Metadata only → ClickHouse      │
   │  leaves the tenant VPC          │  (Invariant §11.1)               │
```

---

## Getting Your Credentials

1. **The easy way**: open the setup link from your admin/onboarding email → answer the questionnaire → download → done. No token to copy.
2. **Via your admin**: your department ARM admin can hand you a 6-character activation code directly.
3. **Via the CLI (advanced path)**: `arm setup --role <key> --tenant-url <url>` (needs `ARM_TOKEN` from My Toolkit).

---

## Troubleshooting

Every failure below carries a stable code and a plain-language fix — the
same set `arm doctor` prints and the `/help/<code>` page on the onboarding
site shows (e.g. `/help/TOKEN_EXPIRED`).

**"This setup link has expired" (`TOKEN_EXPIRED`)** — setup links expire 15 minutes after issue. Ask your admin for a new one, or restart the questionnaire.

**"This setup link was already used" (`TOKEN_ALREADY_USED`)** — setup tokens are single-use. Ask IT for a new link.

**"Integrity verification FAILED" (`MANIFEST_TAMPERED`)** — your package manifest failed its sha256 check. Do NOT edit the config manually; re-run setup and contact your ARM admin (this is the tamper guard working as designed).

**"Digest mismatch" (`DIGEST_MISMATCH`)** — a downloaded component didn't match its verified digest. Do not proceed; contact IT — this can indicate a compromised network.

**"Connection refused" / proxy unreachable (`PROXY_UNREACHABLE`)** — the ARM data plane proxy isn't reachable from your machine (VPN required for on-prem tenants).

**"403 DLP gate blocked"** — your agent holds confidential/restricted context and tried a closed model (Claude/GPT). Switch to a self-hosted model or reset the session.

**"429 Too Many Requests"** — your package's budget is exhausted. Wait, or request an increase from your department admin (one-tap in the approvals inbox).

**"Tool not connected" (`CONNECTION_DECLINED`)** — open the connections wizard and complete the tool's OAuth/PAT steps.

**"Tool access is waiting on your manager"** — expected for packages with `approval_required = true` (A6). Your agent installed and works; the specific tool grant is pending a one-tap approval.
