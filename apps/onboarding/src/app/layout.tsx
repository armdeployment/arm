import type { Metadata } from "next";
import "../styles/globals.css";
import { TRPCProvider } from "../lib/trpc/provider";

export const metadata: Metadata = {
  title: "ARM Setup — Get your agent",
  description:
    "Answer a few questions, download your ARM agent, and start working — no role key, no config file, no terminal.",
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
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
