import type { FaqItem } from "./types";

export const faqHero = {
  title: "Frequently asked questions",
  body: "Answered plainly, including the ones with an unfinished answer. See /product for what's built versus planned.",
};

export const faqItems: FaqItem[] = [
  {
    question: "Is this a gateway or a policy engine?",
    answer:
      "Neither, on its own — ARM includes both underneath, but the product is the layer above them: getting a governed, metered agent into the hands of someone who has never configured one, and showing management where that's stalling. See /product for the category argument.",
  },
  {
    question: "Do you see our prompts?",
    answer:
      "No. Prompt bodies and resource content never leave your VPC — the control plane (wherever it runs) receives metadata only: token counts, cost, timestamps, and audit decisions. This is Invariant 1, enforced by an executable guardrail (no-content-egress), not a policy promise. See /security.",
  },
  {
    question: "Can we self-host the whole thing?",
    answer:
      "Yes. The data plane always runs in your VPC in both delivery models. In the self-hosted enterprise tier, the control plane runs there too, and your own model-provider keys never leave your environment. See the deployment table on /security.",
  },
  {
    question: "Can we use our own models instead of Anthropic or OpenAI?",
    answer:
      "Yes, including self-hosted open models through the open-gateway. This is supported in both delivery models. It's a checkbox in the deployment story, not the headline — see A1 in this project's own working notes if you want the reasoning: adoption comes first, cost savings second, on-prem is a nice-to-have most buyers ask about third.",
  },
  {
    question: "What happens if an employee's role doesn't match any package?",
    answer:
      "The questionnaire has a structured \"none of these fit\" terminal answer — never free text — which surfaces as a labelled gap in the library's coverage report. That gap is a roadmap item, not a dead end for the employee, who still gets routed to the closest available option.",
  },
  {
    question: "What's actually built today versus planned?",
    answer:
      "The full evidence table is docs/implementation-audit.md in this repo, and a summary is on /product. Short version: monorepo, schema, guardrails, and dashboards on fixture data are built; the data-plane proxy that meters live traffic, cloud resource connectors, and the one-click provisioning flow are in progress or planned.",
  },
  {
    question: "How is this different from an LLM gateway like LiteLLM or Portkey?",
    answer:
      "Those meter and route calls that already exist. ARM is the layer before that: turning someone who has never opened a terminal into a person with a working, governed agent, then showing management the adoption funnel — not just the bill. See the comparison table on /product.",
  },
  {
    question: "Is any of the data on this site from a real customer?",
    answer:
      "No — there are no production customers yet, so there's nothing to show. Every number on this site is either from a small committed simulation run in this repo (apps/simulation) or a clearly labelled fixture dataset used in the dashboard's demo mode. Neither is a live deployment.",
  },
];
