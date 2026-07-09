# ============================================================
# EADD AWS Infrastructure Module
# Platform Abstraction: Storage (S3), Processing (Glue/Lambda),
#   Query (Athena), Orchestration (Step Functions)
# ============================================================

variable "environment" { type = string }
variable "project" { type = string; default = "eadd" }
variable "region" { type = string; default = "us-east-1" }
variable "glue_workers" { type = number; default = 2 }
variable "lambda_memory" { type = number; default = 512 }
variable "lambda_timeout" { type = number; default = 300 }

locals {
  prefix = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Platform    = "aws"
  }
}

# ─── Storage Layer: S3 ──────────────────────────────────
resource "aws_s3_bucket" "data_lake" {
  bucket = "${local.prefix}-data-lake"
  tags   = local.tags
}

resource "aws_s3_bucket" "scripts" {
  bucket = "${local.prefix}-scripts"
  tags   = local.tags
}

resource "aws_s3_bucket" "config" {
  bucket = "${local.prefix}-config"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id
  versioning_configuration { status = "Enabled" }
}

# ─── Processing Layer: Glue ─────────────────────────────
resource "aws_glue_catalog_database" "main" {
  name = "${local.prefix}_db"
}

resource "aws_iam_role" "glue_role" {
  name = "${local.prefix}-glue-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "glue.amazonaws.com" }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

# ─── Processing Layer: Lambda ───────────────────────────
resource "aws_iam_role" "lambda_role" {
  name = "${local.prefix}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_bedrock" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
}

# ─── Orchestration Layer: Step Functions ────────────────
resource "aws_iam_role" "sfn_role" {
  name = "${local.prefix}-sfn-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
    }]
  })
  tags = local.tags
}

# ─── State Store: DynamoDB ──────────────────────────────
resource "aws_dynamodb_table" "pipeline_state" {
  name         = "${local.prefix}-pipeline-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pipeline_id"
  range_key    = "version"

  attribute {
    name = "pipeline_id"
    type = "S"
  }
  attribute {
    name = "version"
    type = "S"
  }

  tags = local.tags
}

# ─── Outputs ────────────────────────────────────────────
output "data_lake_bucket" { value = aws_s3_bucket.data_lake.id }
output "scripts_bucket" { value = aws_s3_bucket.scripts.id }
output "glue_database" { value = aws_glue_catalog_database.main.name }
output "lambda_role_arn" { value = aws_iam_role.lambda_role.arn }
output "sfn_role_arn" { value = aws_iam_role.sfn_role.arn }
