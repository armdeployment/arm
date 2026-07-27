import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "../components/sidebar";

export const metadata: Metadata = {
  title: "ARM — Agent Resource Management",
  description: "Identity, metering, routing, budgeting, and policy enforcement for AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
