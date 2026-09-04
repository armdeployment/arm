# Keeping installed components up to date

ARM installs components — skills, subagents, templates, prompt packs, plugins,
and MCP servers — onto employee machines. This document covers how each side
knows which version is where, and how a newer version reaches a laptop.

## The honest shape: the client asks, the server answers

There is no push channel to an employee laptop. It is behind NAT, asleep half
the day, and runs no ARM daemon. Anything describing itself as "server pushes
an update" is really "client asks on a schedule, and the answer arrives fast
enough that nobody notices the difference".

ARM does the second thing, and says so:

```
client                                control plane
  │  POST /api/components/check-in
  │  { sub_account_id, client_version,
  │    components: [{ id, version, … }] }
  ├──────────────────────────────────────▶  record inventory (component_install)
  │                                          compare against the registry
  │  { updates: [{ slug, from, to,
  │               blob_digest, … }] }
  ◀──────────────────────────────────────┤
  │
  │  GET  {artifact-cache}/blob/{digest}     pull + verify each new blob
  ├──────────────────────────────────────▶
  │  write file, rewrite lockfile
```

One round trip closes both loops: the operator learns which machine holds
which version, and the machine learns what is stale. Two endpoints would let
those two answers drift apart.

## Client side: the lockfile

`<agent-home>/.arm/installed.json`, mode `0600`, written atomically.

```json
{
  "schema": 1,
  "tenant_id": "…",
  "sub_account_id": "…",
  "client_version": "1.0.0",
  "updated_at": "2026-09-03T12:00:00.000Z",
  "components": [
    {
      "component_id": "…",
      "slug": "jira",
      "kind": "mcp",
      "version": "1.0.0",
      "blob_digest": null,
      "installed_path": null,
      "installed_at": "2026-09-03T12:00:00.000Z"
    }
  ]
}
```

It lives in `.arm/` rather than beside the components so that clearing
`skills/` to force a reinstall does not also erase the inventory the control
plane reconciles against.

Callable components (`mcp`, `http_api`, `cli`, `connector`) are recorded even
though they write no file. An MCP server pinned at 1.2.0 in the rendered
config is installed state by any useful definition, and leaving it out would
make every check-in report it as missing.

`arm setup` writes this file. Nothing else needs to.

```bash
arm list
```

## Server side: the inventory

One row per (sub_account, component) in `component_install`, replaced wholesale
on each check-in. Replace rather than merge, so an uninstall converges too — a
component the client stops reporting has been removed, and its row goes with
it. Merging would leave phantom rows that send an operator chasing a component
nobody has.

Read it with `library.listInstalls({ subAccountId })`.

This is deliberately **not** derived from the `component_pull_event` stream. A
pull is not an install (the bytes can fail to land), those events carry no
agent identity, and an append-only log answers "what happened" where an
operator needs "what is true now".

## Applying updates

```bash
arm update --dry-run   # report only
arm update             # download, verify, install, rewrite the lockfile
```

`arm doctor` runs the same check in dry-run mode and reports drift, so an
employee who runs the standard diagnostic sees that they are behind. Doctor
never installs: a diagnostic should not change the thing being diagnosed.

An update is **skipped, and the skip is printed**, when:

| Reason                    | Why                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requires_client_upgrade` | The new version declares a `min_client_version` this client cannot satisfy. Installing something the client cannot run is not recoverable; refusing is. |
| callable component        | It materializes as a config entry, not a file. Re-run `arm setup` to re-render the config.                                                              |
| no artifact cache URL     | Set `ARM_DATA_PLANE_URL`.                                                                                                                               |

Silence is never one of the outcomes. An update that quietly did not happen is
the failure this feature exists to remove.

Blobs are pulled by `sha256:` digest and verified before anything is written —
a mismatch throws rather than installing unverified bytes.

### What is never done automatically

- **Downgrades.** A client ahead of the registry is left alone; rolling it
  back would undo a deliberate action.
- **Yanked versions.** Yanking is how a broken or compromised version is
  withdrawn, so it is never an upgrade target. If _every_ published version of
  an installed component is yanked, it is reported under `unknown` for an
  operator to look at.
- **Removals.** Components the registry no longer publishes are reported, not
  deleted. Deleting something an employee is mid-task with is worse than
  telling an operator it is stale.

## Making it periodic

Nothing here needs a daemon. Run `arm update` on whatever scheduler the fleet
already has.

macOS (`~/Library/LaunchAgents/com.arm.update.plist`, then `launchctl load` it):

```xml
<dict>
  <key>Label</key><string>com.arm.update</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/arm</string><string>update</string></array>
  <key>StartInterval</key><integer>21600</integer>
</dict>
```

Linux — a systemd user timer, or cron:

```cron
0 */6 * * * /usr/local/bin/arm update >> ~/.arm/update.log 2>&1
```

Six hours is a starting point, not a recommendation. Pick it from how fast you
publish and how disruptive a mid-day component swap is.

## Environment

| Variable                | Used for                                                 |
| ----------------------- | -------------------------------------------------------- |
| `ARM_CONTROL_PLANE_URL` | Where check-in POSTs (the onboarding app, :3300 in dev). |
| `ARM_DATA_PLANE_URL`    | Artifact cache — required to download new blobs.         |
| `ARM_AGENT_TOKEN`       | Bearer token for check-in.                               |
| `ARM_AGENT_HOME`        | Agent home, if not the default.                          |

## Security notes

- The tenant comes from the verified token, never from the request body. A
  client that could name its own tenant could write inventory into, and read
  update plans out of, someone else's.
- `/api/components/check-in` inherits `resolveAuthMode`: under
  `NODE_ENV=production` with no OIDC configured it refuses rather than
  treating every caller as the development identity.
- The lockfile is `0600`. It names every component on the machine.
