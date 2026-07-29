# ARM Agent Onboarding Guide

How to connect your coding agent (OpenCode, Claude Code, Copilot, Pi) to the ARM governance platform.

---

## Quick Start (30 seconds)

### If you have an ARM sub-account ID and API key:

```bash
# Run the setup wizard
npx tsx packages/agent-sdk/src/setup.ts

# Or from the ARM repo:
pnpm --filter @arm/agent-sdk setup
```

The wizard will:
1. Ask which agent you use
2. Ask for your ARM tenant URL, sub-account ID, and API key
3. Write the correct config file for your agent
4. Verify the connection to the ARM proxy

---

## Manual Setup by Agent Type

### OpenCode

```bash
# Edit ~/.config/opencode/config.json
{
  "base_url": "https://data.arm.acme.com/v1",
  "api_key": "arm_sk_your_sub_account_id",
  "extra_headers": {
    "X-ARM-SubAccountId": "sa_your_sub_account",
    "X-ARM-TenantId": "your_tenant"
  }
}
```

### Claude Code

```bash
# Edit ~/.claude/config.toml
[arm]
base_url = "https://data.arm.acme.com/v1"
api_key = "arm_sk_your_sub_account_id"
```

### GitHub Copilot

```bash
# Edit ~/.copilot/config.json
{
  "copilot_api_endpoint": "https://data.arm.acme.com/v1",
  "copilot_arm_token": "arm_sk_your_sub_account_id"
}
```

### Pi Coding Agent

```bash
# Edit ~/.pi-agent/config.json
{
  "base_url": "https://data.arm.acme.com/v1",
  "api_key": "arm_sk_your_sub_account_id"
}
```

### Custom / Generic (any OpenAI-compatible agent)

```bash
# Create ~/.arm/agent.env
ARM_BASE_URL=https://data.arm.acme.com/v1
ARM_API_KEY=arm_sk_your_sub_account_id
ARM_SUB_ACCOUNT_ID=sa_your_sub_account
```

---

## Verification

After setup, verify your agent is routing through ARM:

```bash
curl -H "Authorization: Bearer arm_sk_your_key" \
     https://data.arm.acme.com/health
# → {"status":"ok","service":"closed-proxy"}
```

Make a test LLM call — it will appear in the ARM dashboard within seconds.

---

## How It Works Under the Hood

```
Your Agent                    ARM Proxy                   LLM Provider
     │                            │                            │
     │ POST /v1/messages          │                            │
     │ Authorization: Bearer      │                            │
     │   arm_sk_xxx               │                            │
     │ X-ARM-SubAccountId: sa_xx  │                            │
     ├───────────────────────────►│                            │
     │                            │ 1. Authenticate agent      │
     │                            │ 2. Check quota             │
     │                            │ 3. DLP gate (classif)      │
     │                            │ 4. Route to provider       │
     │                            ├───────────────────────────►│
     │                            │◄───────────────────────────┤
     │                            │ 5. Emit metering event     │
     │◄───────────────────────────┤                            │
     │                            │                            │
     │  Your prompt body NEVER    │                            │
     │  leaves the tenant VPC     │  Only metadata goes to     │
     │  (Invariant §11.1)         │  the control plane         │
```

---

## Getting Your Credentials

To get a sub-account ID and API key:

1. **Via the ARM dashboard**: Go to `/agents` → "Add Agent" → follow the onboarding flow
2. **Via your admin**: Ask your department's ARM admin to provision an agent for you
3. **Via the CLI**: Run `arm agent init` (requires ARM CLI installed)

---

## Troubleshooting

**"Connection refused"** — ensure the ARM data plane proxy is running in your tenant VPC.

**"401 Unauthorized"** — check your API key. Keys are short-lived; get a new one from the dashboard.

**"403 DLP gate blocked"** — your agent has confidential/restricted clearance and tried to use a closed model (Claude/GPT). Switch to a self-hosted model (GLM-5.2, DeepSeek V3).

**"429 Too Many Requests"** — your agent hit its daily quota. Wait or request a quota increase from your department admin.

**"Config not taking effect"** — restart your agent tool after changing the config.
