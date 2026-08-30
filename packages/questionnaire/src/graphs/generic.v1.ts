/**
 * Generic (industry-agnostic) questionnaire graph v1
 * (docs/guides/03-client-downloader.md §2.2). The fallback graph for any
 * tenant/industry profile without a dedicated graph. Six questions, all
 * multiple choice — no free text (A5).
 */

import { questionnaireGraphSchema, type QuestionnaireGraph } from "@arm/proto";

const raw = {
  version: 1,
  industry_profile: "generic",
  entry: "role_cluster",
  nodes: [
    {
      id: "role_cluster",
      kind: "single",
      prompt: "Which best describes your day?",
      help: "Pick the one that matches most of your time.",
      options: [
        {
          value: "office",
          label: "General office work — documents, email, scheduling",
          signals: { job_functions: ["office_worker_general"], components: [], weight: 3 },
        },
        {
          value: "exec_support",
          label: "Supporting an executive — briefings, approvals, calendars",
          signals: { job_functions: ["exec_assistant"], components: [], weight: 3 },
        },
        {
          value: "finance",
          label: "Finance / accounting work",
          signals: { job_functions: ["finance_analyst"], components: [], weight: 3 },
        },
        {
          value: "hr",
          label: "HR / people operations",
          signals: { job_functions: ["hr_generalist"], components: [], weight: 3 },
        },
        {
          value: "leading_team",
          label: "Leading a team — budget, approvals, reporting up",
          signals: { job_functions: ["senior_manager"], components: [], weight: 3 },
        },
        {
          value: "none_of_these",
          label: "None of these describe my day",
          signals: { job_functions: [], components: [], weight: 1 },
        },
      ],
      next: [
        { when: "none_of_these", goto: "unmatched" },
        { when: null, goto: "weekly_tasks" },
      ],
    },
    {
      id: "weekly_tasks",
      kind: "multi",
      prompt: "Which of these do you do weekly?",
      help: "Select all that apply.",
      options: [
        {
          value: "draft_emails_schedule_meetings",
          label: "Draft emails and schedule meetings",
          signals: { job_functions: ["office_worker_general"], components: [], weight: 1 },
        },
        {
          value: "prepare_exec_briefings",
          label: "Prepare KPI briefings or approvals-inbox summaries",
          signals: { job_functions: ["exec_assistant"], components: [], weight: 1 },
        },
        {
          value: "reconcile_accounts",
          label: "Reconcile accounts / review invoices",
          signals: { job_functions: ["finance_analyst"], components: [], weight: 1 },
        },
        {
          value: "process_onboarding",
          label: "Process new-hire onboarding paperwork",
          signals: { job_functions: ["hr_generalist"], components: [], weight: 1 },
        },
        {
          value: "review_team_budget_approvals",
          label: "Review team budget, spend, or approval requests",
          signals: { job_functions: ["senior_manager"], components: [], weight: 1 },
        },
      ],
      next: [{ when: null, goto: "systems" }],
    },
    {
      id: "systems",
      kind: "multi",
      prompt: "Which systems do you use?",
      help: "Select all that apply.",
      options: [
        {
          value: "sharepoint",
          label: "SharePoint",
          signals: { job_functions: ["office_worker_general"], components: ["sharepoint"], weight: 1 },
        },
        {
          value: "erp_finance",
          label: "ERP finance module",
          signals: { job_functions: ["finance_analyst"], components: ["erp"], weight: 1 },
        },
        {
          value: "hris",
          label: "HRIS",
          signals: { job_functions: ["hr_generalist"], components: ["hris"], weight: 1 },
        },
      ],
      next: [{ when: null, goto: "work_style" }],
    },
    {
      id: "work_style",
      kind: "single",
      prompt: "How do you prefer to work?",
      help: "This tunes your agent's defaults — it doesn't change which package you get.",
      options: [
        { value: "chat_first", label: "Chat first", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "in_editor", label: "In my editor", signals: { job_functions: [], components: [], weight: 1 } },
        {
          value: "scheduled_reports",
          label: "Scheduled reports",
          signals: { job_functions: [], components: [], weight: 1 },
        },
      ],
      next: [{ when: null, goto: "platform" }],
    },
    {
      id: "platform",
      kind: "single",
      prompt: "Which computer will you install on?",
      help: "This selects the right installer — it is never stored on your response.",
      options: [
        { value: "windows", label: "Windows", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "macos", label: "macOS", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "linux", label: "Linux", signals: { job_functions: [], components: [], weight: 1 } },
      ],
      next: [{ when: null, goto: null }],
    },
    {
      id: "unmatched",
      kind: "single",
      prompt: "Thanks — none of the standard roles fit your day-to-day.",
      help: "We've recorded that as a coverage gap for the library team — no free text is stored, just this structured marker.",
      options: [
        { value: "ack", label: "Continue", signals: { job_functions: [], components: [], weight: 1 } },
      ],
      next: [],
    },
  ],
} satisfies Record<string, unknown>;

export const genericV1: QuestionnaireGraph = questionnaireGraphSchema.parse(raw);
