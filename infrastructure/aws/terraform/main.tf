# ============================================================
# EADPA AWS Infrastructure
# Enterprise Autonomous Data Pipeline Agent - Hosting Setup
#
# This deploys the complete EADPA application to AWS:
# - Frontend: S3 + CloudFront (static Next.js export)
# - Backend: Lambda + API Gateway (Express API)
# - Database: DynamoDB (sessions, pipelines, executions)
# - AI: Bedrock access (Claude Sonnet)
# - Storage: S3 (artifacts, generated code)
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "eadpa"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ==========================================
# DynamoDB Tables (State Store)
# ==========================================

resource "aws_dynamodb_table" "conversations" {
  name         = "eadpa-${var.environment}-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "conversation_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "conversation_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

resource "aws_dynamodb_table" "pipelines" {
  name         = "eadpa-${var.environment}-pipelines"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "workspace_id"
  range_key    = "pipeline_id"

  attribute {
    name = "workspace_id"
    type = "S"
  }

  attribute {
    name = "pipeline_id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "executions" {
  name         = "eadpa-${var.environment}-executions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pipeline_id"
  range_key    = "execution_id"

  attribute {
    name = "pipeline_id"
    type = "S"
  }

  attribute {
    name = "execution_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# ==========================================
# S3 Buckets
# ==========================================

resource "aws_s3_bucket" "artifacts" {
  bucket = "eadpa-${var.environment}-artifacts-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "frontend" {
  bucket = "eadpa-${var.environment}-frontend-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# ==========================================
# Lambda Function (Backend API)
# ==========================================

resource "aws_iam_role" "lambda_role" {
  name = "eadpa-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "eadpa-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [
          aws_dynamodb_table.conversations.arn,
          aws_dynamodb_table.pipelines.arn,
          aws_dynamodb_table.executions.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = ["arn:aws:logs:*:*:*"]
      },
    ]
  })
}

resource "aws_lambda_function" "backend" {
  filename         = "${path.module}/../dist/backend.zip"
  function_name    = "eadpa-${var.environment}-api"
  role             = aws_iam_role.lambda_role.arn
  handler          = "dist/lambda.handler"
  runtime          = "nodejs20.x"
  timeout          = 300 # 5 min for streaming responses
  memory_size      = 1024

  environment {
    variables = {
      NODE_ENV                = var.environment
      AWS_REGION_CUSTOM       = var.aws_region
      BEDROCK_MODEL_ID        = var.bedrock_model_id
      BEDROCK_REGION          = var.bedrock_region
      DYNAMODB_CONVERSATIONS  = aws_dynamodb_table.conversations.name
      DYNAMODB_PIPELINES      = aws_dynamodb_table.pipelines.name
      DYNAMODB_EXECUTIONS     = aws_dynamodb_table.executions.name
      S3_ARTIFACTS_BUCKET     = aws_s3_bucket.artifacts.id
      FRONTEND_URL            = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    }
  }
}

resource "aws_lambda_function_url" "backend" {
  function_name      = aws_lambda_function.backend.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    max_age           = 86400
  }
}

# ==========================================
# CloudFront Distribution (Frontend CDN)
# ==========================================

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket_website_configuration.frontend.website_endpoint
    origin_id   = "S3-frontend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-frontend"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA routing - serve index.html for all paths
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ==========================================
# Bedrock Model Access
# ==========================================

# Note: You need to manually enable Claude model access in the
# AWS Bedrock console before this will work.
# Go to: AWS Console → Bedrock → Model access → Request access to Claude

# ==========================================
# Data Sources
# ==========================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
