// ── VIDEO 5: The Install Wizard Talks Back ──────────────────────────────
// LLM chat assistant + multi-project folder picker, added to the install
// wizard from Video 4. Every screenshot is a real capture — a real
// activation code redeemed, a real conversation with a real Ollama model
// (minicpm5-1b) routed through the real data-plane proxy, and a real scan
// across two real seeded project folders.

export const V5 = {
  chatExchange: {
    user: "I run a manufacturing plant and my team keeps waiting on me for budget approvals before they can order parts",
    assistant: "Understood. This is a common operational bottleneck at manufacturing plants where budget approvals are consistently delayed...",
    model: "minicpm5-1b",
  },

  routing: [
    { label: "Employee's chat message", detail: "typed in the wizard" },
    { label: "Tenant's own proxy", detail: "armProxyUrl + agentToken — same as any tool call" },
    { label: "Real LLM", detail: "whatever the tenant deployed (Ollama here)" },
  ],

  notRouting: [
    { label: "Third-party API directly", reason: "ungoverned egress, never approved" },
    { label: "ARM's control plane", reason: "metadata + audit only — Invariant 1" },
  ],

  folders: {
    projectA: { name: "finance-project", files: ["q1-budget.xlsx", "q2-budget.xlsx", "q3-budget.xlsx", "q4-budget.xlsx", "review-1.pptx", "review-2.pptx", "review-3.pptx"] },
    projectB: { name: "cad-project", files: ["part1.sldprt", "part2.sldprt", "part3.sldprt", "part4.sldprt"] },
    totalFiles: 11,
    tags: ["spreadsheet_heavy", "cad_heavy", "presentation_heavy"],
  },

  classification: {
    tag: "budget_approval_pain",
    jobFunctionHint: "senior_manager",
  },
};
