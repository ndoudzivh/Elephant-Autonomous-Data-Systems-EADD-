# ============================================================
# EADPA Terraform Outputs
# ============================================================

output "frontend_url" {
  description = "CloudFront URL for the EADPA frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "backend_url" {
  description = "Lambda Function URL for the backend API"
  value       = aws_lambda_function_url.backend.function_url
}

output "s3_frontend_bucket" {
  description = "S3 bucket for frontend static files"
  value       = aws_s3_bucket.frontend.id
}

output "s3_artifacts_bucket" {
  description = "S3 bucket for pipeline artifacts"
  value       = aws_s3_bucket.artifacts.id
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    conversations = aws_dynamodb_table.conversations.name
    pipelines     = aws_dynamodb_table.pipelines.name
    executions    = aws_dynamodb_table.executions.name
  }
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.backend.function_name
}
