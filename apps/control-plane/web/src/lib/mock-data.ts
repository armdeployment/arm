/**
 * Mock data for the ARM dashboard.
 *
 * Representative of what the real system would produce from ClickHouse +
 * Postgres (spec §5.3, §7, §8.5). Used until the tRPC routers wire live data.
 *
 * ALL VALUES ARE SYNTHETIC. No real tenant/agent/cost data.
 */

export interface SpendPoint {
  date: string;
  claude: number;
  gpt: number;
  glm: number;
}

export interface AgentRow {
  id: string;
  name: string;
  tier: "critical" | "standard" | "background";
  stakeholder: string;
  scope: string;
  monthlySpend: number;
  status: string;
}

export interface ModelSpend {
  model: string;
  provider: string;
  spend: number;
  kind: "closed" | "self_hosted";
}

export const spendTrend: SpendPoint[] = [
  { date: "Jul 01", claude: 420, gpt: 310, glm: 80 },
  { date: "Jul 05", claude: 460, gpt: 340, glm: 95 },
  { date: "Jul 10", claude: 510, gpt: 380, glm: 120 },
  { date: "Jul 15", claude: 480, gpt: 350, glm: 160 },
  { date: "Jul 20", claude: 440, gpt: 320, glm: 210 },
  { date: "Jul 25", claude: 410, gpt: 290, glm: 260 },
];

export const agents: AgentRow[] = [
  { id: "agt_05", name: "incident-triage", tier: "critical", stakeholder: "s.chen", scope: "Team: SRE", monthlySpend: 1580, status: "active" },
  { id: "agt_01", name: "hot-issue-resolver", tier: "critical", stakeholder: "s.chen", scope: "Team: Payments", monthlySpend: 1240, status: "active" },
  { id: "agt_02", name: "code-review-bot", tier: "standard", stakeholder: "j.park", scope: "Team: Platform", monthlySpend: 890, status: "active" },
  { id: "agt_07", name: "test-gen", tier: "standard", stakeholder: "j.park", scope: "Team: Platform", monthlySpend: 430, status: "active" },
  { id: "agt_03", name: "ux-optimizer", tier: "background", stakeholder: "m.kim", scope: "Dept: Product", monthlySpend: 320, status: "throttled" },
  { id: "agt_04", name: "doc-writer", tier: "standard", stakeholder: "a.lee", scope: "Team: Docs", monthlySpend: 210, status: "active" },
  { id: "agt_08", name: "data-pipeline-monitor", tier: "background", stakeholder: "k.tan", scope: "Team: Data", monthlySpend: 180, status: "disabled" },
  { id: "agt_06", name: "upgrade-bot", tier: "background", stakeholder: "r.gupta", scope: "Group: Eng", monthlySpend: 95, status: "active" },
];

export const modelSpend: ModelSpend[] = [
  { model: "Claude Sonnet 4.5", provider: "Anthropic", spend: 2720, kind: "closed" },
  { model: "GPT-4o", provider: "OpenAI", spend: 1990, kind: "closed" },
  { model: "GLM-5.2", provider: "Self-hosted", spend: 925, kind: "self_hosted" },
  { model: "DeepSeek V3", provider: "Self-hosted", spend: 340, kind: "self_hosted" },
];

export const summary = {
  totalMonthlySpend: 5975,
  agentCount: 47,
  proxiedTrafficPct: 84, // adoption metric (spec §9 exit gate: target ≥80%)
  budgetUtilizationPct: 73,
  criticalReservePct: 20,
  backgroundFloorPct: 5,
  pendingApprovals: 2,
};

export const tierBreakdown = [
  { tier: "critical", count: 4, color: "var(--critical)" },
  { tier: "standard", count: 31, color: "var(--standard)" },
  { tier: "background", count: 12, color: "var(--background)" },
];
