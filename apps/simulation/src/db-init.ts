/**
 * ARM Simulation — Database Initialization
 *
 * Creates schema in Postgres (control plane) and ClickHouse (event ledger),
 * then seeds a tenant from the selected Industry Profile (D6).
 *
 * Profile selection: SIM_PROFILE env var ("tech" | "manufacturing" | "custom").
 * Default: "manufacturing" (Acme Manufacturing Corp).
 *
 * All seed data — departments, agents, DLP patterns, classification levels —
 * is sourced from @arm/profiles. Nothing is hardcoded here. This demonstrates
 * the D6 pattern: the profile provides defaults, the provisioning step
 * materializes them as tenant config rows.
 *
 * Run: pnpm --filter @arm-app/simulation db:init
 */

import pg from "pg";
const { Client } = pg;
import {
  getProfile,
  compileDLPPatterns,
  isValidProfileId,
  flattenOrgTree,
  type ProfileId,
} from "@arm/profiles";

// ── Connection Config ──────────────────────────────────────────────────────

const PG_URL = process.env.DATABASE_URL ?? "postgresql://arm:arm_dev_password@localhost:5432/arm";
const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_AUTH = "arm:arm_dev_password";

// ── Postgres Schema (Control Plane) ────────────────────────────────────────

const PG_SCHEMA = `
-- Clean slate
DROP TABLE IF EXISTS management_decisions, policy_decisions, sub_accounts, agents, users, departments, models, dlp_patterns, classification_levels, work_type_taxonomies, tenants CASCADE;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'enterprise',
  industry_profile TEXT NOT NULL DEFAULT 'tech',
  profile_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classification_levels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  rank INTEGER NOT NULL,
  name TEXT NOT NULL UNIQUE,
  regulatory_flags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE dlp_patterns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  flags TEXT DEFAULT '',
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE work_type_taxonomies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  scope_type TEXT NOT NULL DEFAULT 'department',
  scope_id TEXT NOT NULL,
  name TEXT NOT NULL,
  labels TEXT[] NOT NULL DEFAULT '{}',
  classifier_version TEXT NOT NULL DEFAULT '1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id),
  node_type TEXT DEFAULT 'department',
  location TEXT,
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
  -- D7 work-type tag (per-prompt, enforcement-ready)
  work_type LowCardinality(String) DEFAULT '',
  usage_tags Array(String) DEFAULT [],
  classifier_stage LowCardinality(String) DEFAULT 'unknown',
  work_type_confidence Float32 DEFAULT -1,
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

// ── Profile Selection (D6) ───────────────────────────────────────────────

const PROFILE_ID: ProfileId = (() => {
  const requested = process.env.SIM_PROFILE ?? "manufacturing";
  return isValidProfileId(requested) ? requested : "manufacturing";
})();

const profile = getProfile(PROFILE_ID);

// Tenant name/identifier differ by profile
const TENANT_ID = "tn_acme";
const TENANT_SLUG = PROFILE_ID === "manufacturing" ? "acme" : "acme-tech";
const TENANT_NAME =
  PROFILE_ID === "manufacturing"
    ? "Acme Manufacturing Corp"
    : "Acme Tech Corp";

// ── Provisioning: materialize profile defaults into tenant config rows ─────

/**
 * Assign deterministic IDs to departments based on profile seed.
 * Mapping: department name → dept_<slug>
 */
function deptIdFromName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  return `dept_${slug}`;
}

/** Deterministic API key per agent. */
function apiKeyForAgent(agentName: string, index: number): string {
  const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `arm_sk_${slug}_${index.toString(36).padStart(6, "x")}`;
}

interface ProvisionedAgent {
  id: string;
  name: string;
  type: string;
  stakeholder: string;
  dept: string;
  taskType: string;
  clearance: string;
  tier: string;
  model: string;
  apiKey: string;
}

/**
 * Provision agents from the profile.
 * Assigns one stakeholder per department (the dept_head), distributes agents
 * across departments per the profile's seedAgents.
 */
function provisionAgents(): ProvisionedAgent[] {
  // Build department → stakeholder mapping
  const deptStakeholders: Record<string, string> = {};
  for (const dept of profile.orgTree.defaultDepartments) {
    const deptId = deptIdFromName(dept.name);
    const slug = dept.name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
    deptStakeholders[deptId] = `usr_${slug}`;
  }

  return profile.seedAgents.map((agent, i) => {
    const deptId = deptIdFromName(agent.departmentName);
    return {
      id: `agt_seed_${i}`,
      name: agent.name,
      type: agent.type,
      stakeholder: deptStakeholders[deptId] ?? Object.values(deptStakeholders)[0]!,
      dept: deptId,
      taskType: agent.taskType,
      clearance: agent.clearance,
      tier: agent.tier,
      model: agent.preferredModel,
      apiKey: apiKeyForAgent(agent.name, i),
    };
  });
}

const SEED_AGENTS = provisionAgents();

async function main() {
  // ── Init Postgres ──
  console.log(`▸ Initializing Postgres (profile: ${PROFILE_ID})...`);
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();
  await pgClient.query(PG_SCHEMA);

  // Tenant — seeded with industry_profile (D6)
  await pgClient.query(`
    INSERT INTO tenants (id, name, slug, industry_profile, profile_applied_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_ID, TENANT_NAME, TENANT_SLUG, PROFILE_ID]);

  // ── Classification levels (from profile, D6 dual-axis) ──
  for (const level of profile.classification.levels) {
    const id = `cls_${level.name}`;
    await pgClient.query(
      `INSERT INTO classification_levels (id, tenant_id, rank, name, regulatory_flags)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id, TENANT_ID, level.rank, level.name, level.regulatoryFlags]
    );
  }

  // ── DLP patterns (from profile — promoted from hardcoded, D6) ──
  for (const [i, pattern] of profile.dlpPatterns.entries()) {
    const id = `dlp_${i}`;
    await pgClient.query(
      `INSERT INTO dlp_patterns (id, tenant_id, name, pattern, flags, severity, category, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) ON CONFLICT (id) DO NOTHING`,
      [id, TENANT_ID, pattern.name, pattern.pattern, pattern.flags ?? "", pattern.severity, pattern.category]
    );
  }

  // ── Work-type taxonomies (from profile — per-department label sets, D7) ──
  for (const tax of profile.workTypeTaxonomies) {
    const deptId = deptIdFromName(tax.departmentName);
    const id = `tax_${deptId}`;
    await pgClient.query(
      `INSERT INTO work_type_taxonomies (id, tenant_id, scope_type, scope_id, name, labels, classifier_version)
       VALUES ($1, $2, 'department', $3, $4, $5, '1') ON CONFLICT (id) DO NOTHING`,
      [id, TENANT_ID, deptId, tax.departmentName, tax.labels]
    );
  }

  // ── Departments (from profile orgTree — recursive tree) ──
  const flatNodes = flattenOrgTree(profile.orgTree.nodes);
  for (const { node, path } of flatNodes) {
    const id = deptIdFromName(path.join(" / "));
    const parentId = path.length > 1 ? deptIdFromName(path.slice(0, -1).join(" / ")) : null;
    await pgClient.query(
      `INSERT INTO departments (id, tenant_id, name, parent_id, node_type, location, budget_monthly_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [id, TENANT_ID, node.name, parentId, node.type, node.location ?? null, node.budgetMonthlyCents ?? 0]
    );
  }

  // ── Users (one lead per top-level node + a CEO) ──
  const topNames = profile.orgTree.nodes.map(n => n.name);
  for (const deptName of topNames) {
    const deptId = deptIdFromName(deptName);
    const slug = deptName.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
    const userId = `usr_${slug}`;
    const email = `${slug}.head@${TENANT_SLUG}.com`;
    const displayName = deptName + " Lead";
    await pgClient.query(
      `INSERT INTO users (id, tenant_id, email, display_name, department_id, role)
       VALUES ($1, $2, $3, $4, $5, 'dept_head') ON CONFLICT (id) DO NOTHING`,
      [userId, TENANT_ID, email, displayName, deptId]
    );
  }
  // CEO
  await pgClient.query(
    `INSERT INTO users (id, tenant_id, email, display_name, department_id, role)
     VALUES ('usr_ceo', $1, 'ceo@${TENANT_SLUG}.com', 'CEO', NULL, 'ceo') ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID]
  );

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

  // ── Agents (from profile seedAgents) ──
  for (const a of SEED_AGENTS) {
    await pgClient.query(
      `INSERT INTO agents (id, tenant_id, name, agent_type, stakeholder_user_id, department_id, task_type, classification_clearance, priority_tier, preferred_model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') ON CONFLICT (id) DO NOTHING`,
      [a.id, TENANT_ID, a.name, a.type, a.stakeholder, a.dept, a.taskType, a.clearance, a.tier, a.model]
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
  const deptCount = await pgClient.query("SELECT count(*) as c FROM departments");
  const dlpCount = await pgClient.query("SELECT count(*) as c FROM dlp_patterns");
  const taxCount = await pgClient.query("SELECT count(*) as c FROM work_type_taxonomies");
  console.log(`  ✓ Postgres: 1 tenant (${PROFILE_ID}), ${deptCount.rows[0].c} depts, ${agentCount.rows[0].c} agents, ${dlpCount.rows[0].c} DLP patterns, ${taxCount.rows[0].c} work-type taxonomies`);

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
