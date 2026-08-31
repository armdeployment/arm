// ── VIDEO 4: A Senior Manager's First Install ───────────────────────────
// Every screenshot and every terminal line here is real: a live run through
// apps/onboarding (localhost:3300) answering as a senior manager, a real
// activation code, a real `arm setup --token` redemption, and a real
// `arm refine` run — nothing fabricated or mocked.

export const V4 = {
  setupCommand: "arm setup --token G7NHCF --tenant-url http://localhost:3300",
  setupTerminal: [
    { text: "ARM Setup Complete — Proxy Offline", dir: "ok" as const },
    { text: "Role:       senior_manager", dir: "ok" as const },
    { text: "Package:    senior_manager@1.0.0", dir: "ok" as const },
    { text: "Budget:     $300/month", dir: "ok" as const },
    {
      text: "Components: jira, historian-pi, kpi-briefing-generator,",
      dir: "ok" as const,
    },
    {
      text: "            exec-digest, approval-summaries, kpi-analyst,",
      dir: "ok" as const,
    },
    { text: "            tpl_kpi_brief, tpl_exec_digest", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    { text: "Connections needed:", dir: "ok" as const },
    { text: "  jira (oauth) — read:issue, write:comment", dir: "ok" as const },
    { text: "  historian-pi (pat) — read:tags", dir: "ok" as const },
  ],

  refineCommand: 'arm refine --folder ~/Documents/work --pain-points "..."',
  refineTerminal: [
    {
      text: "ARM Refine — nothing above this summary left your machine",
      dir: "ok" as const,
    },
    { text: "", dir: "ok" as const },
    { text: "Pain-point signals detected:", dir: "ok" as const },
    { text: "budget_approval_pain → senior_manager", dir: "in" as const },
    { text: "(matched: approval, budget, spend)", dir: "ok" as const },
    { text: "", dir: "ok" as const },
    {
      text: "Work-folder scan: 12 files (extensions only)",
      dir: "ok" as const,
    },
    {
      text: "Tags: document_heavy, spreadsheet_heavy, presentation_heavy",
      dir: "ok" as const,
    },
    { text: "", dir: "ok" as const },
    { text: "Installed tools detected:", dir: "ok" as const },
    { text: "Visual Studio Code, Docker Desktop, Slack", dir: "ok" as const },
  ],

  scoring: [
    { label: "Leading a plant or department", weight: 3 },
    { label: "Review team budget/approvals", weight: 1 },
    { label: "SharePoint", weight: 0 },
  ],
};
