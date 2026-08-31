// ── VIDEO 1: Work-Type Tagging & Classification (D7) ───────────────────────
// ALL data from the REAL running enterprise simulation (2026-08-03):
// real Ollama LLM calls → ARM proxy → zero-LLM cascade → ClickHouse.

import { COLORS } from "../theme";

export const V1 = {
  // Real employees + their coding agents (from docker-compose env)
  employees: [
    {
      name: "Sarah Chen",
      role: "Sr. Engineer",
      dept: "Engineering",
      agent: "Claude Code",
      model: "minicpm5-1b",
      color: COLORS.navy,
      terminal: "emp-sarah",
    },
    {
      name: "Mike Rodriguez",
      role: "Engineer",
      dept: "Engineering",
      agent: "OpenCode",
      model: "minicpm5-1b",
      color: COLORS.navy,
      terminal: "emp-mike",
    },
    {
      name: "Carlos Mendes",
      role: "Mfg. Lead",
      dept: "Production",
      agent: "OpenCode",
      model: "qwen3.5",
      color: COLORS.gold,
      terminal: "emp-carlos",
    },
    {
      name: "Jenny Park",
      role: "QA Lead",
      dept: "Quality Control",
      agent: "Claude Code",
      model: "qwen3.5",
      color: COLORS.red,
      terminal: "emp-jenny",
    },
    {
      name: "David Kim",
      role: "Supply Chain",
      dept: "Procurement & Supply Chain",
      agent: "GitHub Copilot",
      model: "minicpm5-1b",
      color: COLORS.cyan,
      terminal: "emp-david",
    },
  ],

  // Real proxy live-classification log lines (from docker logs)
  proxyClassificationLog: [
    "🏷  [Engineering] CodeReview-Bot → code_review (stage=linear, conf=1)",
    "🏷  [Engineering] DocGen-Agent → documentation (stage=linear, conf=1)",
    "🏷  [Production] ToolPath-Optimizer → cnc_toolpath_optimization (stage=linear, conf=1)",
    "🏷  [Quality Control] SecurityScan-Agent → cybersecurity_scan (stage=linear, conf=1)",
    "🏷  [Procurement & Supply Chain] DemandForecast-Agent → demand_forecasting (stage=linear, conf=1)",
  ],

  // Real ClickHouse llm_events — classification truth (from clickhouse-client)
  classification: [
    {
      agent: "CodeReview-Bot",
      dept: "Engineering",
      workType: "code_review",
      stage: "linear",
      conf: 1.0,
      status: "success",
      color: COLORS.navy,
    },
    {
      agent: "DocGen-Agent",
      dept: "Engineering",
      workType: "documentation",
      stage: "linear",
      conf: 1.0,
      status: "success",
      color: COLORS.navy,
    },
    {
      agent: "ToolPath-Optimizer",
      dept: "Production",
      workType: "cnc_toolpath_optimization",
      stage: "linear",
      conf: 1.0,
      status: "success",
      color: COLORS.gold,
    },
    {
      agent: "SecurityScan-Agent",
      dept: "Quality Control",
      workType: "cybersecurity_scan",
      stage: "linear",
      conf: 1.0,
      status: "success",
      color: COLORS.red,
    },
    {
      agent: "DemandForecast-Agent",
      dept: "Procurement & Supply Chain",
      workType: "demand_forecasting",
      stage: "linear",
      conf: 1.0,
      status: "success",
      color: COLORS.cyan,
    },
  ],

  // Real DLP blocks (security story — real deny events)
  dlpBlocks: [
    {
      agent: "ToolPath-Optimizer",
      reason: "DLP:CAM / Tooling Parameters",
      severity: "critical",
      color: COLORS.red,
    },
    {
      agent: "SecurityScan-Agent",
      reason: "DLP:API Key (sk-ant-)",
      severity: "critical",
      color: COLORS.red,
    },
  ],

  // Real cascade stages (D7)
  cascade: [
    {
      stage: "1",
      name: "Structural",
      mechanism: "model_id · agent type · tool calls · file exts",
      latency: "0 ms",
      coverage: "~60%",
    },
    {
      stage: "2",
      name: "Prompt-hash cache",
      mechanism: "10K-entry LRU · repeats are free",
      latency: "ns",
      coverage: "repeats",
    },
    {
      stage: "3",
      name: "Linear classifier",
      mechanism: "keyword scoring per taxonomy",
      latency: "µs",
      coverage: "F1 0.85–0.92",
    },
    {
      stage: "4",
      name: "Embedding centroid",
      mechanism: "only the ambiguous tail",
      latency: "6–35 ms",
      coverage: "fallback",
    },
  ],
};
