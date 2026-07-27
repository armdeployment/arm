"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@arm/trpc";

/**
 * tRPC React client (spec §9 1.0).
 * Provides typed hooks: `trpc.agents.list.useQuery()`, etc.
 */
export const trpc = createTRPCReact<AppRouter>();
