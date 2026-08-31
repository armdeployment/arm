---
title: "Guide 03 — Client side: questionnaire downloader"
date: 2026-08-21
status: proposed
owner_agent: client
---

# Guide 03 — The Questionnaire Downloader

**Mission.** A non-technical employee opens a link, answers a handful of
multiple-choice questions about their job, downloads one file, runs it, and has a
governed, metered, correctly-configured agent. No role key, no flags, no config
file, no terminal.

**Prerequisite:** guide 00 landed.

**You own:** `packages/questionnaire/**`, `apps/onboarding/**`,
`packages/client-core/**`, `apps/cli/**`, `packaging/**`,
`packages/trpc/src/onboarding-router.ts`, guardrails
`questionnaire-determinism.ts` and `no-content-in-activation.ts`.

---

## 1. The architectural call you must not re-litigate (A4)

"Custom downloader" means **one signed generic client binary + a per-user signed
setup token**. It does not mean a per-user compiled binary — that breaks code
signing and notarization, which the roadmap already identifies as fatal to the
"very easy" promise, and it defeats CDN caching.

The customization lives in the token, which is issued at the end of the
questionnaire and travels either inside a downloaded `.armsetup` companion file or
as a 6-character activation code.

This also resolves the apparent conflict with the roadmap's "the client asks exactly
two questions" principle: **the questionnaire moved to the web, before the download.
The client still asks zero questions.** State this in the decision record.

---

## 2. `packages/questionnaire` — pure, deterministic, dependency-light

Deps: `@arm/proto`, `@arm/config`. Nothing else, ever — the
`questionnaire-determinism` guard checks this.

```
packages/questionnaire/src/
  index.ts
  graph.ts      traverse a questionnaireGraph: next question from answers so far
  score.ts      answers → ranked job functions (pure)
  recommend.ts  ranked job functions + catalog index → ranked packages (pure)
  validate.ts   graph well-formedness: reachable nodes, no cycles, terminal exists
  graphs/
    manufacturing.v1.ts   tech.v1.ts   generic.v1.ts
```

### 2.1 Determinism contract

`score()` and `recommend()` are pure functions of their arguments. No `fetch`, no
`Date.now()`, no `Math.random()`, no `crypto.randomUUID()`, no LLM call, no I/O.
Same answers + same catalog index ⇒ byte-identical output, forever. This is what
makes a recommendation auditable when a manager asks why an employee got a package.

Scoring: each chosen option carries `signals.job_functions[]` with a `weight`.
Accumulate weights per job function; rank descending; tie-break by job-function key
ascending. `recommend()` then maps the top job function to packages via
`work_package_job_function`, filters to what the user is eligible for, and ranks by
(exact job-function match, headcount fit, package version recency, slug).

Property-test it with `fast-check` (already used in `packages/policy`): shuffling
the answer order must not change the result.

### 2.2 The question set — 6 to 9 questions, all multiple choice (A5)

**There is no free-text question.** `questionNodeSchema` has no `text` kind, on
purpose: free text is content and would put employee-written job descriptions into
the control plane, violating Invariant 1.

Suggested manufacturing graph:

1. Where do you work? (org node picker, pre-filled from SSO when available)
2. Which best describes your day? (5–7 role clusters)
3. Which of these do you do weekly? (multi-select, 8–12 concrete tasks)
4. Which systems do you use? (multi-select: Jira, SAP, CMMS, SharePoint, …)
5. Do you write or review code / PLC logic? (single)
6. How do you prefer to work? (chat-first / in my editor / scheduled reports)
7. Which computer will you install on? (Windows / macOS / Linux)

Q7 drives installer selection only and is never stored in the response row.

If someone's role genuinely is not covered, the terminal node offers "none of these
fit" → records a **structured** `unmatched` marker on the response (no free text) →
surfaces in `library.gaps`. That is how the library roadmap learns.

---

## 3. `apps/onboarding` — the web flow

New Next.js app, port **3300**. Separate from `apps/public` (marketing, guide 04)
because it is tenant-scoped, talks to the control-plane tRPC API, and has a
different trust level. Shares the design tokens by importing the same CSS variables;
do not fork the design system.

Routes:

- `/start` (optionally `/start/[campaign]`) — SSO if the tenant requires it, else an
  invite-code gate. Then the questionnaire, one question per screen, back/forward,
  progress bar, resumable via a signed cookie.
- `/start/result` — "We recommend the **Maintenance Technician** package." Shows what
  is in it in plain language (tools, what it can do, budget, who approves), with a
  "something else" escape to the full eligible list.
- `/download` — platform-detected primary button + all platforms below + the
  6-character activation code + a "send me the link" option. This is where the setup
  token is issued.
- `/help/[step]` — plain-language fixes for each installer failure code.

Emit `activation_event` at: `questionnaire_started`, `questionnaire_completed`,
`token_issued`, `downloaded`. Metadata only — `user_ref` is a pseudonymous id, never
an email.

---

## 4. Setup tokens — `packages/trpc/src/onboarding-router.ts`

Replace the guide-00 placeholder. Use `jose` (already a dependency of `@arm/auth`).

| Procedure               | Behaviour                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `getQuestionnaire`      | published definition for the tenant's industry profile                                                                                    |
| `submitResponse`        | zod-validate against `questionnaireAnswerSchema` (structured only), store, return recommendations                                         |
| `recommend`             | pure re-run without storing (used by "something else")                                                                                    |
| `issueSetupToken`       | mint JWT per `setupTokenClaimsSchema`; store **sha256 of the token** + a unique 6-char activation code; TTL **15 minutes**; single use    |
| `redeemSetupToken`      | verify signature, expiry, and unredeemed state; mark redeemed with the client version; return the package manifest + connections manifest |
| `resolveActivationCode` | code → token, same rate-limited redemption path                                                                                           |

Rules:

- The token never carries a credential, a secret, or any free text. Guide 00 ships a
  contract test for that; keep it passing.
- Redemption is single-use and rate-limited per tenant. A second redemption returns a
  distinct, plain-language error the client can explain ("this setup link was already
  used — ask IT for a new one").
- Assignment coupling (A6): on redemption, create a `package_assignment`. If the
  package has `approval_required = false`, transition straight to `approved`;
  otherwise leave it `requested` and return `pending_approval` so the client says
  "your agent is installed; tool access is waiting on your manager". The install
  never blocks on approval.

---

## 5. `packages/client-core` — the token path

Keep everything that exists. Add, do not replace:

```ts
export async function resolveFromSetupToken(args: {
  token: string; // raw JWT or 6-char activation code
  controlPlaneUrl: string;
}): Promise<SetupArgs>;
```

It redeems the token, verifies the manifest sha256 (existing
`verifyManifestIntegrity`), and returns the same `SetupArgs` the flag path builds —
so `runSetup` is unchanged below that seam. The `--role`/flags path stays for power
users and CI; it is now the advanced fallback, not the primary path.

Also in this package:

- Update `buildCanonicalManifest` to **manifest v2** (guide 00 §4) and test it
  against the committed shared golden fixture at
  `packages/proto/test/fixtures/manifest-v2-golden.json`. The `library` agent updates
  the server-side canonicalizer against the same fixture; the fixture is the
  arbiter, so neither of you edits the other's file.
- Component installation: resolve each `components[]` entry, pull its blob from the
  data-plane artifact cache (`GET /artifacts/:digest`), verify sha256, and install by
  kind (mcp/connector → opencode MCP entry; skill/subagent/template → the agent
  home's corresponding directory). **A digest mismatch is a hard failure** — never
  install unverified bytes.
- `assertNoSecretsInConfig` continues to gate every write. Credentials remain
  env-var references plus the `0600` `.arm-env` file. OS-keychain storage is out of
  scope; leave a `TODO(keychain)` and do not pull in a native dependency.
- Emit `activation_event` for `installed`, `runtime_ready`, `connections_started`,
  `connections_completed`, `first_metered_call`, each with a duration and, on
  failure, a stable `error_code`.

### 5.1 Failure taxonomy

Every failure gets a stable code, a plain-language message, and a fix. Minimum set:
`RUNTIME_MISSING`, `RUNTIME_TOO_OLD`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`,
`MANIFEST_TAMPERED`, `DIGEST_MISMATCH`, `PROXY_UNREACHABLE`, `NO_AGENT_TOKEN`,
`CONNECTION_DECLINED`, `DISK_PERMISSION`. Codes go to `activation_event.error_code`
and drive `/adoption`'s stall panel and `/help/[step]` — so the set is a shared
contract; define it in `packages/client-core/src/errors.ts` and export it.

---

## 6. `apps/cli`

- `arm setup --token <jwt|code>` — the new primary path.
- `arm setup` with no arguments — prints the tenant `/start` URL and prompts for an
  activation code.
- Existing `--role`/`--tenant-url` flags retained and documented as advanced.
- `arm doctor` — re-runs verification and prints the failure taxonomy with fixes.
- Keep the injectable `runSetupFn` seam so tests exercise routing without network.

---

## 7. `packaging/` — signed installers (A7)

```
packaging/
  build-sea.mjs        Node 22+ Single Executable Application build → arm(.exe)
  windows/             WiX MSI + signing script (EV cert), winget manifest
  macos/               pkg + notarization script, homebrew formula
  linux/               deb + rpm + install script
  README.md            release + signing runbook
```

- Target: one self-contained executable per platform, no Node install required.
- The `.armsetup` file is a small JSON file (`{version, token, control_plane_url}`)
  registered to the client's file handler by the installer, so the employee's
  download-and-double-click works with no terminal.
- Code signing and notarization are **required from the first beta** — unsigned
  binaries get blocked by SmartScreen/Gatekeeper and destroy the adoption metric that
  is now the product's top-line.
- Publish SHA256 sums; `/rollout` displays them.
- Certificates and secrets live in CI secrets. Never commit one, never print one; if
  a signing credential is missing, run the unsigned build, mark the artifact
  `unsigned-dev`, and report the credential gate explicitly.

---

## 8. Guardrails you own

| Guard                       | Asserts                                                                                                                                                                   | Mutation proof                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `questionnaire-determinism` | `packages/questionnaire` imports only `proto`/`config`; no `fetch`/`Date.now`/`Math.random`/`crypto.randomUUID`/`process.env` reachable from `score.ts` or `recommend.ts` | add `Date.now()` to `score.ts` → red → restore |
| `no-content-in-activation`  | `activationEventSchema` and `questionnaireAnswerSchema` expose no free-text field; no question node has `kind: "text"` in any shipped graph                               | add a text node to a graph → red               |

Both red on empty input.

---

## 9. Acceptance criteria

- [ ] `packages/questionnaire` is pure and property-tested; answer order does not affect the result.
- [ ] No free-text field exists anywhere in the questionnaire path (schema, graphs, storage).
- [ ] `apps/onboarding` runs the full flow on port 3300 and emits the four web-side activation events.
- [ ] Setup tokens: 15-min TTL, single use, hash-stored, no secrets, rate-limited; second redemption gives a friendly error.
- [ ] Auto-approve works for `approval_required = false`; otherwise install completes with `pending_approval`.
- [ ] `client-core` installs components by digest with verification; a tampered blob hard-fails with `DIGEST_MISMATCH`.
- [ ] `buildCanonicalManifest` matches the shared golden vector.
- [ ] `arm setup --token` works end to end against a locally running control plane.
- [ ] Signed installers build for all three platforms in CI (unsigned + flagged when certs are absent).
- [ ] Both guardrails mutation-proofed; `pnpm typecheck && pnpm test && pnpm guardrails` green.

## 10. Out of scope

Desktop GUI (A7), OS-keychain credential storage, MDM tenant enrolment automation,
Tier-A OAuth vendor app registrations (they are a business process — leave the
connections wizard's Tier-B guide path working without them), and any UI in
`apps/control-plane/web`.

## 11. Docs to update

New `docs/solutions/2026-08-21-d11-questionnaire-provisioning.md`;
`docs/arm-spec.md` §8 (new §8.7 flow: questionnaire → download → first value), §5.2,
§15; `docs/agent-onboarding-guide.md` (rewrite: questionnaire path primary, flags
advanced); `docs/solutions/2026-08-13-work-package-roadmap.md` §3.1 and §5 reconciled
with A4/A7; `README.md`.
