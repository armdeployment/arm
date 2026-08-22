/**
 * Setup token claims contract test (guide 00 §5.2, A4).
 *
 * `setupTokenClaimsSchema` must never carry a credential, a secret, or free
 * text — this is what lets a setup token be logged, inspected, and passed
 * through the control plane's ordinary metadata paths without becoming a
 * content-egress or secret-egress risk. Asserts no field named
 * secret|token|password|key|answer|text (case-insensitive substring match —
 * `jti`/`aud` etc. are fine; a field like `access_token` or `answer_text`
 * would not be).
 */

import { describe, it, expect } from "vitest";
import { setupTokenClaimsSchema } from "../src/index.js";

const FORBIDDEN = ["secret", "token", "password", "key", "answer", "text"];

describe("setupTokenClaimsSchema contract (A4)", () => {
  const fields = Object.keys(setupTokenClaimsSchema.shape);

  it("has fields", () => {
    // Vacuous-guard discipline (spec §14.2): this contract test is worthless
    // if the schema shape is ever emptied out silently.
    expect(fields.length).toBeGreaterThan(0);
  });

  for (const forbidden of FORBIDDEN) {
    it(`carries no field name containing "${forbidden}"`, () => {
      const hits = fields.filter((f) => f.toLowerCase().includes(forbidden));
      expect(hits).toEqual([]);
    });
  }

  it("parses a well-formed claims object", () => {
    const valid = {
      iss: "https://control.arm.example.com",
      aud: "arm-client" as const,
      jti: "st_01",
      sub: "usr_01",
      tenant_id: "tn_01",
      package_version_ids: ["pv_01"],
      connections_digest: "a".repeat(64),
      control_plane_url: "https://control.arm.example.com",
      data_plane_url: "https://data.arm.example.com",
      proxy_url: "https://proxy.arm.example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    expect(setupTokenClaimsSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects a wrong audience", () => {
    expect(() =>
      setupTokenClaimsSchema.parse({
        iss: "https://control.arm.example.com",
        aud: "not-arm-client",
        jti: "st_01",
        sub: "usr_01",
        tenant_id: "tn_01",
        package_version_ids: [],
        connections_digest: "a".repeat(64),
        control_plane_url: "https://control.arm.example.com",
        data_plane_url: "https://data.arm.example.com",
        proxy_url: "https://proxy.arm.example.com",
        exp: 1,
        iat: 1,
      }),
    ).toThrow();
  });
});
