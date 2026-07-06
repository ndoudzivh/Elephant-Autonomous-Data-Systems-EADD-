/**
 * @eadpa/compiler-aws
 *
 * AWS Compiler Backend - Phase 1 target.
 * Generates: Glue ETL (PySpark), S3 layouts (Iceberg/Delta),
 * Athena DDL, Step Functions workflows, Lambda functions.
 */

export { AWSCompiler } from './aws-compiler';
export { GlueETLGenerator } from './generators/glue-etl';
export { S3LayoutGenerator } from './generators/s3-layout';
export { StepFunctionsGenerator } from './generators/step-functions';
export { AthenaGenerator } from './generators/athena';
export { LambdaGenerator } from './generators/lambda';
export { TerraformGenerator } from './generators/terraform';
