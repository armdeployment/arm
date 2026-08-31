---
title: "D8: Org-tree mutation authority — capability-based, not title-based"
date: 2026-08-03
status: locked
supersedes: []
related: ["2026-08-02-d6-industry-profile"]
---

# D8: Org-tree mutation authority

## Problem

When a company expands — opens a new plant, acquires a subsidiary, reorganizes a
division — someone has to restructure the org tree in ARM. The question: **who**
is allowed to do that, and **how much** can they change?

The naive answer (hardcode a corporate ladder: Admin > CEO > VP > Senior VP >
Director > Manager > IC) is wrong for three reasons:

1. **Titles aren't authority.** A "Senior Director" at a 50-person startup and
   a "Senior Director" at Siemens have completely different authority.
2. **Violates spec invariants.** Invariant 3 ("higher deny always wins") and
   Invariant 8 ("priority is policy, not self-declared") establish that authority
   comes from what you're granted, not your title. The org-tree editor must follow
   the same rule.
3. **Fights the data boundary.** Org-tree edits are metadata (control plane),
   governed by the same RBAC that already exists for everything else.

## Decision

**Option 1 (locked): Role presets are pure profile data, like everything else in D6.**

The org-tree permission model is capability-based, NOT title-based. Four verbs:

| Permission          | What it allows                           | Default scope                               |
| ------------------- | ---------------------------------------- | ------------------------------------------- |
| `org_node:create`   | Add a child node                         | delegated (plant_manager, subsidiary_admin) |
| `org_node:rename`   | Rename a node                            | delegated (dept_head, plant_manager)        |
| `org_node:reparent` | Move a node under a different parent     | **org_admin only**                          |
| `org_node:delete`   | Remove a node (only if no active agents) | **org_admin only**                          |

### Role presets (seeded by profile, editable at runtime)

The profile ships role presets that map to titles _at provisioning time_. After
provisioning, the `org_admin` can reconfigure them via `/admin/roles`.

| Preset                    | Scope                | Permissions                      |
| ------------------------- | -------------------- | -------------------------------- |
| `org_admin`               | org root (singleton) | all four verbs + `*`             |
| `subsidiary_admin`        | organization node    | create + rename (within subtree) |
| `plant_manager`           | plant node           | create + rename (within plant)   |
| `dept_head` / `desk_head` | department node      | rename own dept only             |
| `viewer`                  | any node             | read-only                        |

A real customer maps these to their titles: at Siemens a "Senior VP Manufacturing"
gets `subsidiary_admin` on the Manufacturing Division; at a startup the "Head of
Ops" gets `org_admin`. Same software, different mapping — because the mapping is
configuration.

### Why this respects D6

The profile seeds DEFAULTS (role rows in `roleTable`), never gates a capability.
Runtime permission resolution reads `roleTable` + `userRoleTable` rows — it NEVER
reads the profile id or `presetKey`. The `no-profile-branching` guardrail enforces
this: `presetKey` is now a blocked pattern in `packages/auth` and `packages/policy`.

A tech tenant can define `plant_manager` too — they just don't get it seeded.

## Schema

- `roleTable` + `presetKey` column (NULL for custom roles, seeded key otherwise)
- `userRoleTable` (many-to-many: user ↔ role at scope)
- `orgMutationLogTable` — audit trail for every create/rename/reparent/delete

## Edge cases handled

- **Acquisition**: `org_admin` adds a new `organization` node, grants
  `subsidiary_admin` to the acquired company's CTO.
- **New plant**: `subsidiary_admin` adds a `plant` node; plant manager gets
  `plant_manager` at that scope.
- **Reorg**: `org_admin` does `reparent` — moving Plant Shenzhen from one
  division to another. All agents follow automatically (attached to `scope_id`,
  not path string).
- **Departure**: `userRoleTable` rows revoked; `stakeholder` agents force
  reassignment (Invariant 7).

## Files

- `packages/auth/src/index.ts` — `ORG_NODE_PERMISSIONS`, `canMutateOrgNode()`
- `packages/profiles/src/types.ts` — `RolePresetDef`
- `packages/db/src/schema/identity.ts` — `roleTable.presetKey`
- `packages/db/src/schema/org-audit.ts` — `orgMutationLogTable`
- `apps/simulation/src/db-init.ts` — seeds role presets + grants CEO org_admin
- `scripts/guardrails/src/checks/no-profile-branching.ts` — blocks `presetKey`
