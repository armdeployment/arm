import type { ClickPath } from "./types";

export const demoHero = {
  title: "The real dashboard, on fixture data",
  body: "This isn't a mockup. Clicking through opens the actual ARM control-plane web app, running against the same fixture dataset it ships with today — no database, no external services, and (when the dashboard is deployed in demo mode) no mutation reaches a real write path. A small \"sample data\" badge stays visible on every screen so nobody mistakes fixture numbers for a real customer's.",
};

export const demoStatusNote =
  "The persona switcher and guaranteed-read-only demo mode described in docs/guides/04-public-site-demo.md are configuration owned by the dashboard app itself (docs/guides/02-server-panels.md), not by this site. This page always links out rather than iframing it; if the dashboard isn't deployed with that mode active yet, the click paths below still work against its default fixture mode.";

export const clickPaths: ClickPath[] = [
  {
    title: "As a CEO or department exec",
    description:
      "Start from the org-level home. Look for the adoption funnel and approvals up top — spend is a strip, not the headline.",
    steps: [
      "Land on the role home — adoption + approvals lead, spend is one strip",
      "Open the org tree and drill from Org → Department → Team",
      "Compare a department with high spend against one with high activation — they're not the same department",
    ],
  },
  {
    title: "As a plant manager or team lead",
    description:
      "Scope down to one department and look for where people are stalling, not just what they've spent.",
    steps: [
      "Drill into one department's scope",
      "Open the agent list scoped to that team",
      "Check the JIT access-request queue for anything waiting on this manager",
    ],
  },
  {
    title: "As InfoSec",
    description: "Check what's enforced, not just what's logged.",
    steps: [
      "Open the audit log and the security-flags panel",
      "Check the model-policy panel for classification-gated routing",
      "Confirm every agent row shows a named accountable stakeholder",
    ],
  },
];

export const demoCta = {
  label: "Open the dashboard",
  fallbackUrl: "http://localhost:3100",
  note: "Opens in a new tab — the demo is a separate deployment of the real product, not an iframe embedded in this page.",
};

export const demoDatasetNote =
  "The fixture dataset backing the dashboard's demo deployment is generated from apps/simulation and includes the unflattering parts on purpose: stalled activations, an over-budget department, a denied access request. A demo with no problems in it reads as fake to anyone who has run an enterprise.";
