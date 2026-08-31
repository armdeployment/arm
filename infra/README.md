# Infrastructure

What each directory here is, and — more importantly — **how finished it
is**. ARM is pre-1.0, and the deployment story is the least finished part
of it. Nothing below is padded to look more complete than it is.

Read [SECURITY.md](../SECURITY.md) before deploying anywhere real. The
short version: there is no live OIDC verification yet, so any deployment
today is trusted-network only.

## Status at a glance

| Piece                                | State        | Use it for                                                |
| ------------------------------------ | ------------ | --------------------------------------------------------- |
| `compose/docker-compose.dev-db.yml`  | **Works**    | Local Postgres + ClickHouse for development               |
| `compose/docker-compose.sandbox.yml` | **Works**    | The full local sandbox: ollama, proxy, gateway, dashboard |
| `compose/docker-compose.yml`         | **Works**    | Just the two data-plane services, built from source       |
| `docker/*.Dockerfile`                | **Works**    | Images the compose files build                            |
| `helm/arm-data-plane`                | **Skeleton** | Reference only — renders one Deployment, see below        |
| `terraform/main.tf`                  | **Skeleton** | Reference only — expects an existing cluster, see below   |

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

## Helm chart — skeleton, read before trusting

`values.yaml` is the misleading part: it declares configuration for
`proxy`, `openGateway`, `meterAgent`, `service`, `ingress`, `persistence`,
`serviceMonitor` and `tls`, which reads like a complete chart.

`templates/` contains exactly one file:

```
templates/deployment-proxy.yaml
```

So the chart renders **a single proxy Deployment**. There is no Service,
no Ingress, no ServiceAccount, no Secret handling and no `NOTES.txt`,
despite values existing for several of them. `helm install` will not give
you a reachable, working data plane as-is.

Treat it as a starting point that captures the intended shape and the
tuning knobs (fail-closed mode, the 25 ms p50 latency budget, autoscaling
targets), not as a deployable artifact.

## Terraform — skeleton, read before trusting

`main.tf` creates the IAM role and policy for data-plane S3 federation, a
Kubernetes service account, and a `helm_release` pointing at the chart
above — which inherits that chart's incompleteness.

It does **not** create a cluster. `cluster_name` is an input variable and
the module assumes the EKS cluster already exists, along with configured
`kubernetes` and `helm` providers. Required inputs: `cluster_name`,
`tenant_id`, `control_plane_url`, and optionally `region`.

## What's missing

Being explicit, so nobody discovers these halfway through a rollout:

- **No control-plane deployment manifests.** Everything here targets the
  data plane. The control plane runs from `infra/docker/control-plane.Dockerfile`
  in the sandbox, but has no chart or production manifest.
- **No secret management.** `ARM_SETUP_TOKEN_SECRET` and database
  credentials have no documented delivery mechanism beyond environment
  variables. See [`.env.example`](../.env.example).
- **No tenant provisioning.** Tenants and org trees come from the seeds in
  `packages/profiles`; there is no admin flow that creates one.
- **No migration runner in the deploy path.** Schema is applied by the
  scripts the root README documents, by hand.
