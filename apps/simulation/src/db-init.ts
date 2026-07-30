/**
 * ARM Simulation — Database Initialization
 *
 * Creates schema in Postgres (control plane) and ClickHouse (event ledger),
 * then seeds Acme Manufacturing Corp with 5 departments, 6 users, 10 agents.
 *
 * Run: pnpm --filter @arm-app/simulation db:init
 */

import pg from "pg";
const { Client } = pg;

// ── Connection Config ──────────────────────────────────────────────────────

const PG_URL = process.env.DATABASE_URL ?? "postgresql://arm:arm_dev_password@localhost:5432/arm";
const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_AUTH = "arm:arm_dev_password";

// ── Postgres Schema (Control Plane) ────────────────────────────────────────

const PG_SCHEMA = `
-- Clean slate
DROP TABLE IF EXISTS management_decisions, policy_decisions, sub_accounts, agents, users, departments, models, tenants CASCADE;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'enterprise',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id),
  budget_monthly_cents BIGINT NOT NULL DEFAULT 0,
  spend_monthly_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  role TEXT DEFAULT 'engineer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  context_window INTEGER NOT NULL,
  input_cost_per_1m_cents INTEGER NOT NULL,
  output_cost_per_1m_cents INTEGER NOT NULL,
  allowed_classifications TEXT[] NOT NULL DEFAULT '{public,internal}'
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  stakeholder_user_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  task_type TEXT NOT NULL,
  classification_clearance TEXT NOT NULL DEFAULT 'internal',
  priority_tier TEXT NOT NULL DEFAULT 'standard',
  preferred_model TEXT NOT NULL DEFAULT 'minicpm5-1b',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sub_accounts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  api_key TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  monthly_quota_tokens BIGINT NOT NULL DEFAULT 2000000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE policy_decisions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE management_decisions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  decided_by TEXT NOT NULL REFERENCES users(id),
  impact_cents BIGINT DEFAULT 0,
  effective_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ── ClickHouse Schema (Event Ledger) ──────────────────────────────────────

const CH_SCHEMA = `
CREATE TABLE IF NOT EXISTS arm.llm_events (
  tenant_id String,
  event_id String,
  agent_id String,
  agent_name String,
  sub_account_id String,
  department String,
  model String,
  provider String,
  kind String,
  task_type String,
  classification String,
  prompt_tokens UInt32,
  completion_tokens UInt32,
  total_tokens UInt32,
  cloud_cost_cents UInt32,
  actual_cost_cents UInt32,
  savings_cents UInt32,
  latency_ms UInt32,
  status String,
  deny_reason String DEFAULT '',
  ts DateTime
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(ts))
ORDER BY (tenant_id, department, ts);

CREATE TABLE IF NOT EXISTS arm.policy_events (
  tenant_id String,
  agent_id String,
  decision String,
  reason String,
  detail String DEFAULT '',
  ts DateTime
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(ts))
ORDER BY ts;
`;

// ── Seed Data: Acme Manufacturing Corp ────────────────────────────────────

interface AgentSeed {
  id: string; name: string; type: string; stakeholder: string; dept: string;
  taskType: string; clearance: string; tier: string; model: string; apiKey: string;
}

const SEED_AGENTS: AgentSeed[] = [
  // Engineering — heavy LLM users, internal clearance
  { id: "agt_eng_code_review", name: "CodeReview-Bot", type: "claude_code", stakeholder: "usr_sarah", dept: "dept_eng", taskType: "code_review", clearance: "internal", tier: "critical", model: "qwen3.5", apiKey: "arm_sk_eng_review_x1a2b3" },
  { id: "agt_eng_docs", name: "DocGen-Agent", type: "opencode", stakeholder: "usr_sarah", dept: "dept_eng", taskType: "documentation", clearance: "internal", tier: "standard", model: "minicpm5-1b", apiKey: "arm_sk_eng_docs_m4n5o6" },
  { id: "agt_eng_arch", name: "ArchDesign-Agent", type: "pi", stakeholder: "usr_mike", dept: "dept_eng", taskType: "architecture_design", clearance: "internal", tier: "standard", model: "qwen3.5", apiKey: "arm_sk_eng_arch_p7q8r9" },

  // Manufacturing — confidential clearance, self-hosted only
  { id: "agt_mfg_toolpath", name: "ToolPath-Optimizer", type: "opencode", stakeholder: "usr_carlos", dept: "dept_mfg", taskType: "cnc_toolpath_optimization", clearance: "confidential", tier: "critical", model: "qwen3.5", apiKey: "arm_sk_mfg_tool_s0t1u2" },
  { id: "agt_mfg_quality", name: "QualityAnalysis-Agent", type: "claude_code", stakeholder: "usr_carlos", dept: "dept_mfg", taskType: "defect_analysis", clearance: "confidential", tier: "standard", model: "minicpm5-1b", apiKey: "arm_sk_mfg_qual_v3w4x5" },

  // QA — mixed clearance
  { id: "agt_qa_test", name: "TestGen-Agent", type: "copilot", stakeholder: "usr_jenny", dept: "dept_qa", taskType: "test_generation", clearance: "internal", tier: "standard", model: "minicpm5-1b", apiKey: "arm_sk_qa_test_y6z7a8" },
  { id: "agt_qa_security", name: "SecurityScan-Agent", type: "claude_code", stakeholder: "usr_jenny", dept: "dept_qa", taskType: "security_scan", clearance: "restricted", tier: "critical", model: "qwen3.5", apiKey: "arm_sk_qa_sec_b9c0d1" },

  // Supply Chain — internal, cost-sensitive
  { id: "agt_sc_forecast", name: "DemandForecast-Agent", type: "opencode", stakeholder: "usr_david", dept: "dept_sc", taskType: "demand_forecasting", clearance: "internal", tier: "standard", model: "minicpm5-1b", apiKey: "arm_sk_sc_fore_e2f3g4" },
  { id: "agt_sc_logistics", name: "LogisticsOpt-Agent", type: "copilot", stakeholder: "usr_david", dept: "dept_sc", taskType: "route_optimization", clearance: "internal", tier: "background", model: "minicpm5-1b", apiKey: "arm_sk_sc_log_h5i6j7" },

  // R&D — internal, experimental
  { id: "agt_rd_research", name: "ResearchAssist-Agent", type: "pi", stakeholder: "usr_alex", dept: "dept_rd", taskType: "research_synthesis", clearance: "internal", tier: "standard", model: "qwen3.5", apiKey: "arm_sk_rd_res_k8l9m0" },
];

async function main() {
  // ── Init Postgres ──
  console.log("▸ Initializing Postgres...");
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();
  await pgClient.query(PG_SCHEMA);

  // Tenant
  await pgClient.query(`
    INSERT INTO tenants (id, name, slug) VALUES ('tn_acme', 'Acme Manufacturing Corp', 'acme')
    ON CONFLICT (id) DO NOTHING
  `);

  // Departments with monthly budgets (cents)
  const depts = [
    ["dept_eng", "Engineering", null, 8000_00],
    ["dept_mfg", "Manufacturing", null, 6000_00],
    ["dept_qa", "Quality Assurance", null, 4000_00],
    ["dept_sc", "Supply Chain", null, 3000_00],
    ["dept_rd", "Research & Development", null, 5000_00],
  ];
  for (const [id, name, parent, budget] of depts) {
    await pgClient.query(
      `INSERT INTO departments (id, tenant_id, name, parent_id, budget_monthly_cents) VALUES ($1,'tn_acme',$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [id, name, parent, budget]
    );
  }

  // Users
  const users = [
    ["usr_sarah", "sarah.chen@acme.com", "Sarah Chen", "dept_eng", "dept_head"],
    ["usr_mike", "mike.rodriguez@acme.com", "Mike Rodriguez", "dept_eng", "senior_engineer"],
    ["usr_carlos", "carlos.mendes@acme.com", "Carlos Mendes", "dept_mfg", "dept_head"],
    ["usr_jenny", "jenny.park@acme.com", "Jenny Park", "dept_qa", "dept_head"],
    ["usr_david", "david.kim@acme.com", "David Kim", "dept_sc", "dept_head"],
    ["usr_alex", "alex.thompson@acme.com", "Alex Thompson", "dept_rd", "dept_head"],
    ["usr_ceo", "ceo@acme.com", "Patricia Vance (CEO)", null, "ceo"],
  ];
  for (const [id, email, name, dept, role] of users) {
    await pgClient.query(
      `INSERT INTO users (id, tenant_id, email, display_name, department_id, role) VALUES ($1,'tn_acme',$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [id, email, name, dept, role]
    );
  }

  // Models
  const models = [
    // Self-hosted via Ollama (actual cost = $0, but we track cloud-equivalent for savings calc)
    ["mdl_minicpm", "minicpm5-1b", "ollama", "self-hosted", 4096, 15, 60, "{public,internal,confidential,restricted}"],
    ["mdl_qwen35", "qwen3.5", "ollama", "self-hosted", 32768, 70, 210, "{public,internal,confidential,restricted}"],
    // Simulated cloud models (for cost comparison — not actually called)
    ["mdl_gpt4_sim", "gpt-4o", "openai", "cloud", 128000, 250, 1000, "{public,internal}"],
    ["mdl_claude_sim", "claude-sonnet-4", "anthropic", "cloud", 200000, 300, 1500, "{public,internal}"],
  ];
  for (const [id, name, provider, kind, ctx, ic, oc, cls] of models) {
    await pgClient.query(
      `INSERT INTO models (id, name, provider, kind, context_window, input_cost_per_1m_cents, output_cost_per_1m_cents, allowed_classifications) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [id, name, provider, kind, ctx, ic, oc, cls]
    );
  }

  // Agents
  for (const a of SEED_AGENTS) {
    await pgClient.query(
      `INSERT INTO agents (id, tenant_id, name, agent_type, stakeholder_user_id, department_id, task_type, classification_clearance, priority_tier, preferred_model, status)
       VALUES ($1,'tn_acme',$2,$3,$4,$5,$6,$7,$8,$9,'active') ON CONFLICT (id) DO NOTHING`,
      [a.id, a.name, a.type, a.stakeholder, a.dept, a.taskType, a.clearance, a.tier, a.model]
    );
    // Sub-account
    const saId = `sa_${a.id}`;
    await pgClient.query(
      `INSERT INTO sub_accounts (id, agent_id, api_key, api_key_prefix, monthly_quota_tokens)
       VALUES ($1,$2,$3,$4,2000000) ON CONFLICT (id) DO NOTHING`,
      [saId, a.id, a.apiKey, a.apiKey.slice(0, 16)]
    );
  }

  // Verify
  const agentCount = await pgClient.query("SELECT count(*) as c FROM agents");
  console.log(`  ✓ Postgres: 1 tenant, 5 departments, 7 users, 4 models, ${agentCount.rows[0].c} agents`);

  await pgClient.end();

  // ── Init ClickHouse ──
  console.log("▸ Initializing ClickHouse...");
  // Create tables
  for (const stmt of CH_SCHEMA.split(";").map(s => s.trim()).filter(Boolean)) {
    await chExec(stmt);
  }
  // Clear old data
  await chExec("TRUNCATE TABLE arm.llm_events");
  await chExec("TRUNCATE TABLE arm.policy_events");

  console.log("  ✓ ClickHouse: llm_events + policy_events tables ready (partitioned by tenant_id, toYYYYMM)");
  console.log("\n✓ Database initialization complete.\n");
}

async function chExec(sql: string): Promise<void> {
  const res = await fetch(`${CH_URL}/`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(CH_AUTH).toString("base64"),
      "Content-Type": "text/plain",
    },
    body: sql,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickHouse error: ${text}`);
  }
}

main().catch(e => { console.error("✗ Init failed:", e); process.exit(1); });
