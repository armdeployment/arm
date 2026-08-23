"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@arm/trpc";

/**
 * tRPC React client (guide 03 §3). Provides typed hooks:
 * `trpc.onboarding.getQuestionnaire.useQuery()`, etc.
 */
export const trpc = createTRPCReact<AppRouter>();
