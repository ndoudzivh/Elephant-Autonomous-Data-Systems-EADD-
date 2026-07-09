# ============================================================
# EADD Databricks Infrastructure Module
# Platform Abstraction: Storage (Delta/Unity Catalog),
#   Processing (Spark), Query (SQL Warehouse),
#   Orchestration (Workflows)
# ============================================================

variable "environment" { type = string }
variable "project" { type = string; default = "eadd" }

locals {
  prefix = "${var.project}-${var.environment}"
}

# ─── Cluster (Processing Engine) ────────────────────────
resource "databricks_cluster" "pipeline" {
  cluster_name            = "${local.prefix}-pipeline"
  spark_version           = "14.3.x-scala2.12"
  node_type_id            = "i3.xlarge"
  autotermination_minutes = 20
  num_workers             = 0 # Single-node for dev; scale in prod

  autoscale {
    min_workers = var.environment == "production" ? 2 : 0
    max_workers = var.environment == "production" ? 8 : 2
  }

  spark_conf = {
    "spark.databricks.delta.preview.enabled" = "true"
  }

  custom_tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# ─── SQL Warehouse (Query Engine) ───────────────────────
resource "databricks_sql_endpoint" "query" {
  name             = "${local.prefix}-sql"
  cluster_size     = "2X-Small"
  auto_stop_mins   = 10
  warehouse_type   = "PRO"

  tags {
    custom_tags {
      key   = "Environment"
      value = var.environment
    }
  }
}

# ─── Unity Catalog Schema ───────────────────────────────
resource "databricks_schema" "bronze" {
  catalog_name = "eadd_catalog"
  name         = "${var.environment}_bronze"
  comment      = "Bronze layer - raw ingestion"
}

resource "databricks_schema" "silver" {
  catalog_name = "eadd_catalog"
  name         = "${var.environment}_silver"
  comment      = "Silver layer - cleansed"
}

resource "databricks_schema" "gold" {
  catalog_name = "eadd_catalog"
  name         = "${var.environment}_gold"
  comment      = "Gold layer - business-ready"
}

# ─── Outputs ────────────────────────────────────────────
output "cluster_id" { value = databricks_cluster.pipeline.id }
output "sql_endpoint_id" { value = databricks_sql_endpoint.query.id }
