output "data_plane_role_arn" {
  description = "IAM role the data-plane pods assume via IRSA."
  value       = aws_iam_role.arm_data_plane.arn
}

output "service_account" {
  description = "Namespaced ServiceAccount the trust policy pins, as system:serviceaccount:<ns>:<name>."
  value       = "system:serviceaccount:${var.namespace}:${local.service_account}"
}

output "oidc_provider_arn" {
  description = "Cluster OIDC provider the trust policy federates to. If this looks wrong, IRSA is not set up on the cluster."
  value       = local.oidc_provider_arn
}

output "helm_release_status" {
  description = "Status of the arm-data-plane release."
  value       = helm_release.arm_data_plane.status
}
