/**
 * Answers → ranked job functions (docs/guides/03-client-downloader.md §2.1).
 *
 * PURE. No `fetch`, no `Date.now`, no `Math.random`, no `crypto.randomUUID`,
 * no LLM call, no I/O — enforced by the `questionnaire-determinism`
 * guardrail. Same answers + same graph ⇒ byte-identical output, forever.
 * This is what makes a recommendation auditable when a manager asks why an
 * employee got a package (guide 03 §2.1).
 *
 * Scoring: each chosen option carries `signals.job_functions[]` with a
 * `weight`. Accumulate weights per job function across every answered
 * question; rank descending by weight; tie-break by job-function key
 * ascending. Accumulation is order-independent (plain summation), so
 * shuffling the answer key order never changes the result — proved by the
 * property test in test/score.test.ts.
 */

import type { QuestionnaireAnswer, QuestionnaireGraph } from "@arm/proto";

export interface RankedJobFunction {
  key: string;
  weight: number;
}

/** The set of option values "selected" by a given answer value. */
function selectedValues(answer: QuestionnaireAnswer[string]): string[] {
  if (Array.isArray(answer)) return answer;
  return [String(answer)];
}

/**
 * Score a completed (or partial) set of structured answers against a
 * questionnaire graph, producing job functions ranked by accumulated
 * weight, descending, tie-broken by key ascending.
 */
export function score(answers: QuestionnaireAnswer, graph: QuestionnaireGraph): RankedJobFunction[] {
  const totals = new Map<string, number>();
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const [nodeId, rawAnswer] of Object.entries(answers)) {
    const node = nodesById.get(nodeId);
    if (!node) continue; // unknown node id — ignore rather than throw (forward/back compat)

    const values = selectedValues(rawAnswer);
    for (const value of values) {
      const option = node.options.find((o) => o.value === value);
      if (!option) continue;
      for (const jobFunctionKey of option.signals.job_functions) {
        totals.set(jobFunctionKey, (totals.get(jobFunctionKey) ?? 0) + option.signals.weight);
      }
    }
  }

  return [...totals.entries()]
    .map(([key, weight]) => ({ key, weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
}

/** The single top-ranked job function, or null if nothing scored. */
export function topJobFunction(answers: QuestionnaireAnswer, graph: QuestionnaireGraph): string | null {
  const ranked = score(answers, graph);
  return ranked[0]?.key ?? null;
}
