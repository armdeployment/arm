#!/usr/bin/env tsx
/**
 * ARM Agent Simulator — Sandbox Test Harness
 *
 * Simulates real agent usage across the manufacturing org tree. Each virtual
 * agent makes periodic requests through the closed-proxy (port 8787) with
 * prompts matching their taskType. Metering events flow to the dashboard.
 *
 * This demonstrates:
 *   - Multi-agent traffic through the proxy
 *   - Priority-aware quota enforcement (critical → always, bg → downgrade)
 *   - DLP gate (confidential agents cannot use closed models)
 *   - Department-level work-type classification
 *   - Live metering showing up on the dashboard
 *
 * Usage:
 *   pnpm tsx scripts/sandbox/agent-simulator.ts
 *   # Options: --agents 10 --interval-ms 2000 --proxy http://localhost:8787
 */

const PROXY_URL = process.env.PROXY_URL ?? "http://localhost:8787";
const NUM_AGENTS = parseInt(process.env.NUM_AGENTS ?? "10");
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? "3000");
const DURATION_SEC = parseInt(process.env.DURATION_SEC ?? "300");

// ── Agent profiles (subset from manufacturing org tree) ────────────────────

interface AgentProfile {
  id: string;
  name: string;
  department: string;
  tier: "critical" | "standard" | "background";
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
  taskType: string;
  model: string; // preferred model (DLP-gated)
  promptTemplates: string[];
}

const AGENTS: AgentProfile[] = [
  {
    id: "agt_07",
    name: "line-monitor-a",
    department: "Manufacturing",
    tier: "critical",
    classificationClearance: "internal",
    taskType: "Real-time line throughput monitoring",
    model: "claude-sonnet-4-20250514",
    promptTemplates: [
      "Analyze throughput data: {sensor_data}. Identify bottlenecks.",
      "Compare today's line speed vs yesterday: {comparison_data}",
    ],
  },
  {
    id: "agt_01",
    name: "cad-assistant",
    department: "Engineering",
    tier: "standard",
    classificationClearance: "confidential",
    taskType: "CAD model generation",
    model: "glm-5.2",
    promptTemplates: [
      "Generate STEP file for part: {part_spec}. Materials: {materials}",
      "Validate tolerance stack: {dimensions} ± {tolerance}",
    ],
  },
  {
    id: "agt_15",
    name: "visual-inspector",
    department: "Quality Assurance",
    tier: "critical",
    classificationClearance: "confidential",
    taskType: "Final visual inspection",
    model: "glm-5.2",
    promptTemplates: [
      "Inspect image of part #{part_id}. Check for: {defect_types}",
      "Compare batch #{batch_id} against quality baseline.",
    ],
  },
  {
    id: "agt_37",
    name: "invoice-processor",
    department: "Finance",
    tier: "standard",
    classificationClearance: "confidential",
    taskType: "Invoice processing",
    model: "gpt-4o",
    promptTemplates: [
      "Extract line items from invoice #{inv_id}: {invoice_text}",
      "Match invoice #{inv_id} against PO #{po_id}",
    ],
  },
  {
    id: "agt_49",
    name: "network-monitor",
    department: "IT & Digital",
    tier: "standard",
    classificationClearance: "internal",
    taskType: "Network performance monitoring",
    model: "claude-sonnet-4-20250514",
    promptTemplates: [
      "Analyze network logs for anomalies: {log_snippet}",
      "Suggest firewall rule for: {rule_description}",
    ],
  },
  {
    id: "agt_25",
    name: "alloy-analyzer",
    department: "R&D",
    tier: "standard",
    classificationClearance: "restricted",
    taskType: "Alloy composition analysis",
    model: "glm-5.2",
    promptTemplates: [
      "Analyze alloy composition: {composition_data}. Compare to spec {spec_id}",
      "Predict fatigue life for alloy {alloy_id} under load {load_conditions}",
    ],
  },
  {
    id: "agt_43",
    name: "resume-screener",
    department: "Human Resources",
    tier: "standard",
    classificationClearance: "confidential",
    taskType: "Resume screening",
    model: "gpt-4o",
    promptTemplates: [
      "Score resume for role: {role_title}. Requirements: {requirements}",
      "Extract skills from resume: {resume_text}",
    ],
  },
  {
    id: "agt_55",
    name: "warranty-processor",
    department: "Customer Service",
    tier: "standard",
    classificationClearance: "internal",
    taskType: "Warranty claim processing",
    model: "claude-sonnet-4-20250514",
    promptTemplates: [
      "Process warranty claim #{claim_id}: {claim_details}",
      "Determine coverage for product {product_id}: issue {issue_desc}",
    ],
  },
  {
    id: "agt_31",
    name: "quote-generator",
    department: "Sales & Marketing",
    tier: "standard",
    classificationClearance: "internal",
    taskType: "Customer quote generation",
    model: "gpt-4o",
    promptTemplates: [
      "Generate quote for customer {customer}: products {products}, quantity {qty}",
      "Draft proposal for lead {lead_name} in industry {industry}",
    ],
  },
  {
    id: "agt_19",
    name: "price-tracker",
    department: "Supply Chain",
    tier: "standard",
    classificationClearance: "internal",
    taskType: "Commodity price monitoring",
    model: "claude-sonnet-4-20250514",
    promptTemplates: [
      "Summarize price trends for {commodity} over last {days}d",
      "Alert if {commodity} price exceeds ${threshold}/unit",
    ],
  },
];

// ── Simulator ──────────────────────────────────────────────────────────────

interface AgentState {
  profile: AgentProfile;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  blockedRequests: number;
  throttledRequests: number;
}

const states: Map<string, AgentState> = new Map();
const startTime = Date.now();

// Initialize states
for (let i = 0; i < Math.min(NUM_AGENTS, AGENTS.length); i++) {
  const profile = AGENTS[i]!;
  states.set(profile.id, {
    profile,
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    blockedRequests: 0,
    throttledRequests: 0,
  });
}

function pad(v: number, n: number): string {
  return String(v).padStart(n);
}
function fmt(v: number, d: number): string {
  return v.toFixed(d);
}

async function simulateRequest(agent: AgentProfile, state: AgentState): Promise<void> {
  const template = agent.promptTemplates[Math.floor(Math.random() * agent.promptTemplates.length)]!;
  const prompt = template.replace(
    /\{[^}]+\}/g,
    () => `[simulated_${Math.random().toString(36).slice(2, 8)}]`,
  );

  const body = {
    model: agent.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
  };

  try {
    const t0 = Date.now();
    const res = await fetch(`${PROXY_URL}/v1/proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ARM-SubAccountId": `sa_${agent.id}`,
        "X-ARM-AgentId": agent.id,
        "X-ARM-TenantId": "tn_demo",
      },
      body: JSON.stringify(body),
    });

    const elapsed = Date.now() - t0;
    state.requestCount++;

    if (res.status === 403) {
      // DLP gate blocked
      state.blockedRequests++;
      console.log(
        `🔒 [${agent.tier}] ${agent.name} | ${agent.department} | BLOCKED by DLP gate | ${res.status} | ${elapsed}ms`,
      );
      return;
    }

    if (res.status === 429 || res.status === 402) {
      // Quota exceeded / throttled
      state.throttledRequests++;
      console.log(
        `🚫 [${agent.tier}] ${agent.name} | ${agent.department} | THROTTLED | ${res.status} | ${elapsed}ms`,
      );
      return;
    }

    const data = (await res.json()) as Record<string, unknown>;
    const usage = (data.usage ?? { input_tokens: 0, output_tokens: 0 }) as Record<string, number>;
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    state.totalTokens += inputTokens + outputTokens;

    const costMatch =
      (data.content as Array<{ type: string; text: string }>)?.[0]?.text?.match(/\$[\d.]+/) || null;
    const cost = costMatch ? parseFloat(costMatch[0].slice(1)) : 0;
    state.totalCost += cost;

    const tierMark = agent.tier === "critical" ? "⚡" : agent.tier === "background" ? "⬇" : "●";
    const dept = agent.department.slice(0, 8).padEnd(8);
    console.log(
      `${tierMark} [${dept}] ${agent.name.padEnd(18)} | ${agent.model.padEnd(24)} | ${inputTokens}+${outputTokens}tk | $${fmt(cost, 4)} | ${elapsed}ms`,
    );
  } catch (err) {
    console.error(`✗ ${agent.name}: ${(err as Error).message}`);
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("ARM Agent Simulator");
  console.log("=".repeat(70));
  console.log(`  Proxy:     ${PROXY_URL}`);
  console.log(`  Agents:    ${NUM_AGENTS}`);
  console.log(`  Interval:  ${INTERVAL_MS}ms`);
  console.log(`  Duration:  ${DURATION_SEC}s`);
  console.log("=".repeat(70));
  console.log("Legend: ⚡critical ●standard ⬇background | 🔒DLP-blocked 🚫throttled");
  console.log("");

  const agents = [...states.values()].map((s) => s.profile);
  let tick = 0;

  const timer = setInterval(async () => {
    tick++;
    const elapsed = (Date.now() - startTime) / 1000;

    // Pick a random agent to make a request
    const agent = agents[Math.floor(Math.random() * agents.length)]!;
    const state = states.get(agent.id)!;
    await simulateRequest(agent, state);

    // Every 10 ticks, print summary
    if (tick % 10 === 0) {
      const totalRequests = [...states.values()].reduce((s, st) => s + st.requestCount, 0);
      const totalBlocked = [...states.values()].reduce((s, st) => s + st.blockedRequests, 0);
      const totalThrottled = [...states.values()].reduce((s, st) => s + st.throttledRequests, 0);
      const totalCost = [...states.values()].reduce((s, st) => s + st.totalCost, 0);
      console.log(
        `\n── ${pad(Math.floor(elapsed), 3)}s | ${totalRequests} req | ${totalBlocked} blocked | ${totalThrottled} throttled | $${fmt(totalCost, 4)} ──\n`,
      );
    }

    // Stop after duration
    if (elapsed >= DURATION_SEC) {
      clearInterval(timer);
      printFinalReport();
      process.exit(0);
    }
  }, INTERVAL_MS);
}

function printFinalReport() {
  console.log("\n" + "=".repeat(70));
  console.log("FINAL REPORT");
  console.log("=".repeat(70));

  let totalReq = 0,
    totalBlocked = 0,
    totalThrottled = 0,
    totalCost = 0,
    totalTokens = 0;
  for (const state of [...states.values()].sort((a, b) => b.totalCost - a.totalCost)) {
    const p = state.profile;
    console.log(
      `${p.name.padEnd(20)} | ${p.department.padEnd(18)} | ${p.tier.padEnd(10)} | ${String(state.requestCount).padStart(4)} req | $${fmt(state.totalCost, 2).padStart(8)} | ${state.blockedRequests} blocked`,
    );
    totalReq += state.requestCount;
    totalBlocked += state.blockedRequests;
    totalThrottled += state.throttledRequests;
    totalCost += state.totalCost;
    totalTokens += state.totalTokens;
  }

  console.log("─".repeat(70));
  console.log(
    `TOTAL: ${totalReq} requests | $${fmt(totalCost, 2)} | ${totalTokens} tokens | ${totalBlocked} DLP blocked | ${totalThrottled} throttled`,
  );
  console.log(`Dashboard: http://localhost:3100`);
  console.log(`Proxy metering: http://localhost:8787/metering`);
  console.log(`Gateway metering: http://localhost:8788/metering`);
  console.log("=".repeat(70));
}

void main();
