# ARM Data Plane — Terraform Module (spec §9 1.2)
# Deploys the ARM data plane into a customer VPC (AWS).
#
# Creates an IRSA role for the data plane and a helm_release installing
# ../helm/arm-data-plane. It does NOT create the EKS cluster: `cluster_name`
# names one that must already exist, with its IAM OIDC provider registered and
# the `helm` provider configured against it.
#
# Usage from a root module:
#
#   provider "aws" { region = "us-east-1" }
#   provider "helm" {
#     kubernetes { config_path = "~/.kube/config" }
#   }
#
#   module "arm_data_plane" {
#     source            = "./infra/terraform"
#     cluster_name      = "acme-prod"
#     tenant_id         = "d9d9d9d9-0000-4000-8000-000000000001"
#     control_plane_url = "https://control.arm.acme.com"
#     s3_bucket_arns    = ["arn:aws:s3:::acme-agent-data"]
#   }
#
# See ../README.md for what this still does not do.

data "aws_caller_identity" "current" {}

data "aws_eks_cluster" "this" {
  name = var.cluster_name
}

locals {
  # IRSA keys off the cluster's OIDC ISSUER host, not its name. The previous
  # version built both the principal and the condition key from
  # `var.cluster_name`, producing a trust policy that no token could ever
  # satisfy — the role was creatable and permanently unassumable.
  oidc_issuer_host  = replace(data.aws_eks_cluster.this.identity[0].oidc[0].issuer, "https://", "")
  oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.oidc_issuer_host}"

  # Must match the ServiceAccount the Helm chart creates. Pinned on both sides
  # from the same variable so they cannot drift apart.
  service_account = var.release_name
}

# ── IAM role the data-plane pods assume via IRSA ──
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_host}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${local.service_account}"]
    }

    # Without the audience condition the role is assumable by any projected
    # token from this cluster, not just ones minted for STS.
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "arm_data_plane" {
  name               = "arm-data-plane-${var.tenant_id}"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

# ── Observability: metrics and logs ──
data "aws_iam_policy_document" "observability" {
  statement {
    effect    = "Allow"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"] # PutMetricData does not support resource-level permissions.

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["ARM/DataPlane"]
    }
  }

  statement {
    effect  = "Allow"
    actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/arm/data-plane/*",
    ]
  }
}

resource "aws_iam_role_policy" "observability" {
  name   = "arm-data-plane-observability"
  role   = aws_iam_role.arm_data_plane.id
  policy = data.aws_iam_policy_document.observability.json
}

# ── S3 connector federation (only when buckets are named) ──
data "aws_iam_policy_document" "s3" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = [for arn in var.s3_bucket_arns : "${arn}/*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = var.s3_bucket_arns
  }
}

resource "aws_iam_role_policy" "s3" {
  count  = length(var.s3_bucket_arns) > 0 ? 1 : 0
  name   = "arm-data-plane-s3"
  role   = aws_iam_role.arm_data_plane.id
  policy = data.aws_iam_policy_document.s3[0].json
}

# ── Helm release ──
#
# The chart creates the ServiceAccount, annotated with the role ARN. The
# previous version created a `kubernetes_service_account` here as well, so
# both this module and the chart would have managed the same object.
resource "helm_release" "arm_data_plane" {
  name             = var.release_name
  namespace        = var.namespace
  create_namespace = true
  chart            = var.chart_version == null ? "${path.module}/../helm/arm-data-plane" : "arm-data-plane"
  version          = var.chart_version

  set {
    name  = "controlPlane.url"
    value = var.control_plane_url
  }
  set {
    name  = "controlPlane.tenantId"
    value = var.tenant_id
  }
  set {
    name  = "serviceAccount.name"
    value = local.service_account
  }
  set {
    # Dots in the annotation key are escaped so Helm reads it as one key
    # rather than a nested path.
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.arm_data_plane.arn
  }
}
