import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "../components/sidebar";
import { TRPCProvider } from "../lib/trpc/provider";
import { DemoBar } from "../components/demo-bar";

export const metadata: Metadata = {
  title: "ARM — Agent Resource Management",
  description: "Identity, metering, routing, budgeting, and policy enforcement for AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // ARM_DEMO gates the persona switcher + sample-data bar (guide 04's
  // ARM_DEMO mechanism). Checked server-side (this is a Server Component) —
  // process.env without a NEXT_PUBLIC_ prefix isn't visible client-side, and
  // the mutation guarantee itself lives in packages/trpc/src/demo-mode.ts
  // regardless of whether this bar renders.
  const demoMode = process.env["ARM_DEMO"] === "1";

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TRPCProvider>
          <div className="flex min-h-screen flex-col">
            {demoMode && <DemoBar />}
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 overflow-x-hidden">{children}</main>
            </div>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
