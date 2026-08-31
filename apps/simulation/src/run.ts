/**
 * ARM Simulation — Full Enterprise Run Orchestrator
 *
 * Executes the complete simulation:
 *   1. Initialize databases (Postgres + ClickHouse)
 *   2. Start the data-plane proxy
 *   3. Run agent simulation (real LLM calls via Ollama)
 *   4. Mid-simulation: apply management decisions
 *   5. Generate PDF report
 *
 * Run: pnpm --filter @arm-app/simulation run
 */

import { execSync, spawn, ChildProcess } from "node:child_process";
import pg from "pg";
const { Client } = pg;

const PG_URL = process.env.DATABASE_URL ?? "postgresql://arm:arm_dev_password@localhost:5432/arm";
const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_AUTH = "arm:arm_dev_password";
const PROXY_PORT = process.env.PROXY_PORT ?? "8787";
const SIM_DURATION = process.env.SIM_DURATION ?? "50";

function log(msg: string) {
  console.log(`\n  ▸ ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function chExec(sql: string): Promise<void> {
  await fetch(`${CH_URL}/`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(CH_AUTH).toString("base64"),
      "Content-Type": "text/plain",
    },
    body: sql,
  });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   ARM ENTERPRISE SIMULATION — FULL END-TO-END RUN                 ║");
  console.log("║   Acme Manufacturing Corp · 10 agents · 5 departments             ║");
  console.log("║   Real LLM inference via Ollama · Real metering via ClickHouse    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  // ── Step 1: Initialize databases ──
  log("Step 1/5: Initializing databases (Postgres + ClickHouse)...");
  execSync("npx tsx src/db-init.ts", { stdio: "inherit", cwd: process.cwd() });

  // ── Step 2: Start proxy ──
  log("Step 2/5: Starting data-plane proxy on port " + PROXY_PORT + "...");
  const proxyProc = spawn("npx", ["tsx", "src/proxy.ts"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PROXY_PORT },
    cwd: process.cwd(),
  });
  proxyProc.stdout!.on("data", (d) => process.stdout.write(d));
  proxyProc.stderr!.on("data", (d) => process.stderr.write(d));

  // Wait for proxy to be ready
  let proxyReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://localhost:${PROXY_PORT}/health`);
      if (res.ok) {
        proxyReady = true;
        break;
      }
    } catch {}
    await sleep(500);
  }
  if (!proxyReady) {
    console.error("\n  ✗ Proxy failed to start. Aborting.");
    proxyProc.kill();
    process.exit(1);
  }
  console.log("  ✓ Proxy ready");

  // ── Step 3: Run simulation ──
  log(`Step 3/5: Running agent simulation (${SIM_DURATION}s)...`);
  console.log("  ──────────────────────────────────────────────────────────────────\n");
  execSync(`npx tsx src/simulator.ts`, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, DURATION_SEC: SIM_DURATION },
  });

  // ── Step 4: Apply management decisions ──
  log("Step 4/5: Applying management decisions...");
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  // Decision 1: Budget reallocation — Engineering over budget, R&D has surplus
  await pgClient.query(`
    UPDATE departments SET budget_monthly_cents = budget_monthly_cents + 150000
    WHERE id = 'dept_eng'
  `);
  await pgClient.query(`
    UPDATE departments SET budget_monthly_cents = budget_monthly_cents - 150000
    WHERE id = 'dept_rd'
  `);
  await pgClient.query(`
    INSERT INTO management_decisions (tenant_id, decision_type, title, description, decided_by, impact_cents)
    VALUES ('tn_acme', 'budget_reallocate',
      'Budget reallocation: R&D → Engineering',
      'Engineering department exceeded 80% of monthly budget in 3 weeks. CEO Patricia Vance approved transferring $1,500 from R&D (underutilized at 22% spend) to Engineering to prevent agent work stoppage.',
      'usr_ceo', 150000)
  `);

  // Decision 2: Model optimization — Supply Chain using expensive model for simple tasks
  await pgClient.query(`
    UPDATE agents SET preferred_model = 'minicpm5-1b'
    WHERE id = 'agt_sc_forecast' AND preferred_model != 'minicpm5-1b'
  `);
  await pgClient.query(`
    INSERT INTO management_decisions (tenant_id, decision_type, title, description, decided_by, impact_cents)
    VALUES ('tn_acme', 'model_optimize',
      'Model downgrade: DemandForecast-Agent → minicpm5-1b',
      'Supply Chain head David Kim identified that DemandForecast-Agent was using qwen3.5 (large model) for simple forecasting tasks. Downgraded to minicpm5-1b, projecting 60% cost reduction with acceptable quality.',
      'usr_david', 0)
  `);

  // Decision 3: Agent suspension after security event
  const securityEvents = await pgClient.query(`
    SELECT count(*) as c FROM policy_decisions
    WHERE reason LIKE '%DLP%' AND created_at > NOW() - INTERVAL '1 hour'
  `);
  const dlpBlocked = parseInt(securityEvents.rows[0].c);
  if (dlpBlocked > 0) {
    await pgClient.query(`
      INSERT INTO management_decisions (tenant_id, decision_type, title, description, decided_by, impact_cents)
      VALUES ('tn_acme', 'security_incident',
        'DLP incident: API key leakage blocked',
        '${dlpBlocked} prompt(s) containing API keys (sk-ant-/sk-proj- format) were blocked by the DLP scanner. SecurityScan-Agent attempted to process a prompt containing a leaked Anthropic API key. The key was prevented from being sent to the LLM provider. Mandatory security retraining issued to QA team.',
        'usr_jenny', 0)
    `);
  }

  // Decision 4: Quarterly savings recognition
  await pgClient.query(`
    INSERT INTO management_decisions (tenant_id, decision_type, title, description, decided_by, impact_cents)
    VALUES ('tn_acme', 'cost_savings',
      'Self-hosted model strategy delivering savings',
      'By routing all agent traffic through self-hosted Ollama models instead of cloud APIs (GPT-4o, Claude Sonnet), Acme Manufacturing achieved 100% infrastructure cost savings on per-token charges. GPU amortization cost tracked separately.',
      'usr_ceo', 0)
  `);

  const decisions = await pgClient.query("SELECT count(*) as c FROM management_decisions");
  console.log(`  ✓ ${decisions.rows[0].c} management decisions recorded`);
  await pgClient.end();

  // ── Step 5: Generate report ──
  log("Step 5/5: Generating PDF report...");
  execSync("npx tsx src/report.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, REPORT_OUTPUT: "reports/ARM-Enterprise-Simulation-Report.pdf" },
  });

  // Cleanup
  proxyProc.kill("SIGTERM");
  await sleep(1000);

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   ✓ SIMULATION COMPLETE                                          ║");
  console.log("║   Report: reports/ARM-Enterprise-Simulation-Report.pdf           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("Simulation failed:", e);
  process.exit(1);
});
