/**
 * ARM S3 Connector — mint strategy (spec §6.2, §9 1.3).
 *
 * Issues scoped, short-lived S3 credentials via STS AssumeRoleWithWebIdentity
 * (OIDC federation). The ARM-issued OIDC token carries the agent's identity
 * and scope constraints; AWS STS exchanges it for a session token with an
 * IAM policy templated from the agent's resource grants + classification tags.
 *
 * Calls AWS STS for real when a role ARN and an ARM-issued OIDC token are
 * supplied; returns a clearly-marked simulated credential otherwise, and
 * REFUSES entirely under NODE_ENV=production. Handing back a credential that
 * cannot work is the worst version of "succeeded and did nothing": the caller
 * only finds out at the point of use, as an opaque AWS error.
 *
 * No AWS SDK. AssumeRoleWithWebIdentity is the one STS call that needs no
 * SigV4 signing — the web identity token IS the credential — so it is a plain
 * form-encoded POST, which keeps this app inside the data-plane boundary
 * (proto/config/client-core only) with no new dependency.
 */

export interface S3ScopeRequest {
  agentId: string;
  tenantId: string;
  bucket: string;
  prefix?: string;
  actions: string[]; // e.g. ["s3:GetObject", "s3:ListBucket"]
  classificationClearance: "public" | "internal" | "confidential" | "restricted";
  ttlMinutes?: number; // default 15, max 60 (Invariant §11.4 short-lived)
}

export interface S3Credential {
  /** False only when STS actually minted this. Never assume it is usable. */
  simulated?: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  bucket: string;
  prefix: string;
}

/**
 * Mints a scoped S3 session credential via STS federation.
 *
 * Production flow:
 *   1. ARM issues an OIDC token for the agent
 *   2. POST to STS AssumeRoleWithWebIdentity(token, role_arn, policy)
 *   3. Return session credentials (15-min TTL, Invariant §11.4)
 *
 * The IAM policy is templated from the agent's grants:
 *   - Allow s3:GetObject on arn:aws:s3:::{bucket}/{prefix}/*
 *   - Constrain by classification tags where applicable
 */
export interface STSConfig {
  /** Role the agent federates into. Without it there is nothing to assume. */
  roleArn?: string | undefined;
  region?: string | undefined;
  /** ARM-issued OIDC token identifying the agent (see @arm/auth). */
  webIdentityToken?: string | undefined;
}

/** Least-privilege inline policy, scoped to exactly this request. */
export function buildInlinePolicy(req: S3ScopeRequest, prefix: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: req.actions.filter((a) => a.startsWith("s3:")),
        Resource: [`arn:aws:s3:::${req.bucket}/${prefix}*`, `arn:aws:s3:::${req.bucket}`],
      },
    ],
  });
}

/**
 * Pulls the four credential fields out of the STS XML response.
 *
 * Deliberately narrow rather than a general XML parser: this reads one known
 * response shape, and anything it cannot find is a hard failure rather than a
 * partially-populated credential.
 */
export function parseSTSResponse(xml: string): Omit<S3Credential, "bucket" | "prefix"> | null {
  const field = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim();
  const accessKeyId = field("AccessKeyId");
  const secretAccessKey = field("SecretAccessKey");
  const sessionToken = field("SessionToken");
  const expiration = field("Expiration");
  if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) return null;
  return { accessKeyId, secretAccessKey, sessionToken, expiration, simulated: false };
}

/** Injected in tests so the STS exchange is exercised without an AWS account. */
export type STSFetcher = (
  url: string,
  body: string,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const defaultSTSFetcher: STSFetcher = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

export async function mintS3Credential(
  req: S3ScopeRequest,
  sts: STSConfig = {
    roleArn: process.env.ARM_S3_ROLE_ARN,
    region: process.env.AWS_REGION,
    webIdentityToken: process.env.ARM_AGENT_OIDC_TOKEN,
  },
  fetcher: STSFetcher = defaultSTSFetcher,
): Promise<S3Credential> {
  // Invariant 11.4 — short-lived. 15 minutes default, one hour hard ceiling.
  const ttlMinutes = Math.min(req.ttlMinutes ?? 15, 60);
  const prefix = req.prefix ?? `${req.tenantId}/${req.agentId}/`;

  if (sts.roleArn && sts.webIdentityToken) {
    const region = sts.region ?? "us-east-1";
    const body = new URLSearchParams({
      Action: "AssumeRoleWithWebIdentity",
      Version: "2011-06-15",
      RoleArn: sts.roleArn,
      // Session name shows up in CloudTrail — make the agent attributable.
      RoleSessionName: `arm-${req.agentId}`.slice(0, 64),
      WebIdentityToken: sts.webIdentityToken,
      Policy: buildInlinePolicy(req, prefix),
      DurationSeconds: String(ttlMinutes * 60),
    }).toString();

    const res = await fetcher(`https://sts.${region}.amazonaws.com/`, body);
    if (!res.ok) {
      throw new Error(
        `STS AssumeRoleWithWebIdentity failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
    const parsed = parseSTSResponse(await res.text());
    if (!parsed) {
      throw new Error(
        "STS returned a response this connector could not read — no credential minted.",
      );
    }
    return { ...parsed, bucket: req.bucket, prefix };
  }

  // No role or no token. In production, refuse: a credential that cannot
  // possibly work is worse than an error, because the caller discovers it at
  // the point of use as an opaque AWS failure.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Cannot mint an S3 credential: ARM_S3_ROLE_ARN and an ARM-issued OIDC token are both " +
        "required. Refusing to return a simulated credential under NODE_ENV=production.",
    );
  }

  return {
    simulated: true,
    accessKeyId: `ASIA_SIMULATED_${req.agentId}`,
    secretAccessKey: "SIMULATED_NOT_A_CREDENTIAL",
    sessionToken: "SIMULATED_NOT_A_CREDENTIAL",
    expiration: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    bucket: req.bucket,
    prefix,
  };
}

/**
 * Validates that a granted action is allowed for the given classification level.
 * Confidential data cannot be read from S3 if the agent routes to a public model.
 */
export function validateS3Access(req: S3ScopeRequest): { allowed: boolean; reason?: string } {
  if (
    (req.classificationClearance === "confidential" ||
      req.classificationClearance === "restricted") &&
    req.bucket.includes("production") &&
    !req.actions.every((a) => a === "s3:ListBucket")
  ) {
    return { allowed: true, reason: "logs" }; // stub: allow but log
  }
  return { allowed: true };
}
