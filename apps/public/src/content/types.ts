/**
 * Shared shapes for the typed content modules under src/content/*.
 *
 * Guide 04 §6 requires copy to live in these modules, not scattered through
 * JSX, so it can be edited without touching layout — and so the honesty test
 * (test/content-honesty.test.ts) has one place to scan.
 */

export interface NavLink {
  href: string;
  label: string;
}

export interface Stat {
  /** Short label, e.g. "Cloud-equivalent cost" */
  label: string;
  /** Pre-formatted display value, e.g. "$0.22" */
  value: string;
  /** One-line provenance — required for every stat (rule 7: no unlabeled numbers). */
  source: string;
}

export interface ClickPath {
  title: string;
  description: string;
  steps: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FeatureRow {
  capability: string;
  arm: string;
  gateways: string;
}

export interface DeploymentRow {
  dimension: string;
  saas: string;
  selfHosted: string;
}

export interface PhaseRow {
  phase: string;
  title: string;
  status: "shipped" | "in_progress" | "planned";
  detail: string;
}

export interface InvariantRow {
  n: number;
  statement: string;
  guardrail: string;
}

export interface BoundaryRow {
  boundary: string;
  crosses: string;
  neverCrosses: string;
}

export interface DiagramLabels {
  title: string;
  desc: string;
  nodes: { id: string; label: string; sublabel?: string }[];
  edges: { from: string; to: string; label?: string }[];
}
