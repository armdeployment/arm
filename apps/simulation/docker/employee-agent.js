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
const START_DELAY = parseInt(process.env.START_DELAY || "0");

const TASKS = {
  code_review: [
    "Review this pull request diff for memory leaks: async function process(items) { return items.map(async i => await fetch(i.url)); } — flag merge blockers and lint issues.",
    "Code review: check this SQL query for injection risks before merge. The diff adds a dynamic WHERE clause. PR #452.",
    "Review this React component diff for re-render issues: const C = ({d}) => { const s = d.sort(); return <List items={s}/> } — any hotfix needed before merge?",
  ],
  documentation: [
    "Write API docs and README section for: POST /api/v1/agents - Creates a new agent. Body: {name, type, department_id}. Include examples and comments.",
    "Generate release notes and explain the v2.0 changes: Added budget enforcement, DLP scanning, model routing. Document each feature for the guide.",
  ],
  cnc_toolpath: [
    "Review this CNC toolpath optimization strategy for the aluminum bracket, compare roughing and finishing passes for machining efficiency.",
    "Calculate feed rate for 6mm carbide endmill cutting steel at 5000 RPM, 0.5mm depth. Tune the toolpath for spindle load.",
  ],
  defect_analysis: [
    "Analyze defect pattern: 3.2% failure rate on assembly line B, primarily weld joints. Run SPC analysis and check tolerance/yield.",
    "SPC: last 50 samples show Cpk of 1.1 (target 1.33). Defect inspection needed — check quality rejects and tolerance drift.",
  ],
  test_generation: [
    "Generate unit tests with coverage for: function calculateBudget(spend, limit) { return spend > limit ? 0 : limit - spend; } — add asserts and edge case specs.",
    "Write integration tests for OAuth2 authentication flow with mocks and fixtures. Add test specs with coverage assertions.",
  ],
  security_scan: [
    "Vulnerability scan: check if this is secure — const apiKey = 'sk-ant-api03-abc123def456ghi789'; flag CVEs and exploit risk.",
    "Security scan for OWASP Top 10: const query = `SELECT * FROM users WHERE id = ${req.params.id}`; check CVE exposure and injection.",
  ],
  demand_forecast: [
    "Forecast Q3 demand and inventory planning: Q1=12000, Q2=15000, trend=+15% QoQ. Recommend reorder points and stock levels.",
    "Calculate safety stock for supply planning: 500 units/week avg demand, 2-week lead time. Forecast reorder quantity.",
  ],
  research: [
    "Research and summarize advances in additive manufacturing for aerospace titanium. Survey literature and synthesize key findings.",
    "Research: compare graphene composites vs carbon fiber for automotive applications. Summarize and synthesize the literature.",
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
  // Staggered startup delay to avoid thundering herd on Ollama
  if (START_DELAY > 0) {
    console.log(`${COLORS.dim}Staggered start: waiting ${START_DELAY}s...${COLORS.reset}\n`);
    await sleep(START_DELAY * 1000);
  }

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
  await sleep(500);

  // Retry health check — ARM server may still be warming models
  let armReady = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const healthRes = await fetch(`${ARM_PROXY}/health`, { signal: AbortSignal.timeout(3000) });
      if (healthRes.ok) {
        const health = await healthRes.json();
        log("📡", `ARM Proxy v${health.version} — features: ${health.features?.join(", ")}`);
        armReady = true;
        break;
      }
    } catch (e) {
      if (attempt === 0) log("⏳", `ARM proxy not ready, waiting for model warmup...`);
      if (attempt % 10 === 9) log("⏳", `Still waiting... (${attempt + 1}s)`);
    }
    await sleep(2000);
  }

  if (!armReady) {
    log("❌", `Cannot reach ARM proxy at ${ARM_PROXY} after retries`);
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

  // Recursive timeout — wait for each call to COMPLETE before scheduling the next.
  // This prevents request pile-up when Ollama is slow (cold start / queued).
  async function makeCall() {
    if (callNum >= MAX_CALLS) {
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
        signal: AbortSignal.timeout(120000), // 2 min — generous for self-hosted
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
    // Schedule next call only AFTER this one completes
    setTimeout(makeCall, CALL_INTERVAL);
  }

  // Start the first call
  makeCall();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => console.error("Fatal:", e));
