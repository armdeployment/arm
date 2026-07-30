"use client";

import { trpc } from "../lib/trpc/client";
import { scopeUrl, type ScopeRef } from "../lib/use-scope";

/** Breadcrumb showing Org > Dept > Group > Team — each crumb is clickable. */
export function ScopeBreadcrumb({ scope }: { scope: ScopeRef }) {
  const { data } = trpc.orgTree.path.useQuery({ scope: scope ?? null });

  if (!data) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
      {data.path.map((node, i) => {
        const isLast = i === data.path.length - 1;
        // Org root maps to null scope (no query param → "/"), everything else uses its scope ref.
        const childScope =
          node.type === "org"
            ? null
            : i < data.path.length - 1
              ? ({ type: node.type, id: node.id } as ScopeRef)
              : null;
        return (
          <span key={node.id} className="flex items-center gap-1.5">
            {i > 0 && <span style={{ color: "var(--text-muted)" }}>/</span>}
            {isLast ? (
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {node.name}
              </span>
            ) : (
              <a
                href={scopeUrl(childScope)}
                className="transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-secondary)" }}
              >
                {node.name}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
