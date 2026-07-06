# ============================================================
# EADPA Terraform Variables
# ============================================================

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID for Claude"
  type        = string
  default     = "anthropic.claude-sonnet-4-20250514"
}

variable "bedrock_region" {
  description = "AWS region where Bedrock is available"
  type        = string
  default     = "us-east-1"
}
