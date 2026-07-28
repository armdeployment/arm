# ARM Data Plane — Terraform Module (spec §9 1.2)
# Deploys the ARM data plane into a customer VPC (AWS).
# Creates IAM role for S3 federation + EKS cluster targeting the Helm chart.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "region" { type = string, default = "us-east-1" }
variable "cluster_name" { type = string }
variable "tenant_id" { type = string }
variable "control_plane_url" { type = string }

# ── IAM Role for ARM data-plane S3 connector federation ──
resource "aws_iam_role" "arm_data_plane" {
  name = "arm-data-plane-${var.tenant_id}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${var.cluster_name}" }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = { "${var.cluster_name}:sub" = "system:serviceaccount:arm:arm-data-plane" } }
    }]
  })
}

resource "aws_iam_role_policy" "arm_data_plane_metrics" {
  name = "arm-data-plane-metrics"
  role = aws_iam_role.arm_data_plane.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*" },
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "*" },
    ]
  })
}

data "aws_caller_identity" "current" {}

# ── EKS Service Account (for IRSA) ──
resource "kubernetes_service_account" "arm_data_plane" {
  metadata {
    name      = "arm-data-plane"
    namespace = "arm"
    annotations = { "eks.amazonaws.com/role-arn" = aws_iam_role.arm_data_plane.arn }
  }
}

# ── Helm Release ──
resource "helm_release" "arm_data_plane" {
  name      = "arm-data-plane"
  namespace = "arm"
  chart     = "${path.module}/../helm/arm-data-plane"

  set {
    name  = "controlPlane.url"
    value = var.control_plane_url
  }
  set {
    name  = "controlPlane.tenantId"
    value = var.tenant_id
  }
}

output "data_plane_role_arn" { value = aws_iam_role.arm_data_plane.arn }
