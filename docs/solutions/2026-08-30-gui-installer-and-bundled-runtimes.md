---
title: "No-terminal GUI installer + bundled Python/Node runtimes"
date: 2026-08-30
status: shipped
supersedes: none
---

# No-Terminal GUI Installer + Bundled Runtimes

Two requirements from the same conversation: (1) MCPs/skills that shell out
to `python3`/`node` must not require the employee to have installed those
themselves — A1 "very easy" adoption breaks the moment setup asks someone to
stop and go install a language runtime; (2) the entire installation must be
UI-based — no terminal command, ever.

## Part 1 — bundled runtime provisioning

`packages/client-core/src/runtime-provision.ts`: `detectRuntime(kind,
{agentHome})` checks a previously-bundled copy under
`<agentHome>/runtimes/<kind>/bin` first, then PATH. `provisionRuntime`
downloads a real, official, portable build when neither is present:

- **Node**: nodejs.org's own tarballs — already relocatable, that's how
  Node itself is distributed.
- **Python**: astral-sh/python-build-standalone — the same portable-CPython
  project `uv` is built on.

The checksum is never hardcoded. `provisionRuntime` fetches the vendor's own
published checksum manifest (`SHASUMS256.txt` for Node, the per-asset
`.sha256` for python-build-standalone) at provision time and verifies the
download against *that* — a stale or invented digest checked into source is
worse than none (AGENTS.md's "never fabricate a credential" extends to
integrity hashes). A mismatch throws `DIGEST_MISMATCH` and nothing is
installed.

Wired into `opencode.ts`/`setup.ts`: a `cli`-kind component can declare
`config_schema.runtime: "python" | "node"`; `renderOpencodeConfig` collects
these into `runtimeRequirements` (pure, no I/O — rendering stays
synchronous). `runSetup` then provisions each declared runtime once,
rewrites the affected MCP entries' `command` to the resolved interpreter
path, and reports `runtimesProvisioned: string[]` on the result.

**What's verified vs. written-but-unexercised** (same honesty convention
`packaging/README.md` already uses for the platform wrapper scripts):
`detectRuntime`'s real, non-mocked path was run live against this machine
(found real `node`/`python3` on PATH, correct versions). The download →
verify → extract → link pipeline is fully covered by injected-dependency
unit tests (12 tests: correct archive per platform/arch, checksum-mismatch
refusal, unreachable-manifest error, skip-when-present) but a live
multi-hundred-MB download across all three OSes needs a real run outside
this sandbox — flagged here rather than silently assumed.

## Part 2 — the GUI installer

`packages/client-core/src/gui-server.ts` + `gui-wizard-html.ts`: `arm
setup` with no flags now starts a local HTTP server bound to `127.0.0.1`
(never `0.0.0.0`) and opens it in the default browser
(`openInBrowser` — `open`/`start`/`xdg-open` per platform), instead of
prompting on stdin. Every step — activation code, `.armsetup` drag-drop,
install progress, connection guides, the pain-point/folder/installed-tools
refinement — is a click or a form fill in that page. `arm setup --cli`
is kept as an explicit escape hatch to the old terminal-prompt flow
(scripted answers, accessibility, no-browser environments).

This isn't new business logic — `gui-server.ts`'s routes call straight into
`runSetup`, `resolveFromSetupToken`, `scanWorkFolder`, `scanInstalledTools`,
`classifyPainPoints` exactly as the CLI flags path and `arm refine` already
did. "One engine, every shape" (roadmap §5, `apps/cli`'s own header
comment) was written anticipating exactly this — a GUI installer is the
"any future platform installer" that comment already named.

One native-OS integration: `/api/pick-folder` shells out to `osascript`
(macOS)/PowerShell's `FolderBrowserDialog` (Windows)/`zenity` (Linux) for a
real folder picker, since a browser file input can't hand a local server an
absolute path. The wizard's folder field stays editable regardless (not
`readonly`) — Linux without `zenity` installed, or a cancelled dialog,
degrades to typing a path, which is still zero terminal.

**Real bug found by actually clicking through the flow, not by the unit
tests**: the connections-guide text includes a literal `"ARM <role>"`
placeholder (connections.ts's own convention, unrelated to this change).
Inserting it via `innerHTML` without escaping made the browser parse
`<role>` as an unknown tag and silently drop it — `Label it (e.g. "ARM ")`
instead of `"ARM <role>"`. Fixed with an `escapeHtml` helper applied to
every dynamic string going into `innerHTML` (guide steps, component names,
detected tags) — the same class of bug XSS sanitization exists for, even
though every string here comes from this codebase's own trusted data, not
user input.

**Second real bug, same live-testing pass**: `DEFAULT_OPENCODE_HOME =
"~/.config/opencode"` was never tilde-expanded anywhere in the codebase.
Node's `fs.mkdir`/`fs.writeFile` don't interpret `~` — every real setup run
with no explicit `agentHome` (which is exactly what the GUI path is, since
the wizard has no `--agent-home` flag equivalent) was silently writing
`config.json`/`.arm-env`/installed components under a literal directory
named `~` relative to the process's cwd, not the user's real home. Not new
— this predates the GUI work and equally affected the CLI's own `--token`
path whenever `--agent-home` was omitted; it just happened that every prior
manual CLI test in this project explicitly passed `--agent-home` to a temp
dir, so it never manifested. Fixed with `resolveAgentHome()`
(`opencode.ts`), used at the single point `runSetup`/`renderOpencodeConfig`
turn `agentHome` into real filesystem paths.

## Verified live, end to end, zero terminal typing

Real activation code from a fresh questionnaire run → pasted into the
wizard page → "Install" clicked → real `senior_manager` package installed
(role, budget, 8 real components) → connection guides rendered correctly
(with the `<role>` fix) → pain-point text typed + a real folder path typed
→ "Analyze" clicked → real detected tags (`budget_approval_pain →
senior_manager`, installed-tool detection found this machine's real VS
Code/Docker/Slack). Every interaction was a browser click or a form fill;
the only terminal command run at all was the one that starts the server —
exactly what a double-click already does today on Windows/Linux, and will
on macOS once that platform's file association lands (packaging/README.md).

Tests: 8 new `gui-server.test.ts` cases (real HTTP against a real server
instance, every business-logic call injected) + 3 new CLI-level tests for
the `runSetupGuiCommand` seam (`main()`'s own no-args branch is
intentionally not unit-tested — it awaits a promise that never resolves by
design, since the server is meant to keep the process alive). Full
monorepo build (20 tasks) and all 19 guardrails pass unchanged.

## Known gaps, not fixed here

- No progress granularity during install — a single spinner, not a
  step-by-step status (verify → provision runtime → write config →
  install components → health check). Would need an optional progress
  callback threaded through `runSetup`; deferred to keep this slice's
  change to that function's signature at zero.
- The connections screen still only shows guide text — pasting a real
  token/completing OAuth isn't wired to the tenant vault from here (that's
  server-side control-plane work, tracked separately, not a client-core
  gap).
- Windows console-flash on double-click and the macOS `.armsetup`
  association gap — both packaging/build concerns, noted in
  `packaging/README.md`, not client-core.
