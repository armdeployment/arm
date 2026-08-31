terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Previously undeclared while `helm_release` was already in use, which left
    # the provider version floating: Helm provider 3.x changed `set` from a
    # block to an attribute, so an unpinned install would have broken on a
    # major bump rather than at a version anyone chose.
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
}
