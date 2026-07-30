#!/usr/bin/env node
/**
 * Enterprise Employee Agent — runs inside a Docker container.
 * Simulates a real employee's coding agent making LLM calls through ARM.
 *
 * Each container represents one employee workstation on the armtest.com network.
 */

const ARM_PROXY = process.env.ARM_PROXY || "http://arm.armtest.com:8787";
const EMPLOYEE_NAME = process.env.EMPLOYEE_NAME || "Unknown Employee";
const DEPARTMENT = process.env.DEPARTMENT || "Unknown";
const AGENT_TYPE = process.env.AGENT_TYPE || "opencode";
const API_KEY = process.env.API_KEY || "";
const MODEL = process.env.MODEL || "minicpm5-1b";
const TASK_TYPE = process.env.TASK_TYPE || "code_review";
const NO_VPN = process.env.NO_VPN === "true";
const CALL_INTERVAL = parseInt(process.env.CALL_INTERVAL || "8000");
const MAX_CALLS = parseInt(process.env.MAX_CALLS || "5");

const TASKS = {
  code_review: [
    "Review this function for memory leaks: async function process(items) { return items.map(async i => await fetch(i.url)); }",
    "Check this SQL for injection: SELECT * FROM users WHERE name = '" + "input" + "'",
    "Analyze this React component for re-render issues: const C = ({d}) => { const s = d.sort(); return <List items={s}/> }",
  ],
  documentation: [
    "Write API docs for: POST /api/v1/agents - Creates a new agent. Body: {name, type, department_id}",
    "Generate release notes for v2.0: Added budget enforcement, DLP scanning, model routing.",
  ],
  cnc_toolpath: [
    "Optimize CNC toolpath for milling aluminum bracket: reduce cycle time, maintain Ra 1.6.",
    "Calculate feed rate for 6mm carbide endmill cutting steel at 5000 RPM, 0.5mm depth.",
  ],
  defect_analysis: [
    "Analyze defect pattern: 3.2% failure rate on assembly line B, primarily weld joints.",
    "SPC: last 50 samples show Cpk of 1.1 (target 1.33). Corrective actions needed?",
  ],
  test_generation: [
    "Generate unit tests for: function calculateBudget(spend, limit) { return spend > limit ? 0 : limit - spend; }",
    "Write integration tests for OAuth2 authentication flow.",
  ],
  security_scan: [
    "Check if this is secure: const apiKey = 'sk-ant-api03-abc123def456ghi789';",
    "Scan for OWASP Top 10: const query = `SELECT * FROM users WHERE id = ${req.params.id}`;",
  ],
  demand_forecast: [
    "Forecast Q3 demand: Q1=12000, Q2=15000, trend=+15% QoQ.",
    "Calculate safety stock: 500 units/week avg demand, 2-week lead time.",
  ],
  research: [
    "Summarize advances in additive manufacturing for aerospace titanium.",
    "Compare graphene composites vs carbon fiber for automotive applications.",
  ],
};

const COLORS = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", blue: "\x1b[34m", magenta: "\x1b[35m",
  white: "\x1b[37m", bg_blue: "\x1b[44m", bg_red: "\x1b[41m",
};

function log(icon, msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${COLORS.dim}${ts}${COLORS.reset} ${icon} ${msg}`);
}

async function main() {
  // ── Boot screen ──
  console.log("\n" + "=".repeat(60));
  console.log(`${COLORS.bg_blue}${COLORS.white}  WORKSTATION BOOT  ${COLORS.reset}`);
  console.log("=".repeat(60));
  console.log(`  Employee:    ${COLORS.bold}${EMPLOYEE_NAME}${COLORS.reset}`);
  console.log(`  Department:  ${DEPARTMENT}`);
  console.log(`  Agent Type:  ${AGENT_TYPE}`);
  console.log(`  Task:        ${TASK_TYPE.replace(/_/g, " ")}`);
  console.log(`  Model:       ${MODEL}`);
  console.log(`  ARM Proxy:   ${ARM_PROXY}`);
  console.log(`  Network:     ${NO_VPN ? COLORS.red + "EXTERNAL (no VPN)" + COLORS.reset : COLORS.green + "armtest-internal" + COLORS.reset}`);
  console.log("=".repeat(60) + "\n");

  // ── DNS Resolution Check ──
  log("🔍", `Resolving arm.armtest.com via internal DNS...`);
  await sleep(500);

  if (NO_VPN) {
    log("⛔", `${COLORS.red}DNS resolution failed${COLORS.reset} — arm.armtest.com not reachable`);
    log("🔒", "This workstation is on armtest-external network (outside corporate firewall)");
    log("📡", "VPN connection required to access armtest.com domain resources");
    console.log("");
    log("💡", "To connect: docker network connect armtest-internal " + (process.env.HOSTNAME || "this-container"));
    console.log("\n  Waiting for VPN connection...\n");

    // Wait for VPN (network connection) — up to 5 minutes
    let connected = false;
    for (let i = 0; i < 150; i++) {
      await sleep(2000);
      try {
        const res = await fetch(`${ARM_PROXY}/health`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          connected = true;
          log("✅", `${COLORS.green}VPN connected!${COLORS.reset} arm.armtest.com is now reachable`);
          break;
        }
      } catch {
        process.stdout.write(".");
      }
    }
    if (!connected) {
      log("⏹", "No VPN connection established. Workstation idle.");
      // Stay alive
      setInterval(() => {}, 1000);
      return;
    }
    console.log("\n");
  } else {
    log("✅", `${COLORS.green}DNS resolved${COLORS.reset} — arm.armtest.com → internal IP`);
  }

  // ── Authenticate with ARM ──
  log("🔐", `Authenticating with ARM via ${AGENT_TYPE} plugin...`);
  await sleep(800);

  try {
    const healthRes = await fetch(`${ARM_PROXY}/health`);
    const health = await healthRes.json();
    log("📡", `ARM Proxy v${health.version} — features: ${health.features?.join(", ")}`);
  } catch (e) {
    log("❌", `Cannot reach ARM proxy at ${ARM_PROXY}`);
    setInterval(() => {}, 1000);
    return;
  }

  log("🔑", `Sub-account authenticated: ${API_KEY.slice(0, 16)}...`);
  log("🛡️", "DLP scanner active · Classification gate active · Budget enforcement active");
  console.log("");

  // ── Agent Activity Loop ──
  const prompts = TASKS[TASK_TYPE] || TASKS.code_review;
  let callNum = 0;

  log("🚀", `${COLORS.bold}${EMPLOYEE_NAME}'s ${AGENT_TYPE} agent is now active${COLORS.reset}`);
  console.log("");

  const interval = setInterval(async () => {
    if (callNum >= MAX_CALLS) {
      clearInterval(interval);
      log("✓", `Session complete — ${callNum} calls processed through ARM governance`);
      return;
    }

    callNum++;
    const prompt = prompts[(callNum - 1) % prompts.length];
    const t0 = Date.now();

    log("⬆️", `${COLORS.blue}[${DEPARTMENT}]${COLORS.reset} Sending prompt to ${MODEL} via arm.armtest.com`);

    try {
      const res = await fetch(`${ARM_PROXY}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          max_tokens: 60,
        }),
      });

      const data = await res.json();
      const latency = Date.now() - t0;

      if (res.ok) {
        const tokens = data.usage?.total_tokens || 0;
        const cost = res.headers.get("X-ARM-Cost-CloudCents") || "0";
        const savings = res.headers.get("X-ARM-Savings-Cents") || "0";
        const preview = (data.choices?.[0]?.message?.content || "").slice(0, 50).replace(/\n/g, " ");
        log("✅", `${COLORS.green}${tokens} tokens${COLORS.reset} in ${latency}ms · cloud $${(parseInt(cost)/100).toFixed(4)} · saved $${(parseInt(savings)/100).toFixed(4)}`);
        if (preview) log("💬", `${COLORS.dim}"${preview}..."${COLORS.reset}`);
      } else {
        const errMsg = data.error?.message || `HTTP ${res.status}`;
        if (res.status === 403) {
          log("🛡️", `${COLORS.red}BLOCKED by policy${COLORS.reset}: ${errMsg.slice(0, 60)}`);
        } else if (res.status === 429) {
          log("💰", `${COLORS.yellow}BUDGET LIMIT${COLORS.reset}: ${errMsg.slice(0, 60)}`);
        } else {
          log("❌", `Error ${res.status}: ${errMsg.slice(0, 60)}`);
        }
      }
    } catch (e) {
      log("❌", `Network error: ${e.message?.slice(0, 60)}`);
    }

    console.log("");
  }, CALL_INTERVAL);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => console.error("Fatal:", e));
