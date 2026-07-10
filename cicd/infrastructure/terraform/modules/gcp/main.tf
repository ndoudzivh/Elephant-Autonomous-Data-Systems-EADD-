# ============================================================
# EADD GCP Infrastructure Module
# Platform Abstraction: Storage (GCS/BigQuery), Processing (Dataflow),
#   Query (BigQuery), Orchestration (Cloud Composer)
# ============================================================

variable "environment" { type = string }
variable "project" { type = string; default = "eadd" }
variable "region" { type = string; default = "us-central1" }

locals {
  prefix = "${var.project}-${var.environment}"
}

# Storage: Cloud Storage bucket
resource "google_storage_bucket" "data_lake" {
  name     = "${local.prefix}-data-lake"
  location = var.region
  storage_class = "STANDARD"
  versioning { enabled = true }
  lifecycle_rule {
    condition { age = 90 }
    action { type = "SetStorageClass"; storage_class = "NEARLINE" }
  }
}

# Query: BigQuery dataset
resource "google_bigquery_dataset" "bronze" {
  dataset_id = "${replace(local.prefix, "-", "_")}_bronze"
  location   = var.region
}

resource "google_bigquery_dataset" "silver" {
  dataset_id = "${replace(local.prefix, "-", "_")}_silver"
  location   = var.region
}

resource "google_bigquery_dataset" "gold" {
  dataset_id = "${replace(local.prefix, "-", "_")}_gold"
  location   = var.region
}

# Orchestration: Cloud Composer (managed Airflow)
resource "google_composer_environment" "orchestration" {
  name   = "${local.prefix}-composer"
  region = var.region
  config {
    software_config {
      image_version = "composer-2.9.0-airflow-2.9.0"
    }
    node_config {
      service_account = google_service_account.composer.email
    }
  }
}

# Service Account
resource "google_service_account" "composer" {
  account_id   = "${local.prefix}-composer-sa"
  display_name = "EADD Composer Service Account"
}

# Outputs
output "data_lake_bucket" { value = google_storage_bucket.data_lake.name }
output "bigquery_gold" { value = google_bigquery_dataset.gold.dataset_id }
