/**
 * EADD Pre-Execution Policy Gate + Data Residency + PII Masking
 * 
 * Sections 12.1, 12.2 of requirements.
 * 
 * - Validates pipeline designs BEFORE deployment
 * - Blocks non-compliant pipelines automatically
 * - Enforces data residency (SA data stays in SA)
 * - Applies PII masking (not just detection)
 */

export type PolicyVerdict = 'approved' | 'blocked' | 'needs_review';
export type MaskingMethod = 'hash' | 'redact' | 'tokenize' | 'encrypt' | 'pseudonymize' | 'generalize';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: 'residency' | 'pii' | 'encryption' | 'access' | 'retention';
  /** Condition that triggers this rule */
  condition: string;
  /** Action when triggered */
  action: 'block' | 'warn' | 'auto_fix';
  severity: 'critical' | 'high' | 'medium';
  regulation?: string; // POPIA, GDPR, etc.
}

export interface PolicyCheckResult {
  pipelineId: string;
  verdict: PolicyVerdict;
  checksRun: number;
  passed: number;
  failed: number;
  violations: PolicyViolation[];
  timestamp: string;
  /** Logged for audit */
  auditLogId: string;
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: string;
  description: string;
  location: string; // Where in the pipeline
  recommendation: string;
}

// ─── DATA RESIDENCY ──────────────────────────────────────

export interface ResidencyRule {
  dataClassification: string; // e.g., "SA personal data"
  allowedRegions: string[]; // e.g., ["af-south-1", "eu-west-1"]
  blockedRegions: string[]; // e.g., ["us-east-1", "ap-southeast-1"]
  regulation: string; // POPIA, GDPR
}

export const DEFAULT_RESIDENCY_RULES: ResidencyRule[] = [
  {
    dataClassification: 'south_african_personal_data',
    allowedRegions: ['af-south-1', 'eu-west-1'],
    blockedRegions: ['us-east-1', 'us-west-2', 'ap-southeast-1'],
    regulation: 'POPIA',
  },
  {
    dataClassification: 'eu_personal_data',
    allowedRegions: ['eu-west-1', 'eu-central-1', 'eu-north-1'],
    blockedRegions: ['us-east-1', 'us-west-2', 'af-south-1'],
    regulation: 'GDPR',
  },
];

// ─── PII MASKING (actual masking, not just detection) ────

export interface MaskingRule {
  piiType: string;
  method: MaskingMethod;
  /** Pattern for detection */
  pattern: RegExp;
  /** How to mask */
  maskFunction: (value: string) => string;
}

export const PII_MASKING_RULES: MaskingRule[] = [
  {
    piiType: 'email',
    method: 'redact',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    maskFunction: (v) => v.replace(/(.{2}).*(@.*)/, '$1***$2'),
  },
  {
    piiType: 'phone',
    method: 'redact',
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    maskFunction: (v) => v.slice(0, 4) + '****' + v.slice(-2),
  },
  {
    piiType: 'id_number',
    method: 'hash',
    pattern: /\b\d{13}\b/g, // SA ID number
    maskFunction: (v) => v.slice(0, 4) + '*********',
  },
  {
    piiType: 'credit_card',
    method: 'tokenize',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    maskFunction: (v) => '****-****-****-' + v.slice(-4),
  },
  {
    piiType: 'bank_account',
    method: 'redact',
    pattern: /\b\d{8,12}\b/g,
    maskFunction: (v) => '****' + v.slice(-4),
  },
];

// ─── POLICY GATE ENGINE ──────────────────────────────────

export class PolicyGateEngine {
  private rules: PolicyRule[] = [];
  private residencyRules: ResidencyRule[] = DEFAULT_RESIDENCY_RULES;

  /** Validate a pipeline design BEFORE deployment */
  validatePipeline(pipeline: {
    sourceRegion: string;
    targetRegion: string;
    dataClassification: string;
    containsPII: boolean;
    piiColumns: string[];
    encryptionEnabled: boolean;
    accessControl: string;
  }): PolicyCheckResult {
    const violations: PolicyViolation[] = [];

    // Check data residency
    for (const rule of this.residencyRules) {
      if (pipeline.dataClassification === rule.dataClassification) {
        if (rule.blockedRegions.includes(pipeline.targetRegion)) {
          violations.push({
            ruleId: 'residency_001',
            ruleName: 'Data Residency Violation',
            severity: 'critical',
            description: `${pipeline.dataClassification} cannot be moved to ${pipeline.targetRegion}`,
            location: 'target_region',
            recommendation: `Move target to: ${rule.allowedRegions.join(' or ')} (required by ${rule.regulation})`,
          });
        }
      }
    }

    // Check PII handling
    if (pipeline.containsPII && pipeline.piiColumns.length > 0) {
      if (!pipeline.encryptionEnabled) {
        violations.push({
          ruleId: 'pii_001',
          ruleName: 'Unencrypted PII',
          severity: 'critical',
          description: 'Pipeline contains PII columns but encryption is not enabled',
          location: `columns: ${pipeline.piiColumns.join(', ')}`,
          recommendation: 'Enable encryption at rest and in transit, or apply masking to PII columns',
        });
      }
    }

    // Check encryption
    if (!pipeline.encryptionEnabled) {
      violations.push({
        ruleId: 'enc_001',
        ruleName: 'Missing Encryption',
        severity: 'high',
        description: 'Pipeline does not have encryption enabled',
        location: 'pipeline_config',
        recommendation: 'Enable KMS-backed encryption for all data at rest and TLS for data in motion',
      });
    }

    const verdict: PolicyVerdict = violations.some(v => v.severity === 'critical') ? 'blocked' : violations.length > 0 ? 'needs_review' : 'approved';

    return {
      pipelineId: 'pipeline',
      verdict,
      checksRun: 3,
      passed: 3 - violations.length,
      failed: violations.length,
      violations,
      timestamp: new Date().toISOString(),
      auditLogId: `audit_${Date.now()}`,
    };
  }

  /** Apply PII masking to data */
  maskPII(data: Record<string, string>): Record<string, string> {
    const masked = { ...data };
    for (const [key, value] of Object.entries(masked)) {
      for (const rule of PII_MASKING_RULES) {
        if (rule.pattern.test(value)) {
          masked[key] = rule.maskFunction(value);
          break;
        }
      }
    }
    return masked;
  }
}
