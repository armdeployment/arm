/**
 * Tech-industry questionnaire graph v1 (docs/guides/03-client-downloader.md
 * §2.2). Six questions, all multiple choice — no free text (A5). Job
 * function keys are tech-profile specific and independent of the
 * manufacturing graph's taxonomy.
 */

import { questionnaireGraphSchema, type QuestionnaireGraph } from "@arm/proto";

const raw = {
  version: 1,
  industry_profile: "tech",
  entry: "role_cluster",
  nodes: [
    {
      id: "role_cluster",
      kind: "single",
      prompt: "Which best describes your day?",
      help: "Pick the one that matches most of your time.",
      options: [
        {
          value: "software_engineer",
          label: "Writing or reviewing code",
          signals: { job_functions: ["software_engineer"], components: [], weight: 3 },
        },
        {
          value: "support_engineer",
          label: "Triaging tickets, debugging customer issues",
          signals: { job_functions: ["support_engineer"], components: [], weight: 3 },
        },
        {
          value: "product_manager",
          label: "Prioritizing roadmap, writing specs",
          signals: { job_functions: ["product_manager"], components: [], weight: 3 },
        },
        {
          value: "sales_engineer",
          label: "Demoing product, technical pre-sales",
          signals: { job_functions: ["sales_engineer"], components: [], weight: 3 },
        },
        {
          value: "office",
          label: "General office work — documents, email, scheduling",
          signals: { job_functions: ["office_worker_general"], components: [], weight: 3 },
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
          value: "write_code",
          label: "Write or review pull requests",
          signals: { job_functions: ["software_engineer"], components: [], weight: 1 },
        },
        {
          value: "triage_incidents",
          label: "Triage production incidents",
          signals: { job_functions: ["software_engineer"], components: [], weight: 1 },
        },
        {
          value: "answer_tickets",
          label: "Answer support tickets",
          signals: { job_functions: ["support_engineer"], components: [], weight: 1 },
        },
        {
          value: "write_specs",
          label: "Write product specs / PRDs",
          signals: { job_functions: ["product_manager"], components: [], weight: 1 },
        },
        {
          value: "run_demos",
          label: "Run customer demos",
          signals: { job_functions: ["sales_engineer"], components: [], weight: 1 },
        },
        {
          value: "draft_emails_schedule_meetings",
          label: "Draft emails and schedule meetings",
          signals: { job_functions: ["office_worker_general"], components: [], weight: 1 },
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
          value: "github",
          label: "GitHub",
          signals: { job_functions: ["software_engineer"], components: ["github"], weight: 1 },
        },
        {
          value: "jira",
          label: "Jira",
          signals: { job_functions: ["product_manager"], components: ["jira"], weight: 1 },
        },
        {
          value: "zendesk",
          label: "Zendesk",
          signals: { job_functions: ["support_engineer"], components: ["zendesk"], weight: 1 },
        },
        {
          value: "salesforce",
          label: "Salesforce",
          signals: { job_functions: ["sales_engineer"], components: ["salesforce"], weight: 1 },
        },
      ],
      next: [{ when: null, goto: "code_review" }],
    },
    {
      id: "code_review",
      kind: "single",
      prompt: "Do you write or review code?",
      help: "",
      options: [
        {
          value: "yes",
          label: "Yes",
          signals: { job_functions: ["software_engineer"], components: [], weight: 2 },
        },
        { value: "no", label: "No", signals: { job_functions: [], components: [], weight: 1 } },
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

export const techV1: QuestionnaireGraph = questionnaireGraphSchema.parse(raw);
