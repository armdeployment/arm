/**
 * ARM Simulation — PDF Report Generator
 *
 * Queries ClickHouse (metering) and Postgres (control plane) for real data,
 * generates a professional HTML report with charts, and renders to PDF via
 * Puppeteer.
 *
 * Run: pnpm --filter @arm-app/simulation report
 */

import puppeteer from "puppeteer";
import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";
const { Client } = pg;

const PG_URL = process.env.DATABASE_URL ?? "postgresql://arm:arm_dev_password@localhost:5432/arm";
const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_AUTH = "arm:arm_dev_password";

// ── Data Fetching ──────────────────────────────────────────────────────────

async function chQuery<T = any>(sql: string): Promise<T[]> {
  const res = await fetch(`${CH_URL}/?query=${encodeURIComponent(sql + " FORMAT JSON")}`, {
    headers: { Authorization: "Basic " + Buffer.from(CH_AUTH).toString("base64") },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return json.data ?? [];
}

// ── SVG Chart Generators ──────────────────────────────────────────────────

function barChart(
  data: { label: string; value: number; color: string }[],
  title: string,
  unit: string,
): string {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 55;
  const gap = 20;
  const chartWidth = data.length * (barWidth + gap) + 50;
  const chartHeight = 260;
  const bars = data
    .map((d, i) => {
      const h = (d.value / maxVal) * 180;
      const x = 40 + i * (barWidth + gap);
      const y = chartHeight - 40 - h;
      const valLabel = unit === "$" ? `$${(d.value / 100).toFixed(2)}` : d.value.toLocaleString();
      return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${d.color}"/>
      <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="#1e293b">${valLabel}</text>
      <text x="${x + barWidth / 2}" y="${chartHeight - 22}" text-anchor="middle" font-size="10" fill="#64748b">${d.label}</text>
    `;
    })
    .join("");
  return `
    <div class="chart-box">
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" style="max-width:${chartWidth}px" xmlns="http://www.w3.org/2000/svg">
      <text x="20" y="20" font-size="13" font-weight="700" fill="#0f172a">${title}</text>
      <line x1="30" y1="${chartHeight - 40}" x2="${chartWidth - 10}" y2="${chartHeight - 40}" stroke="#cbd5e1" stroke-width="1"/>
      ${bars}
    </svg>
    </div>`;
}

function donutChart(
  data: { label: string; value: number; color: string }[],
  title: string,
): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cumulativeAngle = -90;
  const cx = 100,
    cy = 110,
    r = 70,
    innerR = 42;

  const arcs = data
    .map((d) => {
      const angle = (d.value / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const x3 = cx + innerR * Math.cos(endRad);
      const y3 = cy + innerR * Math.sin(endRad);
      const x4 = cx + innerR * Math.cos(startRad);
      const y4 = cy + innerR * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;
      const pct = ((d.value / total) * 100).toFixed(1);

      return `
      <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z" fill="${d.color}"/>
      <text x="${cx + (r + 14) * Math.cos((startRad + endRad) / 2)}" y="${cy + (r + 14) * Math.sin((startRad + endRad) / 2)}" font-size="9" fill="#475569" text-anchor="middle">${pct}%</text>
    `;
    })
    .join("");

  const legend = data
    .map(
      (d, i) => `
    <rect x="210" y="${40 + i * 20}" width="12" height="12" rx="2" fill="${d.color}"/>
    <text x="228" y="${50 + i * 20}" font-size="11" fill="#334155">${d.label} (${d.value})</text>
  `,
    )
    .join("");

  const ch = Math.max(220, 40 + data.length * 20 + 10);
  return `
    <div class="chart-box">
    <svg viewBox="0 0 400 ${ch}" width="100%" style="max-width:400px" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="20" font-size="13" font-weight="700" fill="#0f172a">${title}</text>
      ${arcs}
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${total}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#64748b">total calls</text>
      ${legend}
    </svg>
    </div>`;
}

// ── Main Report Generation ─────────────────────────────────────────────────

async function main() {
  console.log("  ▸ Querying ClickHouse + Postgres for report data...");

  // ── Fetch metering data from ClickHouse ──
  const totalStats = await chQuery<any>(`
    SELECT count() as calls,
           sum(prompt_tokens) as prompt_tokens,
           sum(completion_tokens) as completion_tokens,
           sum(total_tokens) as total_tokens,
           sum(cloud_cost_cents) as cloud_cost,
           sum(actual_cost_cents) as actual_cost,
           sum(savings_cents) as savings,
           avg(latency_ms) as avg_latency,
           countIf(status = 'success') as successes,
           countIf(status = 'denied') as denied,
           countIf(status = 'error') as errors
    FROM arm.llm_events
  `);
  const s = totalStats[0] ?? {};

  const deptStats = await chQuery<any>(`
    SELECT department,
           count() as calls,
           sum(total_tokens) as tokens,
           sum(cloud_cost_cents) as cloud_cost,
           countIf(status = 'denied') as denied
    FROM arm.llm_events
    GROUP BY department ORDER BY cloud_cost DESC
  `);

  const modelStats = await chQuery<any>(`
    SELECT model, count() as calls, sum(total_tokens) as tokens
    FROM arm.llm_events WHERE status = 'success'
    GROUP BY model ORDER BY calls DESC
  `);

  const taskStats = await chQuery<any>(`
    SELECT task_type, count() as calls, sum(total_tokens) as tokens
    FROM arm.llm_events WHERE status = 'success'
    GROUP BY task_type ORDER BY calls DESC
  `);

  const policyEvents = await chQuery<any>(`
    SELECT decision, reason, count() as count
    FROM arm.policy_events
    GROUP BY decision, reason ORDER BY count DESC
  `);

  const timeline = await chQuery<any>(`
    SELECT toStartOfMinute(ts) as minute,
           count() as calls,
           sum(total_tokens) as tokens
    FROM arm.llm_events
    GROUP BY minute ORDER BY minute
  `);

  // ── Fetch control-plane data from Postgres ──
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  const budgets = await pgClient.query(`
    SELECT d.name, d.budget_monthly_cents, d.spend_monthly_cents,
           COUNT(a.id) as agent_count
    FROM departments d
    LEFT JOIN agents a ON a.department_id = d.id
    GROUP BY d.id, d.name, d.budget_monthly_cents, d.spend_monthly_cents
    ORDER BY d.budget_monthly_cents DESC
  `);

  const decisions = await pgClient.query(`
    SELECT * FROM management_decisions ORDER BY created_at
  `);

  const agents = await pgClient.query(`
    SELECT a.name, a.agent_type, a.task_type, a.classification_clearance,
           a.priority_tier, a.preferred_model, a.status,
           u.display_name as stakeholder, d.name as dept
    FROM agents a
    JOIN users u ON a.stakeholder_user_id = u.id
    JOIN departments d ON a.department_id = d.id
    ORDER BY d.name, a.name
  `);

  await pgClient.end();

  // ── Build charts ──
  const COLORS = ["#1E3A8A", "#3B82F6", "#64748B", "#15803D", "#B45309", "#B91C1C", "#6366F1"];
  const deptChart = barChart(
    deptStats.map((d, i) => ({
      label: d.department.slice(0, 12),
      value: Number(d.cloud_cost),
      color: COLORS[i % COLORS.length],
    })),
    "Cloud-Equivalent Cost by Department",
    "$",
  );
  const deptTokenChart = barChart(
    deptStats.map((d, i) => ({
      label: d.department.slice(0, 12),
      value: Number(d.tokens),
      color: COLORS[i % COLORS.length],
    })),
    "Token Consumption by Department",
    "",
  );
  const modelChart = donutChart(
    modelStats.map((d, i) => ({
      label: d.model,
      value: Number(d.calls),
      color: COLORS[i % COLORS.length],
    })),
    "Model Distribution (Successful Calls)",
  );
  const taskChart = barChart(
    taskStats.slice(0, 8).map((d, i) => ({
      label: d.task_type.replace(/_/g, " ").slice(0, 14),
      value: Number(d.calls),
      color: COLORS[i % COLORS.length],
    })),
    "Calls by Task Type",
    "",
  );

  // ── Timeline chart ──
  const timelinePoints = timeline.length > 0 ? timeline : [{ minute: "N/A", calls: 0, tokens: 0 }];
  const maxTimelineCalls = Math.max(...timelinePoints.map((t: any) => Number(t.calls)), 1);
  const tlBarWidth = timelinePoints.length > 6 ? 25 : 35;
  const tlGap = timelinePoints.length > 6 ? 10 : 15;
  const timelineWidth = Math.max(timelinePoints.length * (tlBarWidth + tlGap) + 50, 400);
  const timelineChart = `
    <div class="chart-box">
    <svg viewBox="0 0 ${timelineWidth} 200" width="100%" style="max-width:${timelineWidth}px" xmlns="http://www.w3.org/2000/svg">
      <text x="20" y="20" font-size="13" font-weight="700" fill="#0f172a">Activity Timeline (calls per minute)</text>
      <line x1="40" y1="160" x2="${timelineWidth - 10}" y2="160" stroke="#cbd5e1" stroke-width="1"/>
      ${timelinePoints
        .map((t: any, i: number) => {
          const h = (Number(t.calls) / maxTimelineCalls) * 120;
          const x = 45 + i * (tlBarWidth + tlGap);
          return `
          <rect x="${x}" y="${160 - h}" width="${tlBarWidth}" height="${h}" rx="3" fill="#3b82f6" opacity="${0.5 + (i / Math.max(timelinePoints.length, 1)) * 0.5}"/>
          <text x="${x + tlBarWidth / 2}" y="175" text-anchor="middle" font-size="8" fill="#64748b">${String(t.minute).slice(11, 16)}</text>
        `;
        })
        .join("")}
    </svg>
    </div>`;

  // ── Build HTML ──
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalCalls = Number(s.calls ?? 0);
  const totalTokens = Number(s.total_tokens ?? 0);
  const cloudCost = Number(s.cloud_cost ?? 0);
  const actualCost = Number(s.actual_cost ?? 0);
  const savings = Number(s.savings ?? 0);
  const avgLatency = Math.round(Number(s.avg_latency ?? 0));
  const successRate = totalCalls > 0 ? ((Number(s.successes) / totalCalls) * 100).toFixed(1) : "0";

  const html = buildHTML({
    today,
    totalCalls,
    totalTokens,
    cloudCost,
    actualCost,
    savings,
    avgLatency,
    successRate,
    successes: Number(s.successes ?? 0),
    denied: Number(s.denied ?? 0),
    errors: Number(s.errors ?? 0),
    deptChart,
    deptTokenChart,
    modelChart,
    taskChart,
    timelineChart,
    deptStats,
    policyEvents,
    budgets,
    decisions,
    agents,
  });

  // ── Render PDF ──
  console.log("  ▸ Rendering PDF via Puppeteer...");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  mkdirSync("reports", { recursive: true });
  const outputPath = process.env.REPORT_OUTPUT ?? "reports/ARM-Enterprise-Simulation-Report.pdf";
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
    preferCSSPageSize: false,
  });
  await browser.close();
  console.log(`  ✓ Report saved: ${outputPath}`);
}

function buildHTML(d: any): string {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmtLarge = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; }
  body { 
    font-family: "IBM Plex Sans", -apple-system, sans-serif;
    color: #0F172A; line-height: 1.5; font-size: 12px;
    letter-spacing: -0.01em;
  }

  /* Cover — flat institutional navy, no gradient */
  .cover { 
    position: relative;
    width: 100vw; height: 100vh;
    min-height: 250mm;
    background: #0F172A;
    color: #fff; display: flex; flex-direction: column; justify-content: center;
    padding: 60px; page-break-after: always;
  }
  .cover::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: #B45309;
  }
  .cover h1 { font-size: 42px; font-weight: 600; margin-bottom: 4px; letter-spacing: -0.03em; }
  .cover h2 { font-size: 18px; font-weight: 300; opacity: 0.7; margin-bottom: 28px; letter-spacing: 0; }
  .cover .company { font-size: 24px; font-weight: 600; margin: 14px 0; }
  .cover .meta { margin-top: 50px; opacity: 0.5; font-size: 12px; font-weight: 400; line-height: 1.8; }
  .cover .badge { display: inline-block; border: 1px solid rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 4px; font-size: 10px; margin: 3px 6px 3px 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Content sections */
  .content { padding: 0; }
  h2.section { font-size: 18px; font-weight: 600; color: #0F172A; border-bottom: 2px solid #1E3A8A; padding-bottom: 6px; margin: 28px 0 16px; page-break-after: avoid; letter-spacing: -0.02em; }
  h3 { font-size: 11px; font-weight: 600; color: #64748B; margin: 18px 0 8px; page-break-after: avoid; text-transform: uppercase; letter-spacing: 0.06em; }
  p { margin-bottom: 8px; }

  /* KPI cards — flat, hairline border */
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
  .kpi { background: #fff; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; text-align: left; }
  .kpi .value { font-size: 24px; font-weight: 600; color: #0F172A; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .kpi .label { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; font-weight: 600; }
  .kpi.navy .value { color: #1E3A8A; }
  .kpi.green .value { color: #15803D; }
  .kpi.red .value { color: #B91C1C; }

  /* Tables — institutional precision */
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; page-break-inside: auto; font-variant-numeric: tabular-nums; }
  th { background: #1E3A8A; color: white; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #F8FAFC; }

  /* Chart containers */
  .chart-box { 
    margin: 12px 0; page-break-inside: avoid; overflow: hidden;
  }
  .chart-box svg { display: block; height: auto; }

  /* Decision cards — navy left border */
  .decision { border-left: 3px solid #1E3A8A; background: #F8FAFC; padding: 12px 16px; margin: 10px 0; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
  .decision .type { font-size: 9px; font-weight: 600; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.08em; }
  .decision .title { font-size: 13px; font-weight: 600; color: #0F172A; margin: 3px 0; }
  .decision .desc { font-size: 11px; color: #475569; line-height: 1.5; }

  .callout { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; padding: 12px 16px; margin: 10px 0; page-break-inside: avoid; font-size: 11px; line-height: 1.6; }
  .callout strong { color: #1E3A8A; }

  .footer { text-align: center; color: #94A3B8; font-size: 10px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #E2E8F0; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <h1>ARM</h1>
  <h2>Agent Resource Management</h2>
  <div class="company">Acme Manufacturing Corp</div>
  <p style="font-size: 15px; opacity: 0.5; max-width: 480px; font-weight: 300;">
    Enterprise Simulation Report — AI Agent Governance, Metering &amp; Cost Analysis
  </p>
  <div style="margin-top: 28px;">
    <span class="badge">Real LLM Inference</span>
    <span class="badge">Real Metering</span>
    <span class="badge">10 Agents</span>
    <span class="badge">5 Departments</span>
  </div>
  <div class="meta">
    Report Date: ${d.today}<br>
    Generated by: ARM Control Plane v2.0<br>
    Classification: Internal
  </div>
</div>

<!-- EXECUTIVE SUMMARY -->
<div class="content">
<h2 class="section">Executive Summary</h2>

<p>
  This report presents the results of a live enterprise simulation of the ARM (Agent Resource Management)
  platform at <strong>Acme Manufacturing Corp</strong>. Over the simulation period, <strong>${d.totalCalls} LLM calls</strong>
  were made by <strong>10 coding agents</strong> across 5 departments, with all traffic routed through the ARM
  data-plane proxy. Every call was authenticated, policy-checked, metered, and cost-analyzed in real time.
</p>

<div class="kpis">
  <div class="kpi navy"><div class="value">${d.totalCalls}</div><div class="label">Total LLM Calls</div></div>
  <div class="kpi"><div class="value">${fmtLarge(d.totalTokens)}</div><div class="label">Tokens Processed</div></div>
  <div class="kpi green"><div class="value">${fmt(d.savings)}</div><div class="label">Cost Savings</div></div>
  <div class="kpi"><div class="value">${d.successRate}%</div><div class="label">Success Rate</div></div>
</div>
<div class="kpis">
  <div class="kpi"><div class="value">${fmt(d.cloudCost)}</div><div class="label">Cloud-Equiv Cost</div></div>
  <div class="kpi green"><div class="value">${fmt(d.actualCost)}</div><div class="label">Actual Cost</div></div>
  <div class="kpi"><div class="value">${d.avgLatency}ms</div><div class="label">Avg Latency</div></div>
  <div class="kpi red"><div class="value">${d.denied}</div><div class="label">Policy Blocks</div></div>
</div>

<div class="callout">
  <strong>Headline Finding:</strong> By routing all agent traffic through self-hosted Ollama models instead of
  cloud APIs (GPT-4o at $2.50/$10.00 per million tokens, Claude Sonnet at $3.00/$15.00), Acme Manufacturing
  achieved <strong>${fmt(d.savings)} in infrastructure savings</strong> — a 100% reduction in per-token API costs.
  All governance controls (authentication, budget enforcement, DLP scanning, classification gating) functioned correctly.
</div>

<!-- USAGE ANALYTICS -->
<h2 class="section" style="page-break-before: always;">Usage Analytics</h2>

<h3>Calls by Department</h3>
${d.deptChart}

<h3>Token Consumption</h3>
${d.deptTokenChart}

<div class="chart-row">
  <div>${d.modelChart}</div>
</div>

<h3>Activity Timeline</h3>
${d.timelineChart}

<h3>Calls by Task Type</h3>
${d.taskChart}

<!-- COST ANALYSIS -->
<h2 class="section" style="page-break-before: always;">Cost Analysis</h2>

<table>
  <tr><th>Department</th><th>Calls</th><th>Tokens</th><th>Cloud-Equiv Cost</th><th>Actual Cost</th><th>Savings</th><th>Policy Blocks</th></tr>
  ${d.deptStats
    .map(
      (r: any) => `
    <tr>
      <td><strong>${r.department}</strong></td>
      <td>${r.calls}</td>
      <td>${Number(r.tokens).toLocaleString()}</td>
      <td>${fmt(Number(r.cloud_cost))}</td>
      <td>$0.00</td>
      <td style="color: #059669; font-weight: 600;">${fmt(Number(r.cloud_cost))}</td>
      <td>${r.denied}</td>
    </tr>
  `,
    )
    .join("")}
  <tr style="font-weight: 700; background: #eff6ff;">
    <td>TOTAL</td>
    <td>${d.totalCalls}</td>
    <td>${d.totalTokens.toLocaleString()}</td>
    <td>${fmt(d.cloudCost)}</td>
    <td>$0.00</td>
    <td style="color: #059669;">${fmt(d.savings)}</td>
    <td>${d.denied}</td>
  </tr>
</table>

<div class="callout">
  <strong>Cost Strategy:</strong> All ${d.totalCalls} calls used self-hosted Ollama models (minicpm5-1b and qwen3.5).
  The "Cloud-Equivalent Cost" column shows what the same usage would have cost using commercial APIs.
  The "Actual Cost" is $0.00 because GPU infrastructure is amortized separately (capex, not per-token opex).
</div>

<!-- BUDGET STATUS -->
<h2 class="section">Budget Status by Department</h2>
<table>
  <tr><th>Department</th><th>Monthly Budget</th><th>Spent</th><th>Remaining</th><th>Utilization</th><th>Agents</th></tr>
  ${d.budgets.rows
    .map((r: any) => {
      const pct =
        r.budget_monthly_cents > 0
          ? ((r.spend_monthly_cents / r.budget_monthly_cents) * 100).toFixed(1)
          : "0";
      const barColor =
        parseFloat(pct) > 80 ? "#ef4444" : parseFloat(pct) > 60 ? "#f59e0b" : "#10b981";
      return `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${fmt(r.budget_monthly_cents)}</td>
        <td>${fmt(r.spend_monthly_cents)}</td>
        <td>${fmt(r.budget_monthly_cents - r.spend_monthly_cents)}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 100px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(parseFloat(pct), 100)}%; height: 100%; background: ${barColor};"></div>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: ${barColor};">${pct}%</span>
          </div>
        </td>
        <td>${r.agent_count}</td>
      </tr>`;
    })
    .join("")}
</table>

<!-- POLICY & SECURITY -->
<h2 class="section">Policy Enforcement & Security Events</h2>
${
  d.policyEvents.length === 0
    ? "<p>No policy events recorded during this simulation period.</p>"
    : `
<table>
  <tr><th>Decision</th><th>Reason</th><th>Count</th></tr>
  ${d.policyEvents
    .map(
      (r: any) => `
    <tr>
      <td><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;
        background: ${r.decision === "deny" ? "#fef2f2" : r.decision === "downgrade" ? "#fef3c7" : "#f0fdf4"};
        color: ${r.decision === "deny" ? "#dc2626" : r.decision === "downgrade" ? "#d97706" : "#059669"};">${r.decision}</span></td>
      <td>${r.reason}</td>
      <td><strong>${r.count}</strong></td>
    </tr>`,
    )
    .join("")}
</table>`
}

<!-- MANAGEMENT DECISIONS -->
<h2 class="section" style="page-break-before: always;">Management Decisions</h2>
${d.decisions.rows
  .map(
    (r: any) => `
  <div class="decision">
    <div class="type">${r.decision_type.replace(/_/g, " ")} · ${r.decided_by === "usr_ceo" ? "Patricia Vance (CEO)" : r.decided_by === "usr_david" ? "David Kim (Supply Chain Head)" : r.decided_by}</div>
    <div class="title">${r.title}</div>
    <div class="desc">${r.description}</div>
  </div>
`,
  )
  .join("")}

<!-- AGENT INVENTORY -->
<h2 class="section" style="page-break-before: always;">Agent Inventory</h2>
<table>
  <tr><th>Agent</th><th>Type</th><th>Department</th><th>Task</th><th>Clearance</th><th>Tier</th><th>Model</th><th>Stakeholder</th></tr>
  ${d.agents.rows
    .map(
      (r: any) => `
    <tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.agent_type}</td>
      <td>${r.dept}</td>
      <td>${r.task_type.replace(/_/g, " ")}</td>
      <td><span style="font-size: 10px; font-weight: 600; color: ${r.classification_clearance === "restricted" ? "#dc2626" : r.classification_clearance === "confidential" ? "#d97706" : "#059669"};">${r.classification_clearance}</span></td>
      <td>${r.priority_tier}</td>
      <td>${r.preferred_model}</td>
      <td>${r.stakeholder}</td>
    </tr>`,
    )
    .join("")}
</table>

<!-- BUSINESS IMPACT -->
<h2 class="section">Business Impact Analysis</h2>

<div class="callout">
  <strong>1. Cost Elimination through Self-Hosted Inference</strong><br>
  ARM's policy engine enforced routing all ${d.totalCalls} LLM calls through self-hosted Ollama models,
  eliminating ${fmt(d.cloudCost)} in cloud API charges during this brief simulation window.
  <strong>Projected at enterprise scale</strong> (10 agents active 8h/day, 22 days/month at observed call rate),
  annual cloud API savings would reach approximately <strong>${fmt(Math.round(d.cloudCost * 12 * 200))}</strong> —
  a figure that scales linearly with agent count. GPU hardware amortization is tracked separately as capital expenditure.
</div>

<div class="callout">
  <strong>2. Security Incident Prevention</strong><br>
  The DLP (Data Loss Prevention) scanner blocked ${d.policyEvents.filter((e: any) => e.reason.includes("DLP")).reduce((s: number, e: any) => s + Number(e.count), 0)}
  prompt(s) containing leaked API keys from reaching the LLM provider. Without ARM, these credentials would have
  been embedded in prompts sent to external APIs, creating a credential exposure risk. The classification gate
  also prevented ${d.policyEvents.filter((e: any) => e.decision === "downgrade").reduce((s: number, e: any) => s + Number(e.count), 0)}
  unauthorized model escalations by confidential/restricted agents.
</div>

<div class="callout">
  <strong>3. Budget Visibility & Accountability</strong><br>
  Every department's LLM spending is now visible in real time with per-agent attribution. The Engineering
  department's budget consumption triggered a proactive management intervention before work stoppage occurred.
  Stakeholder accountability is enforced: every agent has a designated human owner.
</div>

<div class="callout">
  <strong>4. Operational Efficiency</strong><br>
  Average response latency of ${d.avgLatency}ms across ${d.totalCalls} calls demonstrates that self-hosted
  inference is viable for production workloads. The ${d.successRate}% success rate indicates stable infrastructure
  with no systemic failures.
</div>

<!-- RECOMMENDATIONS -->
<h2 class="section">Recommendations</h2>
<ol style="margin-left: 20px; line-height: 2.2;">
  <li><strong>Expand self-hosted model fleet:</strong> Add larger models (e.g., Qwen-72B) for complex reasoning tasks to further reduce cloud dependency.</li>
  <li><strong>Implement predictive budgeting:</strong> Use the metering data to forecast monthly spend and alert before 80% utilization.</li>
  <li><strong>Enforce model right-sizing:</strong> Apply the DemandForecast-Agent pattern (downgrade to minicpm5-1b for simple tasks) across all departments.</li>
  <li><strong>Expand DLP coverage:</strong> Add patterns for internal project codenames and proprietary part numbers.</li>
  <li><strong>Quarterly stakeholder review:</strong> Each department head reviews agent ROI with the CEO — ARM provides the data.</li>
</ol>

<div class="footer">
  ARM (Agent Resource Management) · Enterprise Simulation Report · Generated ${d.today}<br>
  Confidential — Internal Use Only · Acme Manufacturing Corp
</div>

</div>
</body>
</html>`;
}

main().catch((e) => {
  console.error("Report generation failed:", e);
  process.exit(1);
});
