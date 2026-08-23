/**
 * Domains this site is permitted to link to. Checked by
 * test/link-integrity.test.ts against every external href found in the
 * content modules. Guide 04 §6: "no external hosts except Google Fonts" for
 * assets; this list additionally covers anchor links, which are held to the
 * same bar — self-contained, no surprise third parties.
 */
export const externalLinkAllowlist: string[] = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];
