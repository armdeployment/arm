"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/** All scope types matching the DB enum (D6/D7/D8 widening). */
export const SCOPE_TYPES = [
  "org", "organization", "hq", "plant",
  "department", "group", "line", "cell", "team",
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export type ScopeRef = { type: ScopeType; id: string } | null;

/** Reads the current scope from the URL query param `?scope=type:id`.
 *  Returns null when no scope is set (org-root / CEO view). */
export function useScope(): ScopeRef {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const raw = searchParams.get("scope");
    if (!raw) return null;
    const [type, id] = raw.split(":");
    if (!type || !id) return null;
    if (!SCOPE_TYPES.includes(type as ScopeType)) return null;
    return { type: type as ScopeType, id };
  }, [searchParams]);
}

/** Builds a URL for navigating to a child scope. */
export function scopeUrl(scope: ScopeRef, basePath = "/"): string {
  if (!scope) return basePath;
  return `${basePath}?scope=${scope.type}:${scope.id}`;
}
