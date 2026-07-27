"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export type ScopeRef = { type: "org" | "department" | "group" | "team"; id: string } | null;

/** Reads the current scope from the URL query param `?scope=type:id`.
 *  Returns null when no scope is set (org-root / CEO view). */
export function useScope(): ScopeRef {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const raw = searchParams.get("scope");
    if (!raw) return null;
    const [type, id] = raw.split(":");
    if (!type || !id) return null;
    if (!["org", "department", "group", "team"].includes(type)) return null;
    return { type: type as ScopeRef extends null ? never : NonNullable<ScopeRef>["type"], id };
  }, [searchParams]);
}

/** Builds a URL for navigating to a child scope. */
export function scopeUrl(scope: ScopeRef, basePath = "/"): string {
  if (!scope) return basePath;
  return `${basePath}?scope=${scope.type}:${scope.id}`;
}
