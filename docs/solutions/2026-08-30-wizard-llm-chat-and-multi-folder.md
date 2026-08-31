---
title: "Install wizard: LLM chat assistant + multi-project folder picker"
date: 2026-08-30
status: shipped
supersedes: none
---

# Wizard LLM Chat + Multi-Folder Scan

Two follow-ups to the GUI installer: an LLM-backed conversation so an
employee can describe their work instead of writing one paragraph, and a
multi-folder picker since most people have more than one project directory
open, not one.

## Why the chat routes through the tenant's own proxy, not a direct API call

`@arm/questionnaire` stays exactly as pure/deterministic as before — this
chat is scoped entirely to the post-install refine step, never the
baseline package recommendation. The harder question was where the LLM
call itself goes. Two things that were NOT options: a third-party LLM API
directly (new, ungoverned egress the tenant never approved) or ARM's own
control plane (Invariant §11.1 — prompt bodies never leave the tenant VPC,
and the control plane is metadata-only by design).

The right answer was already sitting in the codebase: `apps/data-plane/
proxy`'s `/v1/proxy` — the SAME tenant-VPC infrastructure, SAME
`armProxyUrl`+`agentToken` credentials, that every other agent call this
employee's install will ever make already goes through. `llm-chat.ts`'s
`sendChatMessage` is nothing more than one more caller of that existing
contract. The conversation gets the identical DLP/quota/model-access gates
as any other agent traffic — it's not a new trust boundary, it's the same
one.

The conversation transcript itself is not the auditable signal, either —
once the user is done, the caller (the wizard, or `arm refine`'s CLI path
if it grows this later) feeds the transcript through the exact same
deterministic `classifyPainPoints` (pain-points.ts) a plain textarea
already used. "Why did I get tagged X" still always has a one-line keyword
answer, whether the text came from one paragraph or a ten-turn
conversation.

## Making the proxy's stub actually answer for real

`apps/data-plane/proxy`'s `/v1/proxy` route was pure stub — `[ARM proxy
stub] Simulated response...`. Its own header comment already promised
"real mode: delegates to upstream provider APIs when credentials are
configured," just never built. Added that, scoped tightly: an
`ARM_PROXY_UPSTREAM_URL` env var (unset by default — zero behavior change,
zero risk to the proxy's existing test suite) that, when set, forwards to
that URL's OpenAI-chat-completions-compatible endpoint. This covers a
local Ollama instance directly — confirmed real, since this same sandbox
already had two real pulled models (`minicpm5-1b`, `qwen3.5`) and the
enterprise simulation's own `docker-compose.enterprise.yml` already points
an upstream at Ollama the identical way. The client still requests an
ARM-standard model name (`claude-sonnet-4-20250514`) so `checkModelAccess`'s
allowlist gate is unchanged; the proxy decides which real backend answers
it — the abstraction a production deployment would make regardless.

## Multi-folder scan

`scanWorkFolders(paths[])` (folder-scan.ts) unions extension counts and
re-derives tags across several folders — one unreadable path never blocks
the others. `/api/refine` accepts `folderPaths: string[]` (still accepts
the old singular `folderPath` too, folded into the same list). The wizard
UI replaced the single "Choose…" field with an "+ Add folder…" button that
can be clicked repeatedly (each call is one native single-folder picker —
Windows has no real native multi-select folder dialog, so "click twice"
beats fighting that platform gap) building a removable list, matching the
VS Code multi-root-workspace pattern rather than forcing a fragile
cross-platform multi-select native dialog.

## Real bug found live, not by the unit suite

The chat log and refine results are also inserted via `innerHTML` — same
class of risk the earlier `<role>`-placeholder bug came from. Both new
render paths (`addBubble`, the chat log) were built using `textContent`
from the start this time, informed by that earlier fix — no repeat bug
here, but worth naming as the direct reason the pattern was applied
correctly on the first pass.

## Verified live, end to end, real LLM included

Ran the real proxy (`ARM_PROXY_UPSTREAM_URL=http://localhost:11434`,
pointed at this machine's real Ollama) alongside the real onboarding
server, redeemed a real activation code through the wizard, then typed
into the chat: _"I run a manufacturing plant and my team keeps waiting on
me for budget approvals before they can order parts."_ Got back a real,
contextual reply from `minicpm5-1b` — not simulated, not templated. The
transcript correctly classified to `budget_approval_pain → senior_manager`
via the same deterministic path a typed paragraph would have. Separately
confirmed the multi-folder aggregation directly against two real seeded
project folders (one spreadsheet/presentation-heavy, one CAD-heavy) —
`{filesScanned: 11, tags: ["spreadsheet_heavy", "cad_heavy",
"presentation_heavy"]}`, correctly unioned across both.

Tests: 4 new `llm-chat.test.ts` cases (real HTTP against a local mock
proxy — auth headers, system-prompt prepending, error mapping), 4 new
`scanWorkFolders` cases, 4 new `gui-server.test.ts` chat-route cases (the
409-before-install-completes case, credential threading from redeem
through to chat, empty-message rejection). Full monorepo build (20 tasks),
all 19 guardrails, and the full test suite pass unchanged.

## Known gaps, not fixed here

- No conversation length cap — a very long back-and-forth has no limit
  before "Analyze" (cost/quota enforcement already happens proxy-side per
  turn via the existing gates, but there's no wizard-side nudge to wrap up).
- The chat doesn't stream — each reply waits for the full completion
  before appearing, same "Analyzing…" spinner tradeoff already accepted
  for install progress in the previous slice.
