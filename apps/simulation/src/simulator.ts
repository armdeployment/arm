/**
 * ARM Simulation — Agent Simulator
 *
 * Simulates enterprise usage: 10 coding agents across 5 departments making
 * real LLM calls through the ARM proxy. Each agent has realistic task prompts,
 * different call frequencies, and triggers policy events.
 *
 * Run: pnpm --filter @arm-app/simulation simulate
 */

// ── Agent Definitions ──────────────────────────────────────────────────────

interface SimAgent {
  name: string;
  apiKey: string;
  model: string;
  department: string;
  prompts: string[];
  intervalMs: number;
  maxCalls: number;
}

const AGENTS: SimAgent[] = [
  {
    name: "CodeReview-Bot",
    apiKey: "arm_sk_eng_review_x1a2b3",
    model: "qwen3.5",
    department: "Engineering",
    intervalMs: 4000,
    maxCalls: 8,
    prompts: [
      "Review this TypeScript function for potential memory leaks: async function processData(items: Item[]) { return items.map(async i => await fetch(i.url)); }",
      "Check this SQL query for injection risks: SELECT * FROM users WHERE name = '" + "user_input" + "'",
      "Analyze this React component for re-render issues: const Component = ({data}) => { const sorted = data.sort(); return <List items={sorted} />; }",
      "Review this error handling pattern and suggest improvements: try { await api.call(); } catch(e) { console.log(e); }",
    ],
  },
  {
    name: "DocGen-Agent",
    apiKey: "arm_sk_eng_docs_m4n5o6",
    model: "minicpm5-1b",
    department: "Engineering",
    intervalMs: 6000,
    maxCalls: 6,
    prompts: [
      "Write API documentation for: POST /api/v1/agents - Creates a new agent. Parameters: name (string), type (string), department_id (string).",
      "Generate a README section explaining how to configure environment variables for a Node.js application.",
      "Write release notes for version 2.0: Added budget enforcement, DLP scanning, and model routing features.",
      "Create a changelog entry for a bug fix: Fixed token counting for streaming responses.",
    ],
  },
  {
    name: "ArchDesign-Agent",
    apiKey: "arm_sk_eng_arch_p7q8r9",
    model: "qwen3.5",
    department: "Engineering",
    intervalMs: 8000,
    maxCalls: 4,
    prompts: [
      "Design a microservice architecture for an inventory management system with real-time stock tracking.",
      "Propose a caching strategy for a manufacturing ERP that handles 10K requests/second.",
      "Recommend a database sharding strategy for a multi-tenant SaaS with 500 tenants.",
    ],
  },
  {
    name: "ToolPath-Optimizer",
    apiKey: "arm_sk_mfg_tool_s0t1u2",
    model: "qwen3.5",
    department: "Manufacturing",
    intervalMs: 5000,
    maxCalls: 7,
    prompts: [
      "Optimize CNC toolpath for milling aluminum bracket: reduce cycle time while maintaining surface finish Ra 1.6.",
      "Calculate optimal feed rate for 6mm carbide endmill cutting steel at 5000 RPM with 0.5mm depth of cut.",
      "Suggest tool wear monitoring strategy for high-volume production of titanium aerospace components.",
    ],
  },
  {
    name: "QualityAnalysis-Agent",
    apiKey: "arm_sk_mfg_qual_v3w4x5",
    model: "minicpm5-1b",
    department: "Manufacturing",
    intervalMs: 7000,
    maxCalls: 5,
    prompts: [
      "Analyze defect pattern: 3.2% failure rate on assembly line B, primarily in weld joints. Root cause hypothesis?",
      "Statistical process control: last 50 samples show Cpk of 1.1 (target 1.33). What corrective actions are needed?",
      "FMEA analysis for new injection molding process: identify top 5 failure modes.",
    ],
  },
  {
    name: "TestGen-Agent",
    apiKey: "arm_sk_qa_test_y6z7a8",
    model: "minicpm5-1b",
    department: "Quality Assurance",
    intervalMs: 5000,
    maxCalls: 7,
    prompts: [
      "Generate unit tests for: function calculateBudget(spend, limit) { return spend > limit ? 0 : limit - spend; }",
      "Write integration test scenarios for a user authentication API with OAuth2.",
      "Create test data for a manufacturing order management system with 1000 SKUs.",
    ],
  },
  {
    name: "SecurityScan-Agent",
    apiKey: "arm_sk_qa_sec_b9c0d1",
    model: "qwen3.5",
    department: "Quality Assurance",
    intervalMs: 9000,
    maxCalls: 4,
    prompts: [
      "Scan this code for OWASP Top 10 vulnerabilities: const query = `SELECT * FROM users WHERE id = ${req.params.id}`;",
      "Security review: this API endpoint accepts file uploads without size limits. What are the risks?",
      // This one will trigger DLP gate (simulated API key leak):
      "Check if this config is secure: const apiKey = 'sk-ant-api03-abc123def456ghi789jkl012mno345pqr678';",
    ],
  },
  {
    name: "DemandForecast-Agent",
    apiKey: "arm_sk_sc_fore_e2f3g4",
    model: "minicpm5-1b",
    department: "Supply Chain",
    intervalMs: 6000,
    maxCalls: 6,
    prompts: [
      "Forecast Q3 demand for Product SKU-4821 based on: Q1=12000, Q2=15000, trend=+15% QoQ.",
      "Calculate safety stock for an item with 500 units/week average demand and 2-week lead time.",
      "Optimize reorder point for raw material with demand variability sigma=200, service level 95%.",
    ],
  },
  {
    name: "LogisticsOpt-Agent",
    apiKey: "arm_sk_sc_log_h5i6j7",
    model: "minicpm5-1b",
    department: "Supply Chain",
    intervalMs: 8000,
    maxCalls: 4,
    prompts: [
      "Optimize delivery route: 5 stops, distances [0,12,8,15,20] miles from depot. Minimize total distance.",
      "Calculate freight cost: 3 pallets, 1200 lbs, 450 miles. Carrier rate $2.50/mile + $150/pallet.",
    ],
  },
  {
    name: "ResearchAssist-Agent",
    apiKey: "arm_sk_rd_res_k8l9m0",
    model: "qwen3.5",
    department: "R&D",
    intervalMs: 7000,
    maxCalls: 5,
    prompts: [
      "Summarize recent advances in additive manufacturing for aerospace titanium components.",
      "Literature review: compare graphene-reinforced composites vs carbon fiber for automotive applications.",
      "Propose experimental design for testing 5 new polymer formulations with 3 temperature settings.",
    ],
  },
];

// ── Simulation Logic ───────────────────────────────────────────────────────

const PROXY_URL = process.env.PROXY_URL ?? "http://localhost:8787";
const DURATION_SEC = parseInt(process.env.DURATION_SEC ?? "60");
const WARMUP_MODELS = ["minicpm5-1b", "qwen3.5"];

interface CallResult {
  agent: string;
  status: "success" | "denied" | "error";
  model?: string;
  tokens?: number;
  costCents?: number;
  latencyMs?: number;
  error?: string;
}

const results: CallResult[] = [];
let callCount = 0;
let successCount = 0;
let deniedCount = 0;

async function makeCall(agent: SimAgent, promptIndex: number): Promise<void> {
  const prompt = agent.prompts[promptIndex % agent.prompts.length];
  const t0 = Date.now();

  try {
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${agent.apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    const data = await res.json() as any;
    callCount++;

    if (res.ok) {
      successCount++;
      const tokens = data.usage?.total_tokens ?? 0;
      const costCents = parseInt(res.headers.get("X-ARM-Cost-CloudCents") ?? "0");
      const savings = parseInt(res.headers.get("X-ARM-Savings-Cents") ?? "0");
      results.push({ agent: agent.name, status: "success", model: agent.model, tokens, costCents, latencyMs: Date.now() - t0 });
      const preview = (data.choices?.[0]?.message?.content ?? "").slice(0, 60).replace(/\n/g, " ");
      process.stdout.write(
        `  ✓ [${agent.department.padEnd(12)}] ${agent.name.padEnd(22)} → ${agent.model.padEnd(14)} ${String(tokens).padStart(4)} tok  ${String(Date.now() - t0).padStart(4)}ms  $${(costCents/100).toFixed(4)} cloud, $${(savings/100).toFixed(4)} saved\n`
      );
    } else {
      deniedCount++;
      const errorMsg = data.error?.message ?? `HTTP ${res.status}`;
      results.push({ agent: agent.name, status: "denied", error: errorMsg });
      let statusLabel: string;
      if (res.status === 403) statusLabel = "DLP/POLICY";
      else if (res.status === 429) statusLabel = "BUDGET";
      else if (res.status === 401) statusLabel = "AUTH";
      else statusLabel = `HTTP ${res.status}`;
      process.stdout.write(
        `  [${statusLabel}] [${agent.department.padEnd(12)}] ${agent.name.padEnd(22)} → ${errorMsg.slice(0, 70)}\n`
      );
    }
  } catch (err) {
    callCount++;
    results.push({ agent: agent.name, status: "error", error: String(err) });
    process.stdout.write(`  ✗ [${agent.department.padEnd(12)}] ${agent.name.padEnd(22)} → Connection error\n`);
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ARM Enterprise Simulation — Agent Activity                  ║");
  console.log(`║  ${AGENTS.length} agents · ${DURATION_SEC}s duration · proxy at ${PROXY_URL.padEnd(26)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Verify proxy is up
  try {
    const health = await fetch(`${PROXY_URL}/health`);
    const h = await health.json() as any;
    console.log(`  Proxy: ${h.service} v${h.version} ✓\n`);
  } catch {
    console.error("  ✗ Proxy not reachable. Start it with: pnpm --filter @arm-app/simulation proxy\n");
    process.exit(1);
  }

  // Pre-warm models (cold start for qwen3.5 is ~20s)
  console.log("  Pre-warming models (loading into GPU memory)...\n");
  for (const model of WARMUP_MODELS) {
    try {
      await fetch(`${PROXY_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer arm_sk_eng_review_x1a2b3" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "OK" }], max_tokens: 1, stream: false }),
      });
      console.log(`    ${model} warmed up`);
    } catch { console.log(`    ${model} warmup failed`); }
  }
  console.log("");
  console.log("  DEPARTMENT     AGENT                   MODEL            TOKENS  LAT   COST\n");
  console.log("  ──────────────────────────────────────────────────────────────────────────");

  // Schedule each agent
  const timers: NodeJS.Timeout[] = [];
  const callCounts: Record<string, number> = {};

  for (const agent of AGENTS) {
    callCounts[agent.name] = 0;
    // Stagger start
    const startDelay = Math.floor(Math.random() * agent.intervalMs);

    const timer = setTimeout(function fire() {
      if (callCounts[agent.name]! >= agent.maxCalls) return;
      callCounts[agent.name]!++;
      makeCall(agent, callCounts[agent.name]! - 1);
      if (callCounts[agent.name]! < agent.maxCalls) {
        timers.push(setTimeout(fire, agent.intervalMs));
      }
    }, startDelay);
    timers.push(timer);
  }

  // Wait for duration + buffer for slow in-flight calls
  await new Promise(resolve => setTimeout(resolve, DURATION_SEC * 1000 + 15000));

  // Clear any remaining timers
  timers.forEach(t => clearTimeout(t));

  // Summary
  console.log("\n  ──────────────────────────────────────────────────────────────────────────");
  const totalTokens = results.filter(r => r.tokens).reduce((s, r) => s + (r.tokens ?? 0), 0);
  const totalCost = results.filter(r => r.costCents).reduce((s, r) => s + (r.costCents ?? 0), 0);

  // Per-department breakdown
  const byDept: Record<string, { calls: number; tokens: number; cost: number }> = {};
  for (const r of results) {
    const agent = AGENTS.find(a => a.name === r.agent)!;
    const d = byDept[agent.department] ?? { calls: 0, tokens: 0, cost: 0 };
    d.calls++;
    d.tokens += r.tokens ?? 0;
    d.cost += r.costCents ?? 0;
    byDept[agent.department] = d;
  }

  console.log("\n  DEPARTMENT          CALLS   TOKENS     CLOUD-EQUIV COST");
  console.log("  ────────────────────────────────────────────────────────");
  for (const [dept, d] of Object.entries(byDept)) {
    console.log(`  ${dept.padEnd(20)} ${String(d.calls).padStart(4)}    ${String(d.tokens).padStart(7)}    $${(d.cost/100).toFixed(4)}`);
  }
  console.log("  ────────────────────────────────────────────────────────");
  console.log(`  ${"TOTAL".padEnd(20)} ${String(callCount).padStart(4)}    ${String(totalTokens).padStart(7)}    $${(totalCost/100).toFixed(4)}`);
  console.log(`  ${"SUCCESS".padEnd(20)} ${String(successCount).padStart(4)}    ${"DENIED".padEnd(10)} ${String(deniedCount).padStart(4)}`);
  console.log(`  ${"SAVINGS (self-hosted)".padEnd(20)}                                    $${(totalCost/100).toFixed(4)}\n`);

  process.exit(0);
}

main().catch(e => { console.error("Simulation error:", e); process.exit(1); });
