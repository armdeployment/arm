---
title: "ARM implementation guides — sub-agent execution model"
date: 2026-08-21
status: proposed
supersedes: none
---

# ARM Implementation Guides

Five guides. One lands first and freezes the contracts; the other four are then
implemented **in parallel** by independent sub-agents that never write to the
same file.

| #   | Guide                                                             | Owner agent | Wave                        |
| --- | ----------------------------------------------------------------- | ----------- | --------------------------- |
| 00  | [Shared contracts](00-shared-contracts.md)                        | `contracts` | **0 — must complete first** |
| 01  | [Library / Artifactory](01-library-artifactory.md)                | `library`   | 1                           |
| 02  | [Server side — management panels](02-server-panels.md)            | `server`    | 1                           |
| 03  | [Client side — questionnaire downloader](03-client-downloader.md) | `client`    | 1                           |
| 04  | [Public site + live demo](04-public-site-demo.md)                 | `site`      | 1                           |

Background: `docs/solutions/2026-08-21-d10-adoption-first-restructure.md`.

---

## Locked assumptions

These were decided on 2026-08-21. **No sub-agent may change them.** If a guide's
instructions appear to conflict with one, stop and report — do not improvise.

| #   | Assumption                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Value prop order**: agent adoption at scale (primary) → cost saving (secondary) → on-prem LLM (nice-to-have). Every metric, panel, and headline reflects that order.                                                         |
| A2  | **The library is a real artifactory**: immutable, content-addressed, versioned artifact storage with signed manifests and a pluggable blob backend — not a metadata-only registry.                                             |
| A3  | **`tool` generalizes to `component`.** One registry entity with a `kind` discriminator. No parallel `skill`/`plugin` tables. No production data exists (fixtures only), so this is a clean cutover with no back-compat reader. |
| A4  | **"Custom downloader" = one signed generic client + a per-user signed setup token.** Never a per-user compiled binary.                                                                                                         |
| A5  | **Questionnaire free-text never reaches the control plane.** Only structured answers and derived keys are transmitted or stored (Invariant 1).                                                                                 |
| A6  | **Questionnaire recommendations auto-approve** for packages flagged `approval_required = false`; everything else routes to an approver.                                                                                        |
| A7  | **No Desktop GUI in this scope.** Web questionnaire + signed platform installers wrapping the CLI.                                                                                                                             |
| A8  | The eight §11 invariants are unchanged. Nothing in this work weakens one.                                                                                                                                                      |

---

## Rules every sub-agent follows

1. **Read `AGENTS.md` first.** Its working agreements bind: Spec Travel Rule,
   mutation proofs for every security guardrail, no secrets, **never merge a PR**.
2. **Stay inside your file-ownership list** (below). If you need something another
   module owns, it is already defined in guide 00 — import the contract, and stub
   the runtime behind a local interface you own. Never edit another module's files,
   not even "just an import".
3. **Contracts in guide 00 are frozen.** If one is wrong, stop and report it. Do
   not patch `packages/proto` or `packages/db` from a Wave-1 agent.
4. **`pnpm typecheck && pnpm test && pnpm guardrails` green before you report done.**
   A guard that scans zero files is red, not green.
5. **Branch per module**: `feat/<module>-<slice>`. Conventional commits. Open a PR,
   report the ready state, stop.
6. **Docs travel with code**: every guide lists the doc sections you must update in
   the same PR series.
7. **No fabricated data anywhere** — no invented customers, logos, testimonials, or
   metrics. Fixtures are labelled as fixtures.

---

## File ownership (conflict prevention)

Exclusive write access. Anything not listed is read-only to every Wave-1 agent.

| Path                                                                                                                                                                                                                                                        | Owner                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `packages/proto/**`, `packages/db/src/schema/**`, `packages/clickhouse/**`, `scripts/guardrails/src/checks/{boundaries,ci-sync}.ts`                                                                                                                         | `contracts` (Wave 0 only) |
| `packages/artifactory/**`, `packages/discovery/**`, `packages/catalog/**`, `packages/profiles/**`, `packages/trpc/src/library-router.ts`, `apps/data-plane/artifact-cache/**`, guardrails `component-review.ts` `artifact-integrity.ts` `blob-residency.ts` | `library`                 |
| `apps/control-plane/web/**`, `apps/control-plane/workers/**`, `packages/trpc/src/adoption-router.ts`, `packages/trpc/src/index.ts` (router registration block only)                                                                                         | `server`                  |
| `packages/questionnaire/**`, `packages/client-core/**`, `apps/cli/**`, `apps/onboarding/**`, `packaging/**`, `packages/trpc/src/onboarding-router.ts`, guardrails `questionnaire-determinism.ts` `no-content-in-activation.ts`                              | `client`                  |
| `apps/public/**`, `docs/figures/**`                                                                                                                                                                                                                         | `site`                    |

`packages/trpc/src/index.ts` is touched by two agents. To avoid a conflict, guide
00 lands **all four router registrations up front** wired to placeholder routers
that each Wave-1 agent then replaces in its own file. No Wave-1 agent edits
`index.ts` except `server`, and only inside the marked registration block.

---

## Launching the sub-agents

Wave 0, alone:

> Read `docs/guides/00-shared-contracts.md` and implement it exactly. You own
> `packages/proto`, `packages/db/src/schema`, `packages/clickhouse`, and the
> boundaries guardrail. Do not implement any module logic — contracts, migrations,
> enums, placeholder routers, and guardrail stubs only. Stop when
> `pnpm typecheck && pnpm test && pnpm guardrails` are green.

Wave 1, four agents concurrently, each:

> Read `AGENTS.md`, then `docs/guides/README.md`, then
> `docs/guides/<NN>-<module>.md`. Implement that guide and nothing else. The
> contracts in guide 00 are already landed and frozen — import them, never edit
> them. Stay strictly inside your file-ownership list. Report the PR ready state;
> do not merge.

---

## Integration gate (after Wave 1)

- `pnpm typecheck && pnpm test && pnpm guardrails && pnpm e2e` green on the merged branch.
- End-to-end smoke: questionnaire → setup token → CLI install → first metered call
  → activation events visible on `/adoption` → the package's components resolve
  from the artifactory with verified digests.
- Every new guardrail mutation-proofed (break it, watch it go red, restore
  byte-identically).
