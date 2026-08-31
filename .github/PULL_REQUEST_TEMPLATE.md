<!--
Thanks for contributing. CONTRIBUTING.md has the full working agreement;
this template is just the short version.
-->

## What this changes

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The problem being solved. Link an issue if there is one. -->

## Checks

Run these before opening — CI runs the same three:

```bash
pnpm typecheck && pnpm test && pnpm guardrails
```

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm guardrails` passes (all 19)

## Invariants

ARM's cross-cutting rules are enforced by executable guardrails rather than
convention. If you touched anything near these, say how it still holds:

- [ ] **Invariant 1 / A5** — no prompt bodies or resource content reach the
      control plane. It stays metadata and audit only.
- [ ] **D6** — industry profiles set _defaults_, never gate capabilities.
      Runtime code must not branch on a profile id.
- [ ] Fixture mode and real-database mode still tell the same story.

<!-- If a guardrail changed, explain why the old one was wrong. A guardrail
     that gets weakened to make a change pass is a red flag; a guardrail that
     gets corrected because it encoded the wrong rule is fine — just say so. -->

## Anything reviewers should know

<!-- Trade-offs, things you left undone deliberately, follow-ups. Saying
     "I skipped X because Y" here saves a review round trip. -->
