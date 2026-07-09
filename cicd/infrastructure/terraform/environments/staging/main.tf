# ============================================================
# EADD Staging Environment
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws"; version = "~> 5.0" }
  }
}

variable "environment" { default = "staging" }

provider "aws" {
  region = "us-east-1"
  default_tags { tags = { Environment = "staging", Project = "eadd" } }
}

module "aws" {
  source       = "../../modules/aws"
  environment  = var.environment
  glue_workers = 4
  lambda_memory = 1024
}

output "aws_data_lake" { value = module.aws.data_lake_bucket }
