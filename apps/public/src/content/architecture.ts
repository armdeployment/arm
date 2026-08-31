import type { BoundaryRow, DiagramLabels } from "./types";

export const architectureHero = {
  title: "How it works",
  body: "Three diagrams, each derived directly from docs/arm-spec.md so they can't drift into a fiction independent of the code. The most important one is the second: what crosses the boundary between a customer's network and ARM's, and what never does.",
};

export const employeePathDiagram: DiagramLabels = {
  title: "The employee path: questionnaire to configured, metered agent",
  desc: "Four stages an employee moves through, and the artifact that carries state between each: a structured questionnaire response, a signed setup token, a downloaded client, and a configured agent making metered calls.",
  nodes: [
    {
      id: "questionnaire",
      label: "Questionnaire",
      sublabel: "6–9 multiple-choice questions, no free text",
    },
    { id: "token", label: "Signed setup token", sublabel: "15-min TTL, single-use, hash-stored" },
    { id: "download", label: "Signed client", sublabel: "One generic binary, all platforms" },
    {
      id: "agent",
      label: "Configured, metered agent",
      sublabel: "Package installed, budget attached, stakeholder set",
    },
  ],
  edges: [
    { from: "questionnaire", to: "token", label: "structured answers → recommended package" },
    { from: "token", to: "download", label: "activation code or .armsetup file" },
    { from: "download", to: "agent", label: "redeem token → install → verify" },
  ],
};

export const trustBoundaryDiagram: DiagramLabels = {
  title: "Control plane / data plane split",
  desc: "The data plane runs inside the customer's VPC and handles every prompt, every resource byte, and every call to a model provider. Only metadata crosses into the control plane; only aggregates leave it toward a dashboard viewer. Derived from arm-spec.md §3.1 and §3.3.",
  nodes: [
    {
      id: "agent",
      label: "Local agent",
      sublabel: "opencode / claude code / copilot / Pi, on the employee's machine",
    },
    {
      id: "proxy",
      label: "Data plane",
      sublabel:
        "Closed-proxy, open-gateway, resource connectors — inside the tenant VPC. Calls Anthropic/OpenAI or a self-hosted GPU pool from here.",
    },
    {
      id: "control",
      label: "Control plane",
      sublabel: "SaaS by default, or self-hosted single-tenant — policy, billing, audit",
    },
    {
      id: "dashboard",
      label: "Dashboard viewer",
      sublabel: "A human looking at spend, adoption, and audit",
    },
  ],
  edges: [
    { from: "agent", to: "proxy", label: "prompts + responses + resource IO" },
    {
      from: "proxy",
      to: "control",
      label: "metadata only — tokens, $, audit decisions (never prompt bodies)",
    },
    { from: "control", to: "dashboard", label: "aggregates, per-agent / per-team rollups only" },
  ],
};

/** Index into trustBoundaryDiagram.edges of the edge that crosses the trust boundary itself. */
export const trustBoundaryCrossingEdgeIndex = 1;

export const artifactoryDiagram: DiagramLabels = {
  title: "The artifactory: component to installed agent",
  desc: "Every artifact an agent can be given moves through the same four states: identity, an immutable versioned manifest, content-addressed bytes, and — via a work package — an installed, verified component on someone's machine.",
  nodes: [
    { id: "component", label: "Component", sublabel: "identity, kind, owner, review status" },
    {
      id: "version",
      label: "Component version",
      sublabel: "immutable manifest + optional blob digest",
    },
    {
      id: "blob",
      label: "Content-addressed blob",
      sublabel: "sha256:<hex> — verified on every read",
    },
    {
      id: "package",
      label: "Work package",
      sublabel: "pinned versions + routing + budget + permissions",
    },
    { id: "installed", label: "Installed on agent", sublabel: "digest re-verified before use" },
  ],
  edges: [
    { from: "component", to: "version", label: "publish (review_status = approved required)" },
    { from: "version", to: "blob", label: "digest, sha256-verified" },
    { from: "version", to: "package", label: "pinned by version, not by tag" },
    { from: "package", to: "installed", label: "resolve → pull → verify digest" },
  ],
};

export const boundaryTable: BoundaryRow[] = [
  {
    boundary: "Agent → data plane",
    crosses: "Wire-protocol LLM calls; resource access calls with scoped tokens",
    neverCrosses: "—",
  },
  {
    boundary: "Data plane → providers",
    crosses:
      "LLM requests (closed models) or GPU inference (open models); resource IO with minted credentials",
    neverCrosses: "—",
  },
  {
    boundary: "Data plane → control plane",
    crosses: "Metadata-only events: tokens, cost, audit decisions, agent id, timestamp",
    neverCrosses: "Prompt bodies, resource content, raw credentials",
  },
  {
    boundary: "Control plane → data plane",
    crosses: "Delegate keys (rotating, short-lived), policy cache",
    neverCrosses: "Resource content, prompts",
  },
  {
    boundary: "Control plane → dashboard viewer",
    crosses: "Aggregates, per-agent and per-team rollups",
    neverCrosses: "Prompts, content, secrets",
  },
];

export const boundarySourceNote = "Table reproduced from docs/arm-spec.md §3.3.";
