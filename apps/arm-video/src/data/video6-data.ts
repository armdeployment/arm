// ── VIDEO 6: End-to-End Installation, Start to Finish ───────────────────
// One continuous real session, captured in a single run: the questionnaire,
// the recommendation, the no-terminal GUI wizard, a real LLM chat exchange,
// and a real multi-folder scan. Same activation code, same senior_manager
// persona, same real data throughout — nothing recombined from separate runs.

export const V6 = {
  code: "6F4XHZ",

  steps: [
    { label: "Questionnaire", detail: "6 questions, deterministic" },
    { label: "Recommendation", detail: "senior_manager, real code" },
    { label: "GUI install", detail: "zero terminal commands" },
    { label: "Connect tools", detail: "guided, real steps" },
    { label: "Chat", detail: "real LLM, tenant's own proxy" },
    { label: "Multi-folder", detail: "2 real projects scanned" },
  ],

  install: {
    role: "senior_manager",
    packageVersion: "senior_manager@1.0.0",
    budget: "$300/month",
    components: [
      "jira",
      "historian-pi",
      "Approval Summaries",
      "Exec Digest",
      "Kpi Analyst",
      "Kpi Briefing Generator",
      "Tpl Exec Digest",
      "Tpl Kpi Brief",
    ],
  },

  chat: {
    user: "I run a manufacturing plant and my team keeps waiting on me for budget approvals before they can order parts",
    classification: {
      tag: "budget_approval_pain",
      jobFunctionHint: "senior_manager",
    },
  },

  folders: {
    totalFiles: 11,
    tags: ["spreadsheet_heavy", "cad_heavy", "presentation_heavy"],
  },

  recap: [
    { label: "0", unit: "terminal commands typed" },
    { label: "2", unit: "real projects scanned" },
    { label: "1", unit: "real LLM conversation" },
    { label: "8", unit: "real components installed" },
  ],
};
