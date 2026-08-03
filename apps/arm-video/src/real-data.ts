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

  // ── D6: Industry Profiles (real profile data from packages/profiles) ────
  profiles: {
    manufacturing: {
      label: "Manufacturing / Industrial",
      icon: "🏭",
      orgTree: "HQ + 3 plants (Detroit, Stuttgart, Shenzhen)",
      departments: 21,
      plants: 3,
      resourceTypes: 14,
      dlpPatterns: 9,
      classification: "Dual-axis: sensitivity + ITAR/EAR/GxP",
      budgetPeriods: "monthly + shift + line + batch",
      modelRouting: "edge/on-prem GPU first",
      seedAgents: 10,
      panels: 11,
      orgNodes: [
        { type: "hq", name: "Corporate HQ", location: "Detroit, MI", budget: "$6,000/mo" },
        { type: "plant", name: "Plant Detroit", location: "Detroit, MI, USA", budget: "$8,000/mo", regulatory: "ITAR" },
        { type: "plant", name: "Plant Stuttgart", location: "Stuttgart, Germany", budget: "$6,000/mo", regulatory: "EAR" },
        { type: "plant", name: "Plant Shenzhen", location: "Shenzhen, China", budget: "$4,000/mo" },
      ],
    },
    finance: {
      label: "Finance / Financial Services",
      icon: "🏦",
      orgTree: "Flat + Chinese-wall isolation",
      departments: 6,
      plants: 0,
      resourceTypes: 10,
      dlpPatterns: 8,
      classification: "Dual-axis: sensitivity + SOX/GLBA/PCI/SEC/FINRA",
      budgetPeriods: "monthly + quarterly",
      modelRouting: "on-prem GPU first (MNPI never leaves VPC)",
      seedAgents: 8,
      panels: 9,
      orgNodes: [],
    },
    holding: {
      label: "Holding Company / Conglomerate",
      icon: "🏛️",
      orgTree: "4 subsidiaries, incl. manufacturing with plants",
      departments: 18,
      plants: 2,
      resourceTypes: 18,
      dlpPatterns: 10,
      classification: "Dual-axis: SOX+ITAR+EAR+GLBA+PCI+GxP (superset)",
      budgetPeriods: "monthly + quarterly",
      modelRouting: "on-prem first for restricted/cross-entity",
      seedAgents: 11,
      panels: 10,
      orgNodes: [
        { type: "organization", name: "Corporate (Parent)", budget: "$5,000/mo" },
        { type: "organization", name: "Tech Division", budget: "$8,000/mo" },
        { type: "organization", name: "Manufacturing Division", budget: "$10,000/mo" },
        { type: "plant", name: "↳ Plant Detroit", location: "Detroit, MI", budget: "$5,000/mo", regulatory: "ITAR" },
        { type: "plant", name: "↳ Plant Shenzhen", location: "Shenzhen, China", budget: "$5,000/mo" },
        { type: "organization", name: "Finance Division", budget: "$7,000/mo" },
      ],
    },
  },

  // ── D7: Work-type classification (real ClickHouse data) ─────────────────
  // Live results from 8 real Ollama LLM calls through the proxy, classified
  // by the zero-LLM cascade. Every tag, stage, and confidence is real.
  workTypeEvents: [
    { dept: "Engineering", prompt: '"review this pull request diff..."', workType: "code_review", stage: "linear", conf: 1.0, tokens: 34 },
    { dept: "Manufacturing", prompt: '"optimize CNC toolpath g-code..."', workType: "cnc_toolpath_optimization", stage: "linear", conf: 1.0, tokens: 36 },
    { dept: "Supply Chain", prompt: '"forecast demand for inventory..."', workType: "demand_forecasting", stage: "linear", conf: 1.0, tokens: 32 },
    { dept: "Quality Assurance", prompt: '"write a test with coverage..."', workType: "test_generation", stage: "linear", conf: 1.0, tokens: 34 },
    { dept: "Manufacturing", prompt: '"analyze SPC defect data..."', workType: "defect_analysis", stage: "linear", conf: 1.0, tokens: 35 },
    { dept: "Research & Development", prompt: '"summarize research literature..."', workType: "research_synthesis", stage: "linear", conf: 1.0, tokens: 33 },
    { dept: "Engineering", prompt: '"asdf qwer zxcv poiuy"', workType: "unknown", stage: "unknown", conf: null, tokens: 36 },
  ],

  // Real work-type taxonomies seeded from manufacturing profile
  workTypeTaxonomies: [
    { dept: "Engineering", labels: ["code_review", "code_generation", "test_generation", "architecture_design", "hot_issue_resolution", "devops_automation", "dependency_upgrade"] },
    { dept: "Manufacturing", labels: ["cnc_toolpath_optimization", "defect_analysis", "process_recipe_optimization", "predictive_maintenance", "spc_analysis", "quality_inspection"] },
    { dept: "Quality Assurance", labels: ["test_generation", "defect_analysis", "cybersecurity_scan", "compliance_review", "spc_analysis"] },
    { dept: "Supply Chain", labels: ["demand_forecasting", "route_optimization", "inventory_replenishment", "logistics_planning"] },
    { dept: "Research & Development", labels: ["research_synthesis", "experiment_design", "patent_analysis", "material_research"] },
  ],

  // Real D7 classifier cascade stages
  classifierCascade: [
    { stage: "1", name: "Structural", mechanism: "model_id · agent type · tool calls · file extensions", cost: "$0", latency: "0ms", coverage: "~60%" },
    { stage: "2", name: "Hash Cache", mechanism: "prompt-hash → label LRU (10K entries)", cost: "$0", latency: "ns", coverage: "repeats" },
    { stage: "3", name: "Linear", mechanism: "keyword classifier per taxonomy", cost: "$0", latency: "µs", coverage: "F1 0.85-0.92" },
    { stage: "4", name: "Embedding", mechanism: "centroid similarity (only on ambiguous tail)", cost: "$0", latency: "6-35ms", coverage: "low-conf fallback" },
    { stage: "QA", name: "LLM Judge", mechanism: "sampled 1-5% · batch cron · NOT in hot path", cost: "1-5%", latency: "offline", coverage: "drift audit" },
  ],
};
