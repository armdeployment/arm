"use client";

/**
 * Loads a stylesheet without blocking first paint (the "loadCSS" pattern:
 * media="print" until onload, then swap to media="all"). A plain blocking
 * <link rel="stylesheet"> for Google Fonts measured as the single largest
 * Lighthouse performance cost on this site (~1.7s of render-blocking time,
 * / dropped from 86 to under the guide's 95 target) — see layout.tsx.
 *
 * `onLoad` is a real event handler, so this has to be a Client Component;
 * RootLayout (a Server Component) renders it as a child, same as any other
 * client island.
 */
export function AsyncStylesheet({ href }: { href: string }) {
  return (
    <>
      <link rel="preload" as="style" href={href} />
      <link
        rel="stylesheet"
        href={href}
        media="print"
        onLoad={(e) => {
          (e.currentTarget as HTMLLinkElement).media = "all";
        }}
      />
      <noscript>
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  );
}
