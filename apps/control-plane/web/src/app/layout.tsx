import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "../components/sidebar";
import { TRPCProvider } from "../lib/trpc/provider";

export const metadata: Metadata = {
  title: "ARM — Agent Resource Management",
  description: "Identity, metering, routing, budgeting, and policy enforcement for AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
