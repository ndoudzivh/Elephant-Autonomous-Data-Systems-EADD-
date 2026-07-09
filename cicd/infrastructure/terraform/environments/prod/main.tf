# ============================================================
# EADD Production Environment
# Full multi-cloud deployment
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws       = { source = "hashicorp/aws"; version = "~> 5.0" }
    azurerm   = { source = "hashicorp/azurerm"; version = "~> 3.0" }
    snowflake = { source = "Snowflake-Labs/snowflake"; version = "~> 0.87" }
    databricks = { source = "databricks/databricks"; version = "~> 1.40" }
  }
}

variable "environment" { default = "production" }

provider "aws" {
  region = "us-east-1"
  default_tags { tags = { Environment = "production", Project = "eadd" } }
}

provider "azurerm" { features {} }
provider "snowflake" {}
provider "databricks" {}

# ─── All Platform Modules ───────────────────────────────
module "aws" {
  source       = "../../modules/aws"
  environment  = var.environment
  glue_workers = 10
  lambda_memory = 2048
}

module "azure" {
  source      = "../../modules/azure"
  environment = var.environment
}

module "snowflake" {
  source         = "../../modules/snowflake"
  environment    = var.environment
  warehouse_size = "MEDIUM"
}

module "databricks" {
  source      = "../../modules/databricks"
  environment = var.environment
}

# ─── Outputs ────────────────────────────────────────────
output "aws_data_lake" { value = module.aws.data_lake_bucket }
output "azure_storage" { value = module.azure.storage_account_name }
output "snowflake_wh" { value = module.snowflake.warehouse_name }
output "databricks_cluster" { value = module.databricks.cluster_id }
