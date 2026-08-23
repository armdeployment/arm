/**
 * Content-honesty guard (guide 04 §7). test/content-honesty.test.ts greps
 * every content module for these patterns and fails the suite if one
 * appears. This enforces rule 7 (docs/guides/README.md) — no invented
 * customers, logos, testimonials, or metrics — after the person who wrote
 * this file is gone.
 *
 * Case-insensitive substring match. Keep entries specific enough that they
 * don't false-positive on legitimate copy (e.g. "target" alone is too broad;
 * "trusted by" is not).
 */
export const bannedPatterns: string[] = [
  "trusted by",
  "customer logo",
  "customer-logo",
  "testimonial",
  "case study",
  "case-study",
  "as seen in",
  "our customers say",
  "5-star",
  "five star",
  "★★★★★",
  "fortune 500 companies use",
  "used by companies like",
];
