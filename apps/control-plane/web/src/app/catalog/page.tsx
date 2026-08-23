/**
 * /catalog is retired (docs/guides/02-server-panels.md §1): its route now
 * redirects to /library, which reuses this page's old card layout against
 * the real `catalog.listPackages`/`catalog.requestAssignment` procedures
 * (see ../../components/library/package-card.tsx and ../library/page.tsx).
 */

import { redirect } from "next/navigation";

export default function CatalogRedirect() {
  redirect("/library");
}
