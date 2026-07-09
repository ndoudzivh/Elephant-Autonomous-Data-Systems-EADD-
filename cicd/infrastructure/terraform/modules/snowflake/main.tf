# ============================================================
# EADD Snowflake Infrastructure Module
# Platform Abstraction: Storage (Stages/Iceberg), Processing (Procs),
#   Query (Snowflake SQL), Orchestration (Tasks/Streams)
# ============================================================

variable "environment" { type = string }
variable "project" { type = string; default = "eadd" }
variable "warehouse_size" { type = string; default = "XSMALL" }

locals {
  prefix   = upper("${var.project}_${var.environment}")
  database = "${local.prefix}_DB"
}

# ─── Warehouse (Query Engine) ───────────────────────────
resource "snowflake_warehouse" "main" {
  name           = "${local.prefix}_WH"
  warehouse_size = var.warehouse_size
  auto_suspend   = 60
  auto_resume    = true
  comment        = "EADD ${var.environment} warehouse"
}

# ─── Database ───────────────────────────────────────────
resource "snowflake_database" "main" {
  name    = local.database
  comment = "EADD ${var.environment} database"
}

# ─── Schemas (Medallion Architecture) ───────────────────
resource "snowflake_schema" "bronze" {
  database = snowflake_database.main.name
  name     = "BRONZE"
  comment  = "Raw ingestion layer"
}

resource "snowflake_schema" "silver" {
  database = snowflake_database.main.name
  name     = "SILVER"
  comment  = "Cleansed transformation layer"
}

resource "snowflake_schema" "gold" {
  database = snowflake_database.main.name
  name     = "GOLD"
  comment  = "Business-ready aggregation layer"
}

resource "snowflake_schema" "metadata" {
  database = snowflake_database.main.name
  name     = "_METADATA"
  comment  = "Deployment and audit metadata"
}

# ─── Outputs ────────────────────────────────────────────
output "warehouse_name" { value = snowflake_warehouse.main.name }
output "database_name" { value = snowflake_database.main.name }
