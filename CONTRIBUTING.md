# Contributing to ARM

Thanks for your interest. This document covers what you need to be
productive quickly, and the few rules this codebase genuinely enforces.

## Getting set up

```bash
corepack enable pnpm
pnpm install
pnpm build
pnpm test
```

Requires Node ≥ 22.16 and pnpm 11.17 (supplied by corepack). No database,
Docker, or API key is needed — every router defaults to
`ARM_FIXTURE_MODE=1` (in-memory fixtures). See [`.env.example`](.env.example)
for what you _can_ configure, none of which is required.

## The one thing that will surprise you: guardrails

This repo enforces its architectural invariants as **executable checks**,
not prose. Run them:

```bash
pnpm guardrails
```

There are 20. They exist because the invariants they protect are the
product — for example, that prompt bodies never leave the tenant VPC, that
the questionnaire's recommendation stays deterministic and auditable, and
that a component's blob is content-addressed. If a guardrail fails, the
fix is almost never "adjust the guardrail" — read the check's own
description (it names the spec section it enforces) and fix the code.

Each security-critical guardrail also has a **mutation proof**: a test that
deliberately breaks the protected behaviour and asserts the check goes red.
A guard that cannot fail is worse than no guard. If you add a guardrail,
add its mutation proof too (`packages/guardrails/test/mutation-proofs.test.ts`).

## Before you open a PR

```bash
pnpm typecheck && pnpm test && pnpm guardrails && pnpm format:check
```

CI runs the same four (`.github/workflows/`). All must pass.

## Conventions that matter here

- **Never fabricate.** No invented benchmark numbers, no placeholder
  credentials that look real, no hardcoded integrity hashes. If a value
  must be verified, fetch it from the authority at runtime (see
  `packages/client-core/src/runtime-provision.ts` for the pattern) or
  state plainly that it is unverified.
- **Fixture mode and real mode must tell the same story.** When you wire a
  router to a real database, seed that database from the same fixtures the
  in-memory path already uses, so switching modes doesn't change what a
  reviewer sees.
- **Match the surrounding code.** Comment density, naming, and structure
  are consistent within each package; follow the file you're editing.
- **Document what you did _not_ do.** Solution docs in `docs/solutions/`
  carry an explicit "known limitations, not fixed here" section. Keep that
  habit — an honest gap is useful, a silent one is a trap.

## Where things live

| Path                     | What it is                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/proto`         | Shared wire contracts (zod schemas). Changes here ripple everywhere.                          |
| `packages/client-core`   | The client engine — one engine, every shape (CLI, GUI installer, future platform installers). |
| `packages/trpc`          | Control-plane routers. Each gates fixture vs. real mode with `isFixtureMode()`.               |
| `packages/profiles`      | Industry presets. Pure data — profiles set _defaults_, never gate capabilities.               |
| `apps/control-plane/web` | The manager-facing dashboard.                                                                 |
| `apps/onboarding`        | The employee-facing questionnaire → download flow.                                            |
| `apps/data-plane/proxy`  | The metered LLM gateway agents actually call.                                                 |
| `docs/arm-spec.md`       | The specification. §11 lists the cross-cutting invariants.                                    |
| `docs/solutions/`        | Dated design records — read these before changing a subsystem.                                |

## Reporting security issues

Please don't open a public issue for a vulnerability. See
[SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Conduct reports go through the same private channel as security reports, so
you never have to raise one in public.

## License

By contributing, you agree that your contributions will be licensed under
the [Apache License 2.0](LICENSE).
