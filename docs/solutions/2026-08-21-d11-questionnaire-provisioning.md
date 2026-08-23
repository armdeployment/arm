---
title: "D11: Questionnaire-driven provisioning — the client asks zero questions"
date: 2026-08-21
status: decided
supersedes: none
---

# D11: Questionnaire-Driven Provisioning

## Decision

The employee-facing onboarding flow moves from "run a CLI with a role key"
to **a web questionnaire that resolves a job function and issues a signed
setup token**, redeemed exactly once by one signed generic client binary.
This is `docs/guides/03-client-downloader.md`, implemented by the `client`
Wave-1 agent against the frozen contracts in `docs/guides/00-shared-contracts.md`.

### The architectural call this does not re-litigate (A4)

"Custom downloader" means **one signed generic client binary + a per-user
signed setup token**. It does not mean a per-user compiled binary — that
breaks code signing and notarization (fatal to the "very easy" adoption
promise, A1) and defeats CDN caching. The customization lives entirely in
the token, issued at the end of the questionnaire, traveling either inside
a downloaded `.armsetup` companion file (`{version, token,
control_plane_url}`) or as a 6-character activation code.

This resolves the apparent conflict with the original roadmap principle
("the client asks exactly two questions", `docs/solutions/
2026-08-13-work-package-roadmap.md` §3.1): **the questionnaire moved to the
web, before the download. The client still asks zero questions** — it
either has a `.armsetup` file, an activation code, or (advanced/CI path)
explicit `--role`/`--tenant-url` flags. `arm setup` with no arguments at all
prompts once for an activation code; it never asks about roles, tools, or
configuration.

### Why a questionnaire, not a role picker

D9's original flow assumed the employee already knows their role key.
D6/D7's Industry Profile + job-taxonomy research showed most employees
don't self-identify with a governance-shaped role label — they describe
their day in tasks and systems. The questionnaire (`packages/questionnaire`)
scores **job functions** from structured multiple-choice answers, then
`recommend()` maps the top job function to eligible packages. This is the
same auditability bar as D7's work-type classifier: **pure, deterministic,
reproducible** — `score()`/`recommend()` take no `Date.now`/`Math.random`/
`fetch`/`crypto.randomUUID`, so a manager asking "why did this employee get
this package" gets a reproducible answer from the stored structured
answers, not "the model said so."

### No free text, anywhere (A5, Invariant 1)

`questionNodeSchema.kind` has no `"text"` option — by construction, not by
convention. Every question is single/multi/scale. This is deliberate: free
text is content, and Invariant 1 (prompt/content never leaves the tenant
VPC and never lands in control-plane storage) applies just as much to "tell
us about your job" as it does to an agent's prompt. When a role genuinely
doesn't fit any standard bucket, the terminal "none of these fit" path
records a **structured unmatched marker** — no prose — which surfaces as a
`library.gaps` coverage signal for the roadmap, not as stored free text.
Enforced twice: the schema itself (no `text` kind), and the
`no-content-in-activation` guardrail (extends `no-content-egress` to scan
`questionNodeSchema.kind` and `activationEventSchema`'s field names).

### Setup tokens (A4, Invariant 4)

A setup token is a signed JWT (`setupTokenClaimsSchema`) with a 15-minute
TTL, single-use, carrying `package_version_ids`, a `connections_digest`,
and routing URLs — never a credential, secret, or free text (a contract
test asserts no field name matches `secret|token|password|key|answer|text`).
The server stores only `sha256(token)`, matching Invariant 4's "short-lived
credentials everywhere credentials are minted" — the same discipline
already applied to agent proxy tokens now extends to anything that
authorizes install/activation. A second redemption attempt returns a
distinct, plain-language `already_used` error; redemption is rate-limited
per tenant to blunt code/token brute-forcing.

### Auto-approve is a package flag, not a client decision (A6)

`work_package.approval_required` (default `true`) decides the outcome of
redemption: `false` → the `package_assignment` is created `approved`
immediately; `true` → `requested`, and the client is told
`pending_approval: true`. **The install never blocks on approval** — the
employee gets a working, governed agent immediately; tool access for
approval-gated packages waits on the manager's sign-off, surfaced plainly
("your agent is installed; tool access is waiting on your manager").

### Manifest v2 and component installation

The client resolves each package's `components[]` (manifest v2, guide 00
§4) and installs by kind: callable components (`mcp`/`http_api`/`cli`/
`connector`) become opencode MCP entries; installable components (`skill`/
`subagent`/`template`/`prompt_pack`/`plugin`) are pulled from the
data-plane artifact cache by digest and verified — **a digest mismatch is a
hard failure**, matching D9's original "unverified bytes never render into
config" discipline, now extended from the whole-manifest hash to
per-component blob integrity.

### No Desktop GUI (A7)

The roadmap's original Desktop wizard is out of scope for this phase — the
web questionnaire plus signed platform installers (`packaging/`) cover the
same "no terminal" bar for a non-technical employee. `arm doctor` and the
CLI's plain-language failure taxonomy substitute for a GUI's error dialogs.

## Consequences

- `packages/questionnaire` is a new, deliberately dependency-light package
  (`proto`/`config` only) — this is what makes `questionnaire-determinism`
  checkable at all; any future addition to that package that reaches for
  `fetch`/`Date.now`/`Math.random`/`crypto.randomUUID` breaks the guard on
  purpose.
- `packages/client-core`'s manifest/canonicalization logic moved from the
  D9 nine-field v1 shape to the D10 eight-field v2 shape (guide 00 §4) — a
  deliberate wire break, not a compatibility extension. No v1 reader exists;
  there is no production data.
- `apps/onboarding` is a separate Next.js app (port 3300) from `apps/public`
  (guide 04) — different trust level (talks to the control-plane tRPC API,
  including the public setup-token redemption endpoints) — sharing design
  tokens by importing the same CSS variables, not forking the design system.
- Known cross-agent-timing gap: at the time this lands, `@arm/catalog`'s
  fixtures are still v1-shaped (`library`'s migration, guide 01, hadn't
  landed in this worktree yet) and `@arm/catalog`'s own barrel import of the
  now-deleted `@arm/proto` `toolSchema` export is a genuine runtime crash
  under native Node ESM (not just a `tsc` error) — `onboarding-router.ts`
  works around this by computing manifest v2 hashes itself (via
  `@arm/client-core`'s canonicalizer) rather than depending on
  `@arm/catalog`'s not-yet-migrated one, so the questionnaire → token →
  redemption flow is genuinely functional today; `packages/catalog` itself
  still needs `library`'s fix for its own typecheck/runtime health.

## Related

- `docs/guides/00-shared-contracts.md` — manifest v2, questionnaire graph,
  setup token claims, activation events (frozen contracts this decision
  implements against).
- `docs/guides/03-client-downloader.md` — the full implementation guide.
- `docs/solutions/2026-08-13-work-package-roadmap.md` — superseded primary
  flow (§3.1, §5), reconciled in the same PR series.
- `docs/solutions/2026-08-02-d7-work-type-classification.md` — the
  determinism/auditability bar `packages/questionnaire` follows.
