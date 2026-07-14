/**
 * EADD Security & Governance Gate
 * 
 * Prevents disasters. Every pipeline passes through this
 * BEFORE execution. No exceptions.
 * 
 * Rules:
 * - No DROP / TRUNCATE unless explicitly approved
 * - No full table overwrite unless approved
 * - Only allowed S3 buckets
 * - Log everything for audit trail
 */

'use strict';

const ALLOWED_BUCKETS = [
  'eadd-*-data-lake',
  'eadd-*-scripts',
  'eadd-*-config',
];


const BLOCKED_OPERATIONS = [
  { pattern: /DROP\s+(TABLE|DATABASE|SCHEMA)/gi, action: 'block', reason: 'Destructive DDL' },
  { pattern: /TRUNCATE\s+TABLE/gi, action: 'block', reason: 'Data wipe' },
  { pattern: /DELETE\s+FROM\s+\w+\s*(?:;|$)/gim, action: 'block', reason: 'Unbounded DELETE' },
  { pattern: /GRANT\s+ALL/gi, action: 'block', reason: 'Over-permissive grant' },
  { pattern: /ALTER\s+TABLE.*DROP\s+COLUMN/gi, action: 'warn', reason: 'Column removal is destructive' },
  { pattern: /INSERT\s+OVERWRITE/gi, action: 'warn', reason: 'Full overwrite — prefer MERGE' },
  { pattern: /rm\s+-rf/gi, action: 'block', reason: 'Filesystem wipe' },
  { pattern: /os\.system\(|subprocess\.call\(/gi, action: 'block', reason: 'Shell execution' },
  { pattern: /eval\(|exec\(/g, action: 'block', reason: 'Dynamic code execution' },
];

// Audit log (in production: DynamoDB or CloudWatch)
const auditLog = [];

/**
 * Run the security gate on a pipeline.
 * @returns {{ approved: boolean, violations: Object[], warnings: Object[], audit_id: string }}
 */
function securityGate(pipeline, userId = 'anonymous', approvals = []) {
  const { code, pipeline_name, inputs = [], outputs = [] } = pipeline;
  const violations = [];
  const warnings = [];

  // 1. Check for blocked operations
  for (const rule of BLOCKED_OPERATIONS) {
    if (rule.pattern.test(code)) {
      rule.pattern.lastIndex = 0;
      const entry = { rule: rule.reason, action: rule.action, pattern: rule.pattern.source };

      if (rule.action === 'block') {
        // Check if explicitly approved
        if (approvals.includes(rule.reason)) {
          warnings.push({ ...entry, overridden: true, approved_by: userId });
        } else {
          violations.push(entry);
        }
      } else {
        warnings.push(entry);
      }
    }
    rule.pattern.lastIndex = 0;
  }

  // 2. Validate S3 bucket access
  for (const path of [...inputs, ...outputs]) {
    if (path.startsWith('s3://')) {
      const bucket = path.split('/')[2];
      if (!isAllowedBucket(bucket)) {
        violations.push({
          rule: 'unauthorized_bucket',
          action: 'block',
          details: `Bucket "${bucket}" not in allowed list`,
        });
      }
    }
  }

  // 3. Check for hardcoded credentials
  const credPatterns = [
    /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*["'][^"']+/i,
    /(?:password|secret|token)\s*=\s*["'][A-Za-z0-9+/=]{16,}/i,
  ];
  for (const p of credPatterns) {
    if (p.test(code)) {
      violations.push({
        rule: 'hardcoded_credentials',
        action: 'block',
        details: 'Credentials must use Secrets Manager or env vars',
      });
    }
  }

  // 4. Create audit entry
  const auditEntry = {
    audit_id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    user_id: userId,
    pipeline_name,
    approved: violations.length === 0,
    violations: violations.length,
    warnings: warnings.length,
  };
  auditLog.push(auditEntry);

  return {
    approved: violations.length === 0,
    violations,
    warnings,
    audit_id: auditEntry.audit_id,
    summary: violations.length === 0
      ? `✅ Security gate PASSED. ${warnings.length} warnings.`
      : `❌ BLOCKED: ${violations.length} security violations. Fix before execution.`,
  };
}

function isAllowedBucket(bucket) {
  return ALLOWED_BUCKETS.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(bucket);
  });
}

function getAuditLog(limit = 50) {
  return auditLog.slice(-limit);
}

module.exports = { securityGate, getAuditLog, ALLOWED_BUCKETS };
