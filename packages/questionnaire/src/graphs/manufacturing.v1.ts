/**
 * Manufacturing questionnaire graph v1 (docs/guides/03-client-downloader.md
 * §2.2). Seven questions, all multiple choice — no free text (A5). Job
 * function keys match `@arm/catalog`'s fixture `work_package.role_key`
 * values 1:1 (quality_engineer, plc_programmer, maintenance_technician,
 * material_planner, office_worker_general, exec_assistant) so a top-ranked
 * job function maps directly to a package without an extra join table while
 * `library` migrates `work_package_version.job_functions` off its D10
 * placeholder (empty) state.
 *
 * Validated at module load via `questionnaireGraphSchema.parse` — a pure
 * parse, not I/O, so this stays inside the questionnaire-determinism guard.
 */

import { questionnaireGraphSchema, type QuestionnaireGraph } from "@arm/proto";

const raw = {
  version: 1,
  industry_profile: "manufacturing",
  entry: "location",
  nodes: [
    {
      id: "location",
      kind: "single",
      prompt: "Where do you work?",
      help: "Pick the plant or site closest to your primary work location.",
      options: [
        { value: "hq", label: "Headquarters / office", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "plant_a", label: "Plant A", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "plant_b", label: "Plant B", signals: { job_functions: [], components: [], weight: 1 } },
        { value: "other_site", label: "Another site", signals: { job_functions: [], components: [], weight: 1 } },
      ],
      next: [{ when: null, goto: "role_cluster" }],
    },
    {
      id: "role_cluster",
      kind: "single",
      prompt: "Which best describes your day?",
      help: "Pick the one that matches most of your time.",
      options: [
        {
          value: "maintenance",
          label: "Keeping equipment running — repairs, PMs, troubleshooting",
          signals: { job_functions: ["maintenance_technician"], components: [], weight: 3 },
        },
        {
          value: "quality",
          label: "Inspecting parts, tracking defects, quality checks",
          signals: { job_functions: ["quality_engineer"], components: [], weight: 3 },
        },
        {
          value: "plc",
          label: "Programming or configuring machines, PLCs, controls",
          signals: { job_functions: ["plc_programmer"], components: [], weight: 3 },
        },
        {
          value: "planning",
          label: "Planning materials, inventory, or supply chain",
          signals: { job_functions: ["material_planner"], components: [], weight: 3 },
        },
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
          value: "troubleshoot_equipment",
          label: "Troubleshoot equipment faults",
          signals: { job_functions: ["maintenance_technician"], components: [], weight: 1 },
        },
        {
          value: "preventive_maintenance",
          label: "Run preventive-maintenance checklists",
          signals: { job_functions: ["maintenance_technician"], components: [], weight: 1 },
        },
        {
          value: "review_inspection_reports",
          label: "Review inspection reports",
          signals: { job_functions: ["quality_engineer"], components: [], weight: 1 },
        },
        {
          value: "run_spc_charts",
          label: "Run SPC charts / control plans",
          signals: { job_functions: ["quality_engineer"], components: [], weight: 1 },
        },
        {
          value: "write_plc_logic",
          label: "Write or edit ladder/ST logic",
          signals: { job_functions: ["plc_programmer"], components: [], weight: 1 },
        },
        {
          value: "debug_ladder_logic",
          label: "Debug PLC programs on the floor",
          signals: { job_functions: ["plc_programmer"], components: [], weight: 1 },
        },
        {
          value: "track_inventory",
          label: "Track inventory / stock levels",
          signals: { job_functions: ["material_planner"], components: [], weight: 1 },
        },
        {
          value: "review_mrp_exceptions",
          label: "Review MRP exceptions / ECN impacts",
          signals: { job_functions: ["material_planner"], components: [], weight: 1 },
        },
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
          value: "jira",
          label: "Jira",
          signals: { job_functions: ["quality_engineer"], components: ["jira"], weight: 1 },
        },
        {
          value: "sap",
          label: "SAP",
          signals: { job_functions: ["material_planner"], components: ["sap"], weight: 1 },
        },
        {
          value: "cmms",
          label: "CMMS",
          signals: { job_functions: ["maintenance_technician"], components: ["cmms"], weight: 1 },
        },
        {
          value: "sharepoint",
          label: "SharePoint",
          signals: { job_functions: ["office_worker_general"], components: ["sharepoint"], weight: 1 },
        },
        {
          value: "tia_portal",
          label: "TIA Portal",
          signals: { job_functions: ["plc_programmer"], components: ["tia-portal"], weight: 1 },
        },
        {
          value: "studio5000",
          label: "Studio 5000",
          signals: { job_functions: ["plc_programmer"], components: ["studio-5000"], weight: 1 },
        },
      ],
      next: [{ when: null, goto: "code_plc" }],
    },
    {
      id: "code_plc",
      kind: "single",
      prompt: "Do you write or review code / PLC logic?",
      help: "",
      options: [
        {
          value: "yes",
          label: "Yes",
          signals: { job_functions: ["plc_programmer"], components: [], weight: 2 },
        },
        { value: "no", label: "No", signals: { job_functions: [], components: [], weight: 1 } },
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

export const manufacturingV1: QuestionnaireGraph = questionnaireGraphSchema.parse(raw);
