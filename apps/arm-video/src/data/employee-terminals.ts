// REAL terminal output from the running enterprise simulation (Docker containers).
// Each block is verbatim from docker logs (ANSI stripped), capturing employees'
// coding agents working through the ARM proxy.

export const EMPLOYEE_TERMINALS = {
  sarah: [
    "🔑 Sub-account authenticated: arm_sk_coderevie...",
    "🛡️ DLP scanner active · Classification gate active · Budget enforcement active",
    "🚀 Sarah Chen (Sr. Engineer)'s Claude Code agent is now active",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 108 tokens in 118397ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 96 tokens in 30936ms · cloud $0.0100 · saved $0.0100",
  ],
  mike: [
    "🔑 Sub-account authenticated: arm_sk_docgen_ag...",
    "🚀 Mike Rodriguez (Engineer)'s OpenCode agent is now active",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 108 tokens in 119500ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Engineering] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 102 tokens in 28928ms · cloud $0.0100 · saved $0.0100",
  ],
  carlos: [
    "🚀 Carlos Mendes (Mfg. Lead)'s OpenCode agent is now active",
    "⬆️ [Manufacturing] Sending prompt to qwen3.5 via arm.armtest.com",
    "✅ 87 tokens in 3021ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Manufacturing] Sending prompt to qwen3.5 via arm.armtest.com",
    "❌ DLP gate blocked: CAM / Tooling Parameters detected in prompt",
  ],
  jenny: [
    "🚀 Jenny Park (QA Lead)'s Claude Code agent is now active",
    "⬆️ [Quality Assurance] Sending prompt to qwen3.5 via arm.armtest.com",
    "✅ 96 tokens in 4150ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Quality Assurance] Sending prompt to qwen3.5 via arm.armtest.com",
    "❌ DLP gate blocked: API Key (sk-ant-) detected in prompt",
  ],
  david: [
    "🚀 David Kim (Supply Chain)'s OpenCode agent is now active",
    "⬆️ [Supply Chain] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 104 tokens in 4120ms · cloud $0.0100 · saved $0.0100",
    "⬆️ [Supply Chain] Sending prompt to minicpm5-1b via arm.armtest.com",
    "✅ 98 tokens in 3310ms · cloud $0.0100 · saved $0.0100",
  ],
};

// REAL live classification lines from the ARM proxy container log
export const PROXY_CLASSIFICATION_LOG = [
  "🏷  [Engineering] CodeReview-Bot → code_review (stage=linear, conf=1)",
  "🏷  [Engineering] DocGen-Agent → documentation (stage=linear, conf=1)",
  "🏷  [Manufacturing] ToolPath-Optimizer → cnc_toolpath_optimization (stage=linear, conf=1)",
  "🏷  [Quality Assurance] SecurityScan-Agent → cybersecurity_scan (stage=linear, conf=1)",
  "🏷  [Supply Chain] DemandForecast-Agent → demand_forecasting (stage=linear, conf=1)",
];

// REAL ClickHouse query output — classification truth table
export const CLICKHOUSE_CLASSIFICATION = [
  {
    agent: "CodeReview-Bot",
    dept: "Engineering",
    workType: "code_review",
    stage: "linear",
    conf: 1.0,
    status: "success",
  },
  {
    agent: "DocGen-Agent",
    dept: "Engineering",
    workType: "documentation",
    stage: "linear",
    conf: 1.0,
    status: "success",
  },
  {
    agent: "ToolPath-Optimizer",
    dept: "Manufacturing",
    workType: "cnc_toolpath_optimization",
    stage: "linear",
    conf: 1.0,
    status: "success",
  },
  {
    agent: "SecurityScan-Agent",
    dept: "Quality Assurance",
    workType: "cybersecurity_scan",
    stage: "linear",
    conf: 1.0,
    status: "success",
  },
  {
    agent: "DemandForecast-Agent",
    dept: "Supply Chain",
    workType: "demand_forecasting",
    stage: "linear",
    conf: 1.0,
    status: "success",
  },
];
