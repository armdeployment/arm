// Real data captured from the ACTUAL running ARM enterprise simulation.
// Every value here is from real Docker containers, real ClickHouse queries,
// real Postgres data, and real employee terminal output.
// DO NOT edit these values — re-capture from the live system instead.

export const REAL = {
  // Real ARM proxy identity (from curl http://localhost:8787/health)
  proxy: {
    status: "ok",
    service: "arm-data-plane-proxy",
    version: "2.0.0-simulation",
    upstream: "http://host.docker.internal:11434",
    features: ["auth", "budget_enforcement", "quota", "dlp_scan", "classification_gate", "metering"],
  },

  // Real Ollama models (from curl http://localhost:11434/api/tags)
  ollama: [
    { name: "minicpm5-1b", size: "2.2GB" },
    { name: "qwen3.5", size: "6.6GB" },
  ],

  // Real ARM proxy startup sequence (from docker logs simulation-arm-server-1)
  proxyStartup: [
    "╔══════════════════════════════════════════════════════════╗",
    "║  ARM Enterprise Server — arm.armtest.com                 ║",
    "║  Data-Plane Proxy + Control-Plane DB                     ║",
    "╚══════════════════════════════════════════════════════════╝",
    "",
    "▸ Waiting for PostgreSQL...",
    "  ✓ PostgreSQL ready",
    "▸ Waiting for ClickHouse...",
    "  ✓ ClickHouse ready",
    "▸ Initializing database schema + seed data...",
    "  ✓ Postgres: 1 tenant, 5 departments, 7 users, 4 models, 10 agents",
    "  ✓ ClickHouse: llm_events + policy_events tables ready",
    "    (partitioned by tenant_id, toYYYYMM)",
    "",
    "▸ Pre-warming Ollama models...",
    "  minicpm5-1b... ✓ warm",
    "  qwen3.5... ✓ warm",
    "",
    "▸ Starting ARM data-plane proxy on :8787...",
    "  Internal: http://arm.armtest.com:8787",
    "  Upstream: http://host.docker.internal:11434",
    "",
    "╔══════════════════════════════════════════════════════════╗",
    "║  ARM Data-Plane Proxy (Simulation v2)                    ║",
    "║  Listening on http://localhost:8787                       ║",
    "║  Upstream: http://host.docker.internal:11434              ║",
    "║  Features: auth · budget · quota · DLP · classif · meter  ║",
    "╚══════════════════════════════════════════════════════════╝",
  ],

  // Real Docker network topology (from docker network inspect)
  networkInternal: ["simulation-arm-server-1", "simulation-postgres-ent-1", "simulation-clickhouse-ent-1"],
  networkExternal: ["simulation-remote-pc-1"],

  // Real Docker containers (from docker ps)
  containers: [
    { name: "simulation-arm-server-1", status: "Up 2 hours", ports: "0.0.0.0:8787->8787/tcp" },
    { name: "simulation-postgres-ent-1", status: "Up 2 hours (healthy)", ports: "5432/tcp" },
    { name: "simulation-clickhouse-ent-1", status: "Up 2 hours (healthy)", ports: "8123/tcp, 9000/tcp" },
    { name: "simulation-emp-sarah-1", status: "Exited (0)", ports: "—" },
    { name: "simulation-emp-mike-1", status: "Exited (0)", ports: "—" },
    { name: "simulation-emp-carlos-1", status: "Exited (0)", ports: "—" },
    { name: "simulation-emp-jenny-1", status: "Exited (0)", ports: "—" },
    { name: "simulation-emp-david-1", status: "Exited (0)", ports: "—" },
    { name: "simulation-remote-pc-1", status: "Up 2 hours", ports: "—" },
  ],

  // Real ClickHouse metering (from clickhouse-client query)
  metering: [
    { department: "Engineering", status: "success", calls: 12, tokens: 1079, cost: 12 },
    { department: "Engineering", status: "denied", calls: 1, tokens: 0, cost: 0 },
    { department: "Manufacturing", status: "success", calls: 4, tokens: 378, cost: 4 },
    { department: "Quality Assurance", status: "denied", calls: 2, tokens: 0, cost: 0 },
    { department: "Quality Assurance", status: "success", calls: 1, tokens: 96, cost: 1 },
    { department: "Supply Chain", status: "success", calls: 5, tokens: 466, cost: 5 },
  ],

  // Real policy events (from clickhouse-client query)
  policyEvents: [
    { decision: "deny", reason: "DLP: API Key (sk-ant-)", events: 3 },
    { decision: "deny", reason: "Invalid API key", events: 1 },
  ],

  // Real Postgres agents (from psql query)
  agents: [
    { name: "CodeReview-Bot", type: "claude_code", dept: "Engineering", status: "active", tier: "critical" },
    { name: "DocGen-Agent", type: "opencode", dept: "Engineering", status: "active", tier: "standard" },
    { name: "ArchDesign-Agent", type: "pi", dept: "Engineering", status: "active", tier: "standard" },
    { name: "ToolPath-Optimizer", type: "opencode", dept: "Manufacturing", status: "active", tier: "critical" },
    { name: "QualityAnalysis-Agent", type: "claude_code", dept: "Manufacturing", status: "active", tier: "standard" },
    { name: "SecurityScan-Agent", type: "claude_code", dept: "Quality Assurance", status: "active", tier: "critical" },
    { name: "TestGen-Agent", type: "copilot", dept: "Quality Assurance", status: "active", tier: "standard" },
    { name: "DemandForecast-Agent", type: "opencode", dept: "Supply Chain", status: "active", tier: "standard" },
    { name: "LogisticsOpt-Agent", type: "copilot", dept: "Supply Chain", status: "active", tier: "background" },
    { name: "ResearchAssist-Agent", type: "pi", dept: "Research & Development", status: "active", tier: "standard" },
  ],

  // Real employee terminal output — Sarah Chen (from docker logs)
  sarahTerminal: [
    { text: "WORKSTATION BOOT", dir: "ok" as const },
    { text: "Employee: Sarah Chen (Sr. Engineer)", dir: "ok" as const },
    { text: "Department: Engineering · Agent: Claude Code", dir: "ok" as const },
    { text: "ARM Proxy: http://arm.armtest.com:8787", dir: "ok" as const },
    { text: "Network: armtest-internal", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "DNS resolved — arm.armtest.com → internal IP", dir: "ok" as const },
    { text: "ARM Proxy v2.0.0-simulation — 6 features active", dir: "ok" as const },
    { text: "DLP scanner · Classification gate · Budget enforcement", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "Sarah Chen's Claude Code agent is now active", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "98 tokens in 5776ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "105 tokens in 18099ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "98 tokens in 35366ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "87 tokens in 1332ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "105 tokens in 19839ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Engineering] Sending prompt to minicpm5-1b", dir: "in" as const },
    { text: "87 tokens in 118777ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "Session complete — 6 calls processed through ARM governance", dir: "ok" as const },
  ],

  // Real employee terminal output — Jenny Park (DLP blocks, from docker logs)
  jennyTerminal: [
    { text: "Authenticating with ARM via Claude Code plugin...", dir: "ok" as const },
    { text: "DLP scanner active · Classification gate active · Budget enforcement active", dir: "ok" as const },
    { text: "Jenny Park (QA Lead)'s Claude Code agent is now active", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "[Quality Assurance] Sending prompt to qwen3.5", dir: "in" as const },
    { text: "BLOCKED by policy: DLP gate blocked: API Key (sk-ant-) detected in prompt", dir: "block" as const },
    { text: "[Quality Assurance] Sending prompt to qwen3.5", dir: "in" as const },
    { text: "96 tokens in 57881ms · cloud $0.0100 · saved $0.0100", dir: "ok" as const },
    { text: "[Quality Assurance] Sending prompt to qwen3.5", dir: "in" as const },
    { text: "BLOCKED by policy: DLP gate blocked: API Key (sk-ant-) detected in prompt", dir: "block" as const },
    { text: "", dir: "ok" as const },
    { text: "Session complete — 3 calls processed (2 DLP blocks)", dir: "ok" as const },
  ],

  // Aggregated totals (computed from real ClickHouse data)
  totals: {
    totalCalls: 25,
    successful: 22,
    denied: 3,
    totalTokens: 2019,
    cloudCostCents: 22,
  },
};
