/**
 * Graph well-formedness (docs/guides/03-client-downloader.md §2): every node
 * reachable from `entry`, no cycles, at least one terminal exists. PURE —
 * same rules as score.ts/recommend.ts. Run this over every shipped graph
 * (test/graphs.test.ts) and over any tenant-authored graph before it is
 * published (`questionnaire_definition.status: "published"`).
 */

import type { QuestionnaireGraph } from "@arm/proto";

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

/** A node is terminal if it has no outgoing edges, or every edge ends the
 *  flow (`goto: null`). */
function isTerminal(node: QuestionnaireGraph["nodes"][number]): boolean {
  return node.next.length === 0 || node.next.every((edge) => edge.goto === null);
}

export function validateGraph(graph: QuestionnaireGraph): ValidateResult {
  const errors: string[] = [];
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  if (!nodesById.has(graph.entry)) {
    errors.push(`entry node "${graph.entry}" does not exist in nodes[]`);
    return { valid: false, errors };
  }

  // Duplicate node ids.
  if (nodesById.size !== graph.nodes.length) {
    errors.push("duplicate node ids in nodes[]");
  }

  // Dangling goto references.
  for (const node of graph.nodes) {
    for (const edge of node.next) {
      if (edge.goto !== null && !nodesById.has(edge.goto)) {
        errors.push(`node "${node.id}" has a next.goto referencing unknown node "${edge.goto}"`);
      }
    }
  }

  // Reachability from entry (BFS over every edge — conditional and default).
  const reachable = new Set<string>();
  const queue: string[] = [graph.entry];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = nodesById.get(id);
    if (!node) continue;
    for (const edge of node.next) {
      if (edge.goto !== null && nodesById.has(edge.goto) && !reachable.has(edge.goto)) {
        queue.push(edge.goto);
      }
    }
  }
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      errors.push(`node "${node.id}" is unreachable from entry "${graph.entry}"`);
    }
  }

  // Cycle detection (DFS with a recursion-stack / done set), scoped to reachable nodes.
  const stateOf = new Map<string, "visiting" | "done">();
  function dfs(id: string): boolean {
    const node = nodesById.get(id);
    if (!node) return false;
    stateOf.set(id, "visiting");
    for (const edge of node.next) {
      if (edge.goto === null) continue;
      const state = stateOf.get(edge.goto);
      if (state === "visiting") {
        errors.push(`cycle detected: "${id}" -> "${edge.goto}"`);
        return true;
      }
      if (state === undefined && dfs(edge.goto)) {
        return true;
      }
    }
    stateOf.set(id, "done");
    return false;
  }
  dfs(graph.entry);

  // At least one terminal node must exist among reachable nodes.
  const hasTerminal = graph.nodes.some((n) => reachable.has(n.id) && isTerminal(n));
  if (!hasTerminal) {
    errors.push("no terminal node reachable from entry (every path must eventually end)");
  }

  return { valid: errors.length === 0, errors };
}
