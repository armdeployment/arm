/**
 * Questionnaire graph traversal (docs/guides/03-client-downloader.md §2).
 *
 * Pure, dependency-light: `@arm/proto` types only, no I/O. Given a graph and
 * the answers collected so far, `nextQuestion` returns the next unanswered
 * node to show, or `null` when the flow is complete (a terminal was
 * reached). This drives `apps/onboarding`'s "one question per screen" flow.
 */

import type { QuestionNode, QuestionnaireAnswer, QuestionnaireGraph } from "@arm/proto";

/** The value used to match a `next[].when` edge for a given answer. Multi
 *  answers branch on their first selected value (branching on a whole set is
 *  out of scope for this graph shape); single/scale answers stringify. */
function primaryAnswerValue(answer: QuestionnaireAnswer[string]): string {
  if (Array.isArray(answer)) return answer[0] ?? "";
  return String(answer);
}

/** Resolve the outgoing edge for a node given the answer already recorded
 *  for it: prefer an exact `when` match, else the default (`when: null`)
 *  edge, else undefined (dead end — validate.ts should prevent this). */
function resolveEdge(node: QuestionNode, answer: QuestionnaireAnswer[string]) {
  const value = primaryAnswerValue(answer);
  return (
    node.next.find((edge) => edge.when === value) ?? node.next.find((edge) => edge.when === null)
  );
}

/**
 * Walk the graph from `entry` following already-recorded answers. Returns
 * the next node with no recorded answer (the question to show next), or
 * `null` once a terminal edge (`goto: null`) is reached. Guards against a
 * malformed cyclic graph (should never happen — validate.ts rejects cycles
 * before a graph is published) by refusing to revisit a node.
 */
export function nextQuestion(
  graph: QuestionnaireGraph,
  answers: QuestionnaireAnswer,
): QuestionNode | null {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  let current = nodesById.get(graph.entry);
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) return null;
    visited.add(current.id);

    const answer = answers[current.id];
    if (answer === undefined) {
      return current;
    }

    const edge = resolveEdge(current, answer);
    if (!edge || edge.goto === null) {
      return null;
    }
    current = nodesById.get(edge.goto);
  }
  return null;
}

/** True once every node on the answered path has led to a terminal edge. */
export function isComplete(graph: QuestionnaireGraph, answers: QuestionnaireAnswer): boolean {
  return nextQuestion(graph, answers) === null;
}

/** Progress estimate (0–1) for a progress bar: answered nodes on the current
 *  path vs. the longest path length reachable from entry (best-effort —
 *  branches mean this is an estimate, not an exact fraction). */
export function progress(graph: QuestionnaireGraph, answers: QuestionnaireAnswer): number {
  const total = graph.nodes.length;
  if (total === 0) return 1;
  const answered = graph.nodes.filter((n) => answers[n.id] !== undefined).length;
  return Math.min(1, answered / total);
}
