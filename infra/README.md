# Infrastructure

What each directory here is, and — more importantly — **how finished it
is**. ARM is pre-1.0, and the deployment story is the least finished part
of it. Nothing below is padded to look more complete than it is.

Read [SECURITY.md](../SECURITY.md) before deploying anywhere real, and
[docs/sso-setup.md](../docs/sso-setup.md) before exposing anything. The
short version: ARM verifies IdP bearer tokens once you configure an issuer,
and refuses every authenticated request under `NODE_ENV=production` until
you do. It does not run the browser login flow that obtains a token, so put
a reverse proxy that does in front of it.

## Status at a glance

| Piece                                | State     | Use it for                                                |
| ------------------------------------ | --------- | --------------------------------------------------------- |
| `compose/docker-compose.dev-db.yml`  | **Works** | Local Postgres + ClickHouse for development               |
| `compose/docker-compose.sandbox.yml` | **Works** | The full local sandbox: ollama, proxy, gateway, dashboard |
| `compose/docker-compose.yml`         | **Works** | Just the two data-plane services, built from source       |
| `docker/*.Dockerfile`                | **Works** | Images the compose files build                            |
| `helm/arm-data-plane`                | **Works** | Installs proxy + gateway with Services, HPA, PVC, ingress |
| `helm/arm-control-plane`             | **Works** | Dashboard + onboarding + the schema migration job         |
| `terraform/`                         | **Works** | IRSA role + the Helm release; expects an existing cluster |

## Local development

Postgres and ClickHouse for running against real databases (the root
README's "Running against real infrastructure" section drives these):

```bash
docker compose -f infra/compose/docker-compose.dev-db.yml up -d
```

Postgres lands on `5432`, ClickHouse on `8123`.

The two data-plane services, built from source:

```bash
docker compose -f infra/compose/docker-compose.yml up --build
```

If you only want them running without Docker, that's `make dev-data-plane`
from the repo root — proxy on `8787`, artifact cache on `8788`, both with
a `/health` endpoint.

## The sandbox

`compose/docker-compose.sandbox.yml` brings up ollama, the open gateway,
the closed proxy and the control-plane dashboard together, so simulated
employees can make real (local) LLM calls through real metering:

```bash
docker compose -f infra/compose/docker-compose.sandbox.yml up
```

There is a second, non-identical `docker-compose.sandbox.yml` at the repo
root, driven by `scripts/sandbox/start.sh`. If you're following the root
README's sandbox section, use that script rather than this file.

## Helm chart

```bash
helm install arm-data-plane infra/helm/arm-data-plane \
  --namespace arm --create-namespace \
  --set controlPlane.url=https://control.arm.example.com \
  --set controlPlane.tenantId=<tenant-uuid>
```

That renders seven objects: a ServiceAccount, Deployments and Services for
the closed proxy and the open gateway, an HPA for the proxy, and a PVC for
the meter buffer. `ingress.enabled=true` adds an Ingress;
`serviceMonitor.enabled=true` adds a ServiceMonitor (and fails the install
with a clear message if the Prometheus Operator CRDs are absent).

`controlPlane.url` and `controlPlane.tenantId` are `required` rather than
defaulted — a proxy that starts with an empty control-plane URL reports
healthy and meters nothing, which is the worst way for a metering boundary
to fail.

**Until 2026-08-31 this chart rendered nothing at all.** The single
`deployment-proxy.yaml` referenced `arm-data-plane.fullname` and
`arm-data-plane.labels`, and there was no `_helpers.tpl` defining either,
so `helm template` failed on the first line that used one. The description
in this file — "renders a single proxy Deployment" — was optimistic.

Two honest caveats:

- **The chart is verified by rendering, not by running.** `helm lint`
  passes, and every values permutation renders manifests that pass
  `kubeconform -strict`. It has not been applied to a live cluster,
  because the images it names (`arm/closed-proxy`, `arm/open-gateway`)
  are not published anywhere — build and push them from
  `docker/*.Dockerfile` first, then override `image.repository`.
- **The meter-agent now runs** (2026-09-01) and the chart deploys it:
  `deployment-meter-agent.yaml`, a ClusterIP Service, and the buffer PVC,
  which moved off the proxy. That claim is ReadWriteOnce and used to be
  mounted on the proxy Deployment — which autoscales 2-10, so every replica
  past the first would have failed to attach. The meter-agent is one replica
  with a `Recreate` strategy for exactly that reason.

## Control-plane chart

```bash
helm install arm-control-plane infra/helm/arm-control-plane \
  --namespace arm --create-namespace
```

That is fixture mode: two Deployments (the manager dashboard on 3100 and the
employee onboarding app on 3300), their Services, and a ServiceAccount. No
database, nothing migrated — the same zero-configuration first look the repo
defaults to everywhere else.

For real data, point it at a Secret holding the two connection strings:

```bash
kubectl -n arm create secret generic arm-db \
  --from-literal=DATABASE_URL='postgres://…' \
  --from-literal=CLICKHOUSE_URL='http://…'

helm install arm-control-plane infra/helm/arm-control-plane \
  --namespace arm --create-namespace \
  --set fixtureMode=false --set database.secretName=arm-db
```

The two apps are separate Deployments on purpose. Onboarding also serves
**public** setup-token redemption — a brand-new machine presents the signed
token as its own credential — so it sits at a different trust level than the
dashboard and is often exposed to a different network.

**The migration Job closes the "applied by hand" gap.** With
`fixtureMode=false` it runs as a `pre-install,pre-upgrade` hook, so the schema
is applied before the apps roll out and a failure blocks the release rather
than surfacing as per-request errors afterwards. It runs the same scripts the
root README documents for local development, because a migration path that
diverges from the one developers actually run is one nobody has tested. Its
entrypoint is `set -e` and refuses to start with either URL missing — a hook
that half-migrates and exits 0 is worse than no hook. `migrate.seed=true` adds
the demo tenant's fixtures; leave it off for anything holding real data.

Two CronJobs run the scheduled workers (`arm/workers`), daily and hourly.
`adoption_rollup` does real work; the provider usage-pull and reconciliation
jobs report `skipped` with the reason until Anthropic/OpenAI Admin API
credentials exist, rather than reporting success for doing nothing. Both use
`concurrencyPolicy: Forbid` — two concurrent runs would process the same
tenants twice, and the jobs are not idempotent against a provider's usage API.

Identity is passed through to both apps, and the images set
`NODE_ENV=production`, so with no `oidc.*` configured they **refuse** every
authenticated request rather than serving one shared identity.
`NOTES.txt` says so at install time, along with warnings for the two secrets
that quietly break things when missing: an unset setup-token secret means
anyone can mint an agent install, and an unset ingest token means the data
plane's metering is rejected and spend silently reads zero.

Same caveat as the data-plane chart: verified by rendering, not by running.
`helm lint` passes and ten values permutations render manifests that pass
`kubeconform -strict`, but nothing has been applied to a live cluster because
the images are not published anywhere. The migration entrypoint itself _has_
been run for real, against local Postgres and ClickHouse.

## Terraform

A module, not a root module — no provider blocks, so configure `aws` and
`helm` in the configuration that calls it:

```hcl
module "arm_data_plane" {
  source            = "./infra/terraform"
  cluster_name      = "acme-prod"
  tenant_id         = "d9d9d9d9-0000-4000-8000-000000000001"
  control_plane_url = "https://control.arm.acme.com"
  s3_bucket_arns    = ["arn:aws:s3:::acme-agent-data"]
}
```

It creates an IRSA role for the data plane and a `helm_release` installing
the chart above. It does **not** create a cluster: `cluster_name` must name
an existing EKS cluster whose IAM OIDC provider is already registered.

**Until 2026-08-31 this did not parse.** `variable "region" { type =
string, default = "us-east-1" }` is a syntax error — HCL block bodies take
one argument per line, not comma-separated ones — so nothing here had ever
run. Three further defects were fixed on the way to `tofu validate`
passing:

- The IRSA trust policy federated to
  `oidc-provider/${var.cluster_name}` and conditioned on
  `${var.cluster_name}:sub`. IRSA keys off the cluster's OIDC **issuer
  host**, not its name, so the role was creatable and permanently
  unassumable. It now derives both from `aws_eks_cluster`, and pins
  `:aud` to `sts.amazonaws.com`.
- The module created a `kubernetes_service_account` that the Helm chart
  also creates — two owners for one object. The chart owns it now, and
  Terraform passes the role ARN through as an annotation.
- The header claimed S3 federation while the policy granted only
  CloudWatch and Logs. `s3_bucket_arns` now grants scoped `GetObject` /
  `ListBucket`, and defaults to `[]` — no buckets, no S3 access.

Verified with `tofu fmt`, `tofu init` and `tofu validate` against real
provider schemas. Not `plan`-verified: that needs AWS credentials and a
live cluster.

## What's missing

Being explicit, so nobody discovers these halfway through a rollout:

- **No published images.** Nothing pushes `arm/closed-proxy`,
  `arm/open-gateway`, `arm/meter-agent`, `arm/control-plane-web`,
  `arm/onboarding`, `arm/migrate` or `arm/workers` to a registry. Build them from
  `docker/` yourself and point `image.repository` at wherever you put them.
- **Proxy quota is per-replica.** Consumption is written through to disk so a
  restart no longer resets it, but the file is process-local. With the default
  HPA the daily cap is enforced per replica. `NOTES.txt` prints this at
  install time; a shared quota store is not built.
- **No secret management.** `ARM_SETUP_TOKEN_SECRET` and database
  credentials have no documented delivery mechanism beyond environment
  variables. See [`.env.example`](../.env.example).
- **No tenant provisioning.** Tenants and org trees come from the seeds in
  `packages/profiles`; there is no admin flow that creates one.
- **No automatic rollback.** The migration Job applies schema forward only;
  `drizzle-kit push` has no down-migration, so recovering from a bad schema
  change means restoring the database.
