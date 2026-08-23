import { redirect } from "next/navigation";

/**
 * Root — redirects straight to the questionnaire (docs/guides/
 * 03-client-downloader.md §3: "/start (optionally /start/[campaign])").
 * TODO(1.1): SSO / invite-code gate ahead of the questionnaire when a
 * tenant requires it — this scaffold runs in dev-mode auto-authenticated
 * context (see api/trpc/[trpc]/route.ts), matching every other app here.
 */
export default function RootPage() {
  redirect("/start");
}
