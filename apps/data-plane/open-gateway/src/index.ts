// @arm-app/open-gateway — stub; see docs/arm-spec.md §9 (1.0 foundation)
export const APP_NAME = "@arm-app/open-gateway";
// Boundary note (spec §14.3 dependency-direction):
//   - control-plane apps import proto/config/db/clickhouse/policy/billing/auth/trpc.
//   - data-plane apps import proto/config ONLY (cross-plane shared via proto/config).
//   - data-plane apps must NOT import control-plane-only packages (db/trpc/policy/auth/billing).
