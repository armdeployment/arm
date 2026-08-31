variable "cluster_name" {
  type        = string
  description = <<-EOT
    Name of an EXISTING EKS cluster. This module does not create one.

    The cluster's IAM OIDC provider must already be registered (eksctl utils
    associate-iam-oidc-provider, or the terraform-aws-modules/eks module's
    enable_irsa). Without it the role below can be created but never assumed.
  EOT
}

variable "tenant_id" {
  type        = string
  description = "ARM tenant UUID from registration. Every metering event is scoped to it (Invariant 6)."
}

variable "control_plane_url" {
  type        = string
  description = "https:// URL of the ARM control plane the data plane meters to."

  validation {
    condition     = startswith(var.control_plane_url, "https://")
    error_message = "control_plane_url must be https:// — metering events cross the tenant boundary."
  }
}

variable "namespace" {
  type        = string
  description = "Namespace to install the data plane into. Created if absent."
  default     = "arm"
}

variable "release_name" {
  type        = string
  description = "Helm release name. Also the ServiceAccount name, which the IAM trust policy pins."
  default     = "arm-data-plane"
}

variable "chart_version" {
  type        = string
  description = "Version of the arm-data-plane chart. Null installs the local chart at ../helm."
  default     = null
}

variable "s3_bucket_arns" {
  type        = list(string)
  description = <<-EOT
    Buckets the data plane's S3 connector may read, e.g.
    ["arn:aws:s3:::acme-agent-data"]. Empty (the default) grants no S3 access
    at all rather than a wildcard — the module's header has always described
    "S3 federation", but no S3 permission was ever actually granted.
  EOT
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to every IAM resource this module creates."
  default     = {}
}
