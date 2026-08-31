/**
 * ARM Simulation — Real Data-Plane Proxy
 *
 * Receives OpenAI-format /v1/chat/completions requests, authenticates against
 * Postgres, enforces policy (budget, quota, DLP, classification gate), routes
 * to Ollama, and meters every call to ClickHouse.
 *
 * Run: pnpm --filter @arm-app/simulation proxy
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import pg from "pg";
const { Client } = pg;
import { classifyPrompt, type WorkTypeTaxonomy, type PromptFeatures } from "@arm/classifier";

const PORT = parseInt(process.env.PROXY_PORT ?? "8787");
const PG_URL = process.env.DATABASE_URL ?? "postgresql://arm:arm_dev_password@localhost:5432/arm";
const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_AUTH = "arm:arm_dev_password";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

// ── DB Connection Pool ─────────────────────────────────────────────────────

const { Pool } = pg;
const pgPool = new Pool({ connectionString: PG_URL, max: 20 });

async function ensurePg(): Promise<void> {
  // Pool manages connections lazily; verify connectivity.
  const c = await pgPool.connect();
  c.release();
}

// Helper that runs a query using a pooled client.
async function pgQuery(text: string, params?: any[]) {
  const c = await pgPool.connect();
  try {
    return await c.query(text, params);
  } finally {
    c.release();
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── ClickHouse Helpers ─────────────────────────────────────────────────────

async function chInsert(
  table: string,
  values: Record<string, string | number | string[]>,
): Promise<void> {
  const cols = Object.keys(values).join(", ");
  const vals = Object.values(values)
    .map((v) => {
      if (typeof v === "number") return v;
      if (Array.isArray(v)) {
        // ClickHouse Array(String) format: ['tag1','tag2']
        return `[${v.map((t) => `'${String(t).replace(/'/g, "\\'")}'`).join(",")}]`;
      }
      return `'${String(v).replace(/'/g, "\\'")}'`;
    })
    .join(", ");
  await fetch(`${CH_URL}/?query=${encodeURIComponent(`INSERT INTO ${table} (${cols}) VALUES`)}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(CH_AUTH).toString("base64"),
      "Content-Type": "text/plain",
    },
    body: `(${vals})`,
  });
}

// ── DLP Hooks (loaded from tenant config — seeded from profile, D6) ───────

interface DLPRule {
  name: string;
  regex: RegExp;
  severity: string;
}

// Cached DLP patterns from the dlp_patterns table (per-tenant config).
// The profile seeds these at provisioning time; runtime reads the DB, never
// the profile id. This is the D6 pattern in action.
let dlpCache: { rules: DLPRule[]; loadedAt: number } | null = null;
const DLP_CACHE_TTL_MS = 60_000; // refresh every 60s

async function loadDLPPatterns(): Promise<DLPRule[]> {
  const now = Date.now();
  if (dlpCache && now - dlpCache.loadedAt < DLP_CACHE_TTL_MS) {
    return dlpCache.rules;
  }
  await ensurePg();
  const result = await pgQuery(
    `SELECT name, pattern, flags, severity FROM dlp_patterns WHERE enabled = TRUE`,
  );
  const rules: DLPRule[] = result.rows.map((r: any) => ({
    name: r.name,
    regex: new RegExp(r.pattern, r.flags || ""),
    severity: r.severity,
  }));
  dlpCache = { rules, loadedAt: now };
  return rules;
}

async function scanDLP(
  text: string,
): Promise<{ matched: boolean; pattern?: string; severity?: string }> {
  const rules = await loadDLPPatterns();
  for (const p of rules) {
    if (p.regex.test(text)) return { matched: true, pattern: p.name, severity: p.severity };
  }
  return { matched: false };
}

// ── Request Handlers ───────────────────────────────────────────────────────

async function handleChatCompletion(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
): Promise<void> {
  const t0 = Date.now();
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return sendJSON(res, 400, { error: "Invalid JSON" });
  }

  // 1. AUTH — verify API key
  const authHeader = req.headers.authorization ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey)
    return sendJSON(res, 401, { error: { message: "Missing API key", type: "auth_error" } });

  await ensurePg();
  const saResult = await pgQuery(
    `SELECT sa.id as sub_account_id, sa.agent_id, sa.monthly_quota_tokens,
            a.name as agent_name, a.department_id, a.classification_clearance,
            a.priority_tier, a.preferred_model, a.status, a.task_type,
            d.name as dept_name
     FROM sub_accounts sa
     JOIN agents a ON sa.agent_id = a.id
     JOIN departments d ON a.department_id = d.id
     WHERE sa.api_key = $1`,
    [apiKey],
  );

  if (saResult.rows.length === 0) {
    await logPolicy("unknown", "deny", "Invalid API key", apiKey.slice(0, 12));
    return sendJSON(res, 401, { error: { message: "Invalid API key", type: "auth_error" } });
  }

  const sa = saResult.rows[0];

  // Agent suspended?
  if (sa.status === "suspended") {
    await logPolicy(sa.agent_id, "deny", "Agent suspended", "management decision");
    return sendJSON(res, 403, {
      error: { message: "Agent suspended by management", type: "policy_error" },
    });
  }

  // 2. CLASSIFICATION GATE — confidential/restricted → self-hosted only
  let effectiveModel = parsed.model ?? sa.preferred_model;
  if (
    sa.classification_clearance === "confidential" ||
    sa.classification_clearance === "restricted"
  ) {
    // Force self-hosted model — both our Ollama models qualify
    if (!["minicpm5-1b", "qwen3.5"].includes(effectiveModel)) {
      const original = effectiveModel;
      effectiveModel = sa.preferred_model;
      await logPolicy(
        sa.agent_id,
        "downgrade",
        "Classification gate: cloud model blocked",
        `${original} → ${effectiveModel} (${sa.classification_clearance} clearance)`,
      );
      parsed.model = effectiveModel;
    }
  }

  // 3. DLP SCAN — check prompt for sensitive data (patterns from tenant config)
  const promptText = JSON.stringify(parsed.messages ?? "");
  const dlpResult = await scanDLP(promptText);
  if (dlpResult.matched) {
    await logPolicy(
      sa.agent_id,
      "deny",
      `DLP: ${dlpResult.pattern}`,
      `severity=${dlpResult.severity}`,
    );
    await meterEvent(sa, effectiveModel, "denied", `DLP:${dlpResult.pattern}`, 0, 0, t0);
    return sendJSON(res, 403, {
      error: {
        message: `DLP gate blocked: ${dlpResult.pattern} detected in prompt`,
        type: "dlp_error",
      },
    });
  }

  // 4. BUDGET CHECK — department monthly spend
  const budgetResult = await pgQuery(
    `SELECT budget_monthly_cents, spend_monthly_cents FROM departments WHERE id = $1`,
    [sa.department_id],
  );
  const dept = budgetResult.rows[0];
  const remainingBudget = dept.budget_monthly_cents - dept.spend_monthly_cents;
  if (remainingBudget <= 0) {
    await logPolicy(
      sa.agent_id,
      "deny",
      "Budget exhausted",
      `${sa.dept_name} budget: $${(dept.budget_monthly_cents / 100).toFixed(0)} spent`,
    );
    await meterEvent(sa, effectiveModel, "denied", "budget_exhausted", 0, 0, t0);
    return sendJSON(res, 429, {
      error: { message: `Budget exhausted for ${sa.dept_name}`, type: "budget_error" },
    });
  }

  // 5. QUOTA CHECK — agent monthly token quota
  const quotaResult = await chQuery(
    `SELECT sum(total_tokens) as used FROM arm.llm_events WHERE agent_id = '${sa.agent_id}' AND ts >= toStartOfMonth(now())`,
  );
  const tokensUsed = quotaResult[0]?.used ?? 0;
  if (Number(tokensUsed) >= Number(sa.monthly_quota_tokens)) {
    await logPolicy(
      sa.agent_id,
      "deny",
      "Token quota exceeded",
      `${tokensUsed}/${sa.monthly_quota_tokens}`,
    );
    await meterEvent(sa, effectiveModel, "denied", "quota_exceeded", 0, 0, t0);
    return sendJSON(res, 429, {
      error: { message: "Monthly token quota exceeded", type: "quota_error" },
    });
  }

  // 6. ROUTE TO OLLAMA (with timeout + retry for cold starts)
  const maxRetries = 2;
  let lastErr = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
        signal: AbortSignal.timeout(60000), // 60s — allows model cold-start
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        lastErr = `Upstream ${ollamaRes.status}: ${errText.slice(0, 100)}`;
        // Retry on 503 (model loading) or 500
        if ((ollamaRes.status === 503 || ollamaRes.status === 500) && attempt < maxRetries) {
          await sleep(3000 * (attempt + 1)); // backoff: 3s, 6s
          continue;
        }
        await meterEvent(sa, effectiveModel, "error", lastErr, 0, 0, t0);
        return sendJSON(res, 502, {
          error: { message: `Upstream error: ${ollamaRes.status}`, detail: errText.slice(0, 200) },
        });
      }

      const data = (await ollamaRes.json()) as any;
      const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      // 7. WORK-TYPE CLASSIFICATION (D7) — zero-LLM cascade, never blocks
      const workType = await classifyWorkType(sa, effectiveModel, promptText);

      // Surface the D7 classification live (real tagging shown in proxy logs)
      console.log(
        `  🏷  [${sa.dept_name}] ${sa.agent_name} → ${workType.workType} ` +
          `(stage=${workType.stage}, conf=${workType.confidence ?? "-"})`,
      );

      // 8. METER — calculate costs and write to ClickHouse
      // Self-hosted models: actual_cost = $0, but cloud_equivalent is tracked for savings
      const modelInfo = await getModelCost(effectiveModel);
      const cloudCostCents = Math.ceil(
        (usage.prompt_tokens / 1_000_000) * modelInfo.cloud_input +
          (usage.completion_tokens / 1_000_000) * modelInfo.cloud_output,
      );
      const actualCostCents = modelInfo.kind === "self-hosted" ? 0 : cloudCostCents;

      await meterEvent(sa, effectiveModel, "success", "", usage.total_tokens, cloudCostCents, t0, {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        actualCostCents,
        workType: workType.workType,
        usageTags: workType.usageTags,
        classifierStage: workType.stage,
        classifierConfidence: workType.confidence,
      });

      // Update department spend in Postgres (track cloud-equivalent cost
      // so managers see the financial value consumed, even though actual
      // cost is $0 for self-hosted models)
      await pgQuery(
        `UPDATE departments SET spend_monthly_cents = spend_monthly_cents + $1 WHERE id = $2`,
        [cloudCostCents, sa.department_id],
      );

      // Return the response (with ARM headers)
      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-ARM-Agent": sa.agent_id,
        "X-ARM-Model": effectiveModel,
        "X-ARM-Cost-CloudCents": String(cloudCostCents),
        "X-ARM-Savings-Cents": String(cloudCostCents - actualCostCents),
      });
      res.end(JSON.stringify(data));

      return; // success — exit retry loop
    } catch (err) {
      lastErr = String(err).slice(0, 120);
      if (attempt < maxRetries) {
        await sleep(2000 * (attempt + 1)); // backoff: 2s, 4s
        continue;
      }
      await meterEvent(sa, effectiveModel, "error", lastErr, 0, 0, t0);
      sendJSON(res, 502, { error: { message: "Failed to reach LLM provider after retries" } });
    }
  }
}

// ── Metering & Policy Helpers ──────────────────────────────────────────────

async function getModelCost(
  model: string,
): Promise<{ cloud_input: number; cloud_output: number; kind: string }> {
  // Map Ollama model names to their cloud-equivalent costs
  const costs: Record<string, { cloud_input: number; cloud_output: number; kind: string }> = {
    "minicpm5-1b": { cloud_input: 15, cloud_output: 60, kind: "self-hosted" }, // ~GPT-4o-mini equivalent
    "qwen3.5": { cloud_input: 70, cloud_output: 210, kind: "self-hosted" }, // ~Claude Haiku equivalent
    "gpt-4o": { cloud_input: 250, cloud_output: 1000, kind: "cloud" },
    "claude-sonnet-4": { cloud_input: 300, cloud_output: 1500, kind: "cloud" },
  };
  return costs[model] ?? { cloud_input: 50, cloud_output: 150, kind: "self-hosted" };
}

// ── D7: Work-type classifier integration ─────────────────────────────────

// Cached taxonomies: department name → WorkTypeTaxonomy. Loaded from the DB
// `work_type_taxonomies` table (seeded by the profile at provisioning).
let taxonomyCache: { map: Map<string, WorkTypeTaxonomy>; loadedAt: number } | null = null;
const TAXONOMY_TTL_MS = 60_000;

async function loadTaxonomies(): Promise<Map<string, WorkTypeTaxonomy>> {
  const now = Date.now();
  if (taxonomyCache && now - taxonomyCache.loadedAt < TAXONOMY_TTL_MS) {
    return taxonomyCache.map;
  }
  await ensurePg();
  const result = await pgQuery(
    `SELECT name, labels, classifier_version FROM work_type_taxonomies WHERE tenant_id = 'tn_acme'`,
  );
  const map = new Map<string, WorkTypeTaxonomy>();
  for (const row of result.rows) {
    map.set(row.name, {
      scopeId: row.name,
      scopeType: "department",
      name: row.name,
      labels: row.labels ?? [],
      classifierVersion: row.classifier_version ?? "1",
    });
  }
  taxonomyCache = { map, loadedAt: now };
  return map;
}

/**
 * Classify a prompt's work-type via the zero-LLM cascade (D7).
 * Falls back to `unknown` if no taxonomy exists for the department — never throws.
 */
async function classifyWorkType(sa: any, modelId: string, promptText: string) {
  try {
    const taxonomies = await loadTaxonomies();
    const taxonomy = taxonomies.get(sa.dept_name) ?? taxonomies.values().next().value;
    if (!taxonomy) {
      return {
        workType: "unknown",
        usageTags: [`model:${modelId}`],
        stage: "unknown" as const,
        confidence: null,
      };
    }
    const features: PromptFeatures = {
      promptText,
      modelId,
      agentType: sa.task_type,
      taskType: sa.task_type,
      departmentName: sa.dept_name,
      priorityTier: sa.priority_tier,
    };
    const result = await classifyPrompt(features, taxonomy);
    return result;
  } catch {
    return {
      workType: "unknown",
      usageTags: [`model:${modelId}`],
      stage: "unknown" as const,
      confidence: null,
    };
  }
}

async function meterEvent(
  sa: any,
  model: string,
  status: string,
  denyReason: string,
  totalTokens: number,
  cloudCostCents: number,
  t0: number,
  extra?: {
    promptTokens: number;
    completionTokens: number;
    actualCostCents: number;
    workType?: string;
    usageTags?: string[];
    classifierStage?: string;
    classifierConfidence?: number | null;
  },
): Promise<void> {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const actualCost = extra?.actualCostCents ?? 0;
  await chInsert("arm.llm_events", {
    tenant_id: "tn_acme",
    event_id: eventId,
    agent_id: sa.agent_id,
    agent_name: sa.agent_name,
    sub_account_id: sa.sub_account_id,
    department: sa.dept_name,
    model,
    provider: "ollama",
    kind: "self-hosted",
    task_type: sa.task_type,
    classification: sa.classification_clearance,
    // D7 work-type tag (per-prompt, enforcement-ready)
    work_type: extra?.workType ?? "",
    usage_tags: extra?.usageTags ?? [],
    classifier_stage: extra?.classifierStage ?? "unknown",
    work_type_confidence: extra?.classifierConfidence ?? -1,
    prompt_tokens: extra?.promptTokens ?? 0,
    completion_tokens: extra?.completionTokens ?? 0,
    total_tokens: totalTokens,
    cloud_cost_cents: cloudCostCents,
    actual_cost_cents: actualCost,
    savings_cents: cloudCostCents - actualCost,
    latency_ms: Date.now() - t0,
    status,
    deny_reason: denyReason,
    ts: toChDateTime(new Date()),
  });
}

async function logPolicy(
  agentId: string,
  decision: string,
  reason: string,
  detail: string,
): Promise<void> {
  await chInsert("arm.policy_events", {
    tenant_id: "tn_acme",
    agent_id: agentId,
    decision,
    reason,
    detail,
    ts: toChDateTime(new Date()),
  });
}

function toChDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function chQuery(sql: string): Promise<any[]> {
  const res = await fetch(`${CH_URL}/?query=${encodeURIComponent(sql)}`, {
    headers: { Authorization: "Basic " + Buffer.from(CH_AUTH).toString("base64") },
  });
  if (!res.ok) return [];
  const text = await res.text();
  // Parse JSONEachRow or JSON
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// ── HTTP Server ────────────────────────────────────────────────────────────

function sendJSON(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? "";

  // Health
  if (url === "/health" || url === "/") {
    sendJSON(res, 200, {
      status: "ok",
      service: "arm-data-plane-proxy",
      version: "2.0.0-simulation",
      upstream: OLLAMA_URL,
      features: [
        "auth",
        "budget_enforcement",
        "quota",
        "dlp_scan",
        "classification_gate",
        "metering",
      ],
    });
    return;
  }

  // Chat completions
  if (url === "/v1/chat/completions" && req.method === "POST") {
    const body = await readBody(req);
    return handleChatCompletion(req, res, body);
  }

  // Models list
  if (url === "/v1/models" && req.method === "GET") {
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/v1/models`);
      const data = (await ollamaRes.json()) as any;
      sendJSON(res, 200, data);
    } catch {
      sendJSON(res, 502, { error: "Cannot reach Ollama" });
    }
    return;
  }

  sendJSON(res, 404, { error: "Not found", path: url });
});

server.listen(PORT, async () => {
  await ensurePg();
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ARM Data-Plane Proxy (Simulation v2)                    ║`);
  console.log(`║  Listening on http://localhost:${PORT}                       ║`);
  console.log(`║  Upstream: ${OLLAMA_URL.padEnd(42)}║`);
  console.log(`║  Features: auth · budget · quota · DLP · classif · meter ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
});

process.on("SIGINT", async () => {
  console.log("\n Shutting down proxy...");
  await pgPool.end();
  process.exit(0);
});
