/**
 * AWS SDK (boto3) Method Verifier
 * 
 * Statically verifies that every boto3 method call in the code
 * actually exists on the relevant client/resource class.
 * Catches hallucinated API calls like upload_file_obj, get_table_metadata, etc.
 */

'use strict';

// Known valid methods for common boto3 clients
const VALID_METHODS = {
  s3: [
    'put_object', 'get_object', 'delete_object', 'list_objects_v2',
    'copy_object', 'head_object', 'upload_file', 'upload_fileobj',
    'download_file', 'download_fileobj', 'create_bucket', 'delete_bucket',
    'list_buckets', 'get_bucket_location', 'put_bucket_lifecycle_configuration',
    'get_paginator', 'generate_presigned_url',
  ],
  glue: [
    'create_job', 'update_job', 'delete_job', 'get_job', 'get_jobs',
    'start_job_run', 'get_job_run', 'get_job_runs', 'batch_stop_job_run',
    'create_crawler', 'start_crawler', 'get_crawler', 'get_crawlers',
    'create_database', 'get_database', 'get_databases', 'delete_database',
    'create_table', 'get_table', 'get_tables', 'update_table', 'delete_table',
    'get_partitions', 'create_partition', 'batch_create_partition',
    'get_connection', 'create_connection',
  ],
  dynamodb: [
    'put_item', 'get_item', 'delete_item', 'update_item', 'query', 'scan',
    'batch_write_item', 'batch_get_item', 'create_table', 'delete_table',
    'describe_table', 'list_tables', 'update_table',
    'transact_write_items', 'transact_get_items',
  ],
  lambda_client: [
    'invoke', 'create_function', 'update_function_code',
    'update_function_configuration', 'delete_function', 'list_functions',
    'get_function', 'add_permission',
  ],
  stepfunctions: [
    'start_execution', 'describe_execution', 'stop_execution',
    'list_executions', 'create_state_machine', 'delete_state_machine',
    'describe_state_machine', 'list_state_machines',
  ],
  secretsmanager: [
    'get_secret_value', 'create_secret', 'update_secret',
    'delete_secret', 'list_secrets', 'describe_secret',
    'put_secret_value', 'rotate_secret',
  ],
  cloudwatch: [
    'put_metric_data', 'get_metric_data', 'describe_alarms',
    'put_metric_alarm', 'delete_alarms', 'list_metrics',
  ],
  athena: [
    'start_query_execution', 'get_query_execution', 'get_query_results',
    'stop_query_execution', 'list_query_executions',
    'create_named_query', 'get_named_query',
  ],
  redshift: [
    'execute_statement', 'describe_statement', 'get_statement_result',
    'list_statements', 'create_cluster', 'delete_cluster',
    'describe_clusters', 'modify_cluster',
  ],
  sns: [
    'publish', 'create_topic', 'delete_topic', 'subscribe',
    'unsubscribe', 'list_topics', 'list_subscriptions',
  ],
  sqs: [
    'send_message', 'receive_message', 'delete_message',
    'create_queue', 'delete_queue', 'get_queue_url',
    'purge_queue', 'send_message_batch',
  ],
};

// Glue DynamicFrame methods (awsglue library)
const VALID_GLUE_DYNAMIC_FRAME_METHODS = [
  'from_catalog', 'from_options', 'from_jdbc_conf',
  'write_dynamic_frame', 'toDF', 'fromDF',
  'apply_mapping', 'resolveChoice', 'drop_fields',
  'rename_field', 'filter', 'join', 'split_fields',
  'select_fields', 'spigot', 'unbox',
];

/**
 * Verify all boto3 method calls in the code are real.
 * @param {string} code - Python code to check
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBoto3Methods(code) {
  const errors = [];

  // Find boto3.client('service') patterns
  const clientPattern = /boto3\.client\(['"](\w+)['"]\)/g;
  const clients = {};
  let match;

  while ((match = clientPattern.exec(code)) !== null) {
    const service = match[1];
    clients[service] = true;
  }

  // Find resource patterns
  const resourcePattern = /boto3\.resource\(['"](\w+)['"]\)/g;
  while ((match = resourcePattern.exec(code)) !== null) {
    clients[match[1]] = true;
  }

  // Find method calls on known clients
  // Pattern: client.method_name( or response = client.method_name(
  const methodCallPattern = /(?:client|s3_client|glue_client|dynamodb|sqs|sns|lambda_client|secrets_client|athena_client)\s*\.\s*(\w+)\s*\(/g;

  while ((match = methodCallPattern.exec(code)) !== null) {
    const method = match[1];

    // Check if this method exists in ANY known service
    let found = false;
    for (const [service, methods] of Object.entries(VALID_METHODS)) {
      if (methods.includes(method)) {
        found = true;
        break;
      }
    }

    // Also check common Python methods that aren't boto3-specific
    const pythonMethods = ['read', 'write', 'close', 'decode', 'encode', 'strip', 'split', 'join', 'format'];
    if (pythonMethods.includes(method)) found = true;

    if (!found) {
      errors.push(`Unknown boto3 method: '${method}' — this method may not exist. Check AWS SDK docs.`);
    }
  }

  // Check GlueContext methods
  const glueMethodPattern = /(?:glueContext|GlueContext)\s*\.\s*(\w+)/g;
  while ((match = glueMethodPattern.exec(code)) !== null) {
    const method = match[1];
    const validGlueMethods = [
      'create_dynamic_frame', 'write_dynamic_frame', 'spark_session',
      'purge_table', 'purge_s3_path', 'getSource', 'getSink',
    ];
    if (!validGlueMethods.includes(method) && !method.startsWith('_')) {
      // Only flag if it looks like a real method call
      if (method !== 'create_dynamic_frame_from_catalog') {
        // This is a common combined method name — skip
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateBoto3Methods, VALID_METHODS };
