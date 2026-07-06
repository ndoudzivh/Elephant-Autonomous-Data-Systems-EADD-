#!/bin/bash
# LocalStack initialization script
# Creates S3 buckets and secrets for local development

echo "Initializing LocalStack resources..."

# Create S3 buckets
awslocal s3 mb s3://eadpa-artifacts
awslocal s3 mb s3://eadpa-data-lake
awslocal s3 mb s3://eadpa-generated-code

# Create sample secret
awslocal secretsmanager create-secret \
  --name "eadpa/sample-postgres" \
  --secret-string '{"engine":"postgresql","host":"localhost","port":5432,"database":"sample_db","username":"dev_user","password":"dev_password"}'

echo "LocalStack initialization complete!"
