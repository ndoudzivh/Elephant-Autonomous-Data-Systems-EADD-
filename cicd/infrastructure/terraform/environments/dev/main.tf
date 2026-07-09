# ============================================================
# EADD Dev Environment - Terraform Configuration
# Instantiates platform modules for development
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws"; version = "~> 5.0" }
  }
}

variable "environment" { default = "dev" }

provider "aws" {
  region = "us-east-1"
  default_tags { tags = { Environment = "dev", Project = "eadd" } }
}

# ─── AWS Module ─────────────────────────────────────────
module "aws" {
  source      = "../../modules/aws"
  environment = var.environment
  glue_workers = 2
  lambda_memory = 512
}

output "aws_data_lake" { value = module.aws.data_lake_bucket }
output "aws_lambda_role" { value = module.aws.lambda_role_arn }
