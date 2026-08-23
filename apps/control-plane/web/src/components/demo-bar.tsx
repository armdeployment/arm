"use client";

/**
 * ARM_DEMO persona switcher + sample-data badge (guide 04's ARM_DEMO
 * mechanism — flagged during Wave-1 integration as a gap guide 04 asked for
 * but guide 02 never speced and no Wave-1 agent owned; landed
 * post-integration). Renders only when the server has ARM_DEMO=1
 * (`isDemoModeClientFlag`, computed in layout.tsx — a Server Component — and
 * passed down, since `process.env.ARM_DEMO` without a NEXT_PUBLIC_ prefix
 * isn't visible to client code).
 *
 * Personas mirror apps/public/src/content/demo.ts's three click paths
 * exactly, so a visitor following that page's steps lands in the matching
 * scope here. This is UI-only routing, not real per-role auth — there is no
 * resolved-roles context anywhere in this scaffold yet (every router's
 * `requireXxx` gate says the same "dev mode: always authorized").
 *
 * The mutation guarantee itself lives server-side
 * (packages/trpc/src/demo-mode.ts) — this bar is the visible label, not the
 * enforcement.
 */

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SampleDataBadge } from "./deferred-shell";

export interface Persona {
  key: string;
  label: string;
  landingRoute: string;
}

export const DEMO_PERSONAS: Persona[] = [
  { key: "exec", label: "CEO / department exec", landingRoute: "/" },
  { key: "manager", label: "Plant manager / team lead", landingRoute: "/organization" },
  { key: "infosec", label: "InfoSec", landingRoute: "/audit" },
];

export function DemoBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [personaKey, setPersonaKey] = useState<string>(DEMO_PERSONAS[0]!.key);

  return (
    <div
      className="flex items-center justify-between gap-3 border-b px-4 py-1.5 text-[11px]"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--navy-light)" }}
      data-testid="demo-bar"
    >
      <div className="flex items-center gap-2">
        <SampleDataBadge />
        <span style={{ color: "var(--text-muted)" }}>
          Every write here is reverted after it runs — nothing persists for the next visitor.
        </span>
      </div>

      <label className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
        View as
        <select
          value={personaKey}
          onChange={(e) => {
            const persona = DEMO_PERSONAS.find((p) => p.key === e.target.value);
            setPersonaKey(e.target.value);
            if (persona && persona.landingRoute !== pathname) router.push(persona.landingRoute);
          }}
          className="rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
          aria-label="View as persona"
        >
          {DEMO_PERSONAS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
