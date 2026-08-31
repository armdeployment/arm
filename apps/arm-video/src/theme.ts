// ARM Enterprise Video — Shared design constants
// Institutional color palette matching the ARM dashboard

export const COLORS = {
  navy: "#1E3A8A",
  navyDeep: "#0F172A",
  navyDark: "#172554",
  gold: "#B45309",
  goldLight: "#D97706",
  bg: "#F8FAFC",
  bgDark: "#0F172A",
  white: "#FFFFFF",
  border: "#E2E8F0",
  borderDark: "#334155",
  text: "#0F172A",
  textMuted: "#64748B",
  textDark: "#E2E8F0",
  textDarkMuted: "#94A3B8",
  green: "#16A34A",
  greenDark: "#22C55E",
  red: "#DC2626",
  redDark: "#EF4444",
  amber: "#F59E0B",
  cyan: "#0891B2",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",
} as const;

// Font stacks
export const FONT_SANS =
  '"IBM Plex Sans", "Inter", system-ui, -apple-system, sans-serif';
export const FONT_MONO =
  '"IBM Plex Mono", "JetBrains Mono", "SF Mono", "Fira Code", monospace';

// Simulation data (from real ClickHouse metering)
export const SIM_RESULTS = {
  totalCalls: 26,
  successfulCalls: 22,
  deniedCalls: 2,
  errorCalls: 2,
  totalTokens: 2052,
  cloudCostCents: 22,
  savingsCents: 33,
  departments: [
    {
      name: "Engineering",
      calls: 10,
      tokens: 963,
      cost: 10,
      color: COLORS.navy,
    },
    {
      name: "Manufacturing",
      calls: 4,
      tokens: 378,
      cost: 4,
      color: COLORS.gold,
    },
    {
      name: "Supply Chain",
      calls: 5,
      tokens: 466,
      cost: 5,
      color: COLORS.cyan,
    },
    { name: "R&D", calls: 3, tokens: 245, cost: 3, color: COLORS.green },
    { name: "QA", calls: 2, tokens: 0, cost: 0, color: COLORS.red },
  ],
};

export const EMPLOYEES = [
  {
    name: "Sarah Chen",
    role: "Sr. Engineer",
    dept: "Engineering",
    agent: "Claude Code",
    model: "minicpm5-1b",
    color: COLORS.navy,
  },
  {
    name: "Mike Rodriguez",
    role: "Engineer",
    dept: "Engineering",
    agent: "OpenCode",
    model: "minicpm5-1b",
    color: COLORS.navy,
  },
  {
    name: "Carlos Mendes",
    role: "Mfg. Lead",
    dept: "Manufacturing",
    agent: "OpenCode",
    model: "qwen3.5",
    color: COLORS.gold,
  },
  {
    name: "Jenny Park",
    role: "QA Lead",
    dept: "Quality Assurance",
    agent: "Claude Code",
    model: "qwen3.5",
    color: COLORS.red,
  },
  {
    name: "David Kim",
    role: "Supply Chain",
    dept: "Supply Chain",
    agent: "GitHub Copilot",
    model: "minicpm5-1b",
    color: COLORS.cyan,
  },
  {
    name: "Alex Thompson",
    role: "Remote (VPN)",
    dept: "R&D",
    agent: "Pi",
    model: "minicpm5-1b",
    color: COLORS.green,
  },
];
