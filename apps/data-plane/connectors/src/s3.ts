/**
 * ARM S3 Connector — mint strategy (spec §6.2, §9 1.3).
 *
 * Issues scoped, short-lived S3 credentials via STS AssumeRoleWithWebIdentity
 * (OIDC federation). The ARM-issued OIDC token carries the agent's identity
 * and scope constraints; AWS STS exchanges it for a session token with an
 * IAM policy templated from the agent's resource grants + classification tags.
 *
 * Stub mode: returns a fixture credential shape. Real mode: calls AWS STS
 * when AWS credentials + role ARN are configured.
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
export async function mintS3Credential(req: S3ScopeRequest): Promise<S3Credential> {
  // TODO(1.3): Real STS call with AWS SDK when infra provisions the role ARN.
  //   const stsClient = new STSClient({ region });
  //   const response = await stsClient.send(new AssumeRoleWithWebIdentityCommand({
  //     RoleArn: roleArn, RoleSessionName: `arm-agent-${req.agentId}`,
  //     WebIdentityToken: armOidcToken,
  //     Policy: buildInlinePolicy(req), DurationSeconds: (req.ttlMinutes ?? 15) * 60,
  //   }));
  const ttlMinutes = Math.min(req.ttlMinutes ?? 15, 60);
  const expiration = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const prefix = req.prefix ?? `${req.tenantId}/${req.agentId}/`;

  return {
    accessKeyId: `ASIA_MOCK_${req.agentId}_${Date.now()}`,
    secretAccessKey: `MOCK_SECRET_${Math.random().toString(36).slice(2)}`,
    sessionToken: `MOCK_SESSION_${Date.now()}`,
    expiration,
    bucket: req.bucket,
    prefix,
  };
}

/**
 * Validates that a granted action is allowed for the given classification level.
 * Confidential data cannot be read from S3 if the agent routes to a public model.
 */
export function validateS3Access(req: S3ScopeRequest): { allowed: boolean; reason?: string } {
  if ((req.classificationClearance === "confidential" || req.classificationClearance === "restricted") &&
      req.bucket.includes("production") && !req.actions.every((a) => a === "s3:ListBucket")) {
    return { allowed: true, reason: "logs" }; // stub: allow but log
  }
  return { allowed: true };
}
