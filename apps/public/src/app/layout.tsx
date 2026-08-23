import type { Metadata } from "next";
import "../styles/globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AsyncStylesheet } from "@/components/async-stylesheet";

const GOOGLE_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: {
    default: "ARM — Agent Resource Management",
    template: "%s — ARM",
  },
  description:
    "The HR system for AI agents. Get a governed, metered agent into every employee's hands, and see who's actually using it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Google Fonts is the one external host guide 04 §6 allows. Loaded
            non-render-blocking — a plain blocking <link rel="stylesheet">
            here measured as the single largest Lighthouse performance cost
            on this site (~1.7s of render-blocking time). */}
        <AsyncStylesheet href={GOOGLE_FONT_HREF} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main-content" className="flex-1 overflow-x-hidden">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
