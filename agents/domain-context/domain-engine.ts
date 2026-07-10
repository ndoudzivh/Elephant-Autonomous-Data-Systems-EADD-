/**
 * EADD Domain Context Engine
 * 
 * Understands industry-specific patterns and adjusts recommendations:
 * - Banking: SARB regulations, transaction data, PCI-DSS, fraud detection
 * - Retail: Demand forecasting, inventory, customer segmentation
 * - Telco: CDR processing, network events, churn prediction
 * - Healthcare: HIPAA, patient records, HL7/FHIR
 * - Manufacturing: IoT sensors, predictive maintenance
 * 
 * Section 17 of requirements.
 */

export type IndustryDomain = 'banking' | 'retail' | 'telco' | 'healthcare' | 'manufacturing' | 'insurance' | 'government' | 'general';

export interface DomainProfile {
  domain: IndustryDomain;
  name: string;
  /** Regulatory requirements */
  regulations: string[];
  /** Common data sources */
  typicalSources: string[];
  /** Common use cases */
  typicalUseCases: string[];
  /** Recommended platforms */
  recommendedPlatforms: string[];
  /** Data patterns */
  dataPatterns: DataPattern[];
  /** Security requirements */
  securityLevel: 'standard' | 'high' | 'critical';
  /** Latency requirements */
  typicalLatency: 'batch' | 'near_real_time' | 'real_time';
}

export interface DataPattern {
  name: string;
  description: string;
  modelingApproach: string;
  qualityRules: string[];
}

export const DOMAIN_PROFILES: Record<IndustryDomain, DomainProfile> = {
  banking: {
    domain: 'banking',
    name: 'Banking & Financial Services',
    regulations: ['POPIA', 'GDPR', 'PCI-DSS', 'SARB', 'Basel III', 'SOX', 'AML/KYC'],
    typicalSources: ['Core banking (Finacle/T24)', 'Card systems', 'Payment gateways', 'Bureau data (TransUnion/Experian)', 'SWIFT', 'Market data feeds'],
    typicalUseCases: ['Credit scoring', 'Fraud detection', 'Regulatory reporting', 'Customer 360', 'Risk management', 'AML monitoring'],
    recommendedPlatforms: ['Snowflake (data residency)', 'AWS (Glue + S3)', 'Databricks (ML)'],
    dataPatterns: [
      { name: 'Transaction processing', description: 'High-volume, low-latency transaction records', modelingApproach: 'Star schema with SCD2 on customer dimensions', qualityRules: ['Zero tolerance for duplicate transactions', 'Amount must be non-negative', 'Currency code must be valid ISO 4217'] },
      { name: 'Regulatory reporting', description: 'Aggregated data for SARB/Basel submissions', modelingApproach: 'Data Vault (full audit trail required)', qualityRules: ['100% completeness required', 'Cross-validation against source systems', 'Point-in-time accuracy'] },
    ],
    securityLevel: 'critical',
    typicalLatency: 'near_real_time',
  },
  retail: {
    domain: 'retail',
    name: 'Retail & E-Commerce',
    regulations: ['POPIA', 'GDPR', 'PCI-DSS'],
    typicalSources: ['POS systems', 'E-commerce platforms', 'Inventory systems', 'CRM (Salesforce)', 'Marketing (HubSpot)', 'Supply chain'],
    typicalUseCases: ['Demand forecasting', 'Customer segmentation', 'Recommendation engines', 'Inventory optimization', 'Churn prediction', 'Price optimization'],
    recommendedPlatforms: ['Snowflake + dbt (analytics)', 'Databricks (ML)', 'BigQuery (cost-effective)'],
    dataPatterns: [
      { name: 'Customer 360', description: 'Unified customer view from all touchpoints', modelingApproach: 'Kimball star schema with conformed dimensions', qualityRules: ['Deduplicate customers across channels', 'Email format validation', 'Address standardization'] },
      { name: 'Sales analytics', description: 'Transaction-level sales data', modelingApproach: 'Medallion (Bronze→Silver→Gold) with daily refresh', qualityRules: ['Revenue must reconcile to source system', 'No negative quantities', 'Valid product references'] },
    ],
    securityLevel: 'high',
    typicalLatency: 'batch',
  },
  telco: {
    domain: 'telco',
    name: 'Telecommunications',
    regulations: ['POPIA', 'RICA', 'ICASA'],
    typicalSources: ['CDR (Call Detail Records)', 'Network probes', 'CRM', 'Billing systems', 'OSS/BSS', 'Cell tower data'],
    typicalUseCases: ['Churn prediction', 'Network optimization', 'Revenue assurance', 'Fraud detection', 'Customer experience', 'Capacity planning'],
    recommendedPlatforms: ['Databricks (streaming + ML)', 'Kafka (event streaming)', 'Snowflake (analytics)'],
    dataPatterns: [
      { name: 'CDR processing', description: 'Billions of call/data records daily', modelingApproach: 'Streaming ingest → Delta Lake → aggregated marts', qualityRules: ['No duplicate CDRs', 'Call duration must be positive', 'Valid MSISDN format'] },
      { name: 'Network events', description: 'Real-time network performance data', modelingApproach: 'Streaming with windowed aggregations', qualityRules: ['Timestamp monotonically increasing', 'Cell ID must exist', 'Signal strength within valid range'] },
    ],
    securityLevel: 'high',
    typicalLatency: 'real_time',
  },
  healthcare: {
    domain: 'healthcare',
    name: 'Healthcare & Life Sciences',
    regulations: ['HIPAA', 'POPIA', 'FDA 21 CFR Part 11', 'GxP'],
    typicalSources: ['EHR/EMR systems', 'Lab systems (LIMS)', 'Pharmacy', 'Claims', 'Wearables/IoT', 'Clinical trials'],
    typicalUseCases: ['Patient 360', 'Clinical analytics', 'Drug discovery', 'Population health', 'Claims processing', 'Readmission prediction'],
    recommendedPlatforms: ['AWS (HIPAA-eligible services)', 'Snowflake (healthcare edition)', 'Databricks (ML)'],
    dataPatterns: [
      { name: 'Patient records', description: 'HL7/FHIR patient data', modelingApproach: 'Data Vault (immutable audit trail mandatory)', qualityRules: ['Patient ID must be valid', 'Dates must be logical (DOB < admission)', 'ICD-10 codes must be valid'] },
    ],
    securityLevel: 'critical',
    typicalLatency: 'near_real_time',
  },
  manufacturing: {
    domain: 'manufacturing',
    name: 'Manufacturing & Industrial',
    regulations: ['ISO 9001', 'OSHA', 'Industry 4.0 standards'],
    typicalSources: ['SCADA/PLC', 'IoT sensors', 'MES', 'ERP (SAP)', 'Quality systems', 'Supply chain'],
    typicalUseCases: ['Predictive maintenance', 'Quality control', 'Supply chain optimization', 'OEE tracking', 'Digital twin', 'Energy optimization'],
    recommendedPlatforms: ['Azure (IoT Hub + Databricks)', 'AWS (IoT Core + Timestream)', 'Databricks (ML)'],
    dataPatterns: [
      { name: 'Sensor data', description: 'High-frequency time-series from equipment', modelingApproach: 'Time-series DB + streaming aggregations', qualityRules: ['Sensor readings within physical limits', 'No gaps > threshold', 'Timestamp accuracy'] },
    ],
    securityLevel: 'standard',
    typicalLatency: 'real_time',
  },
  insurance: {
    domain: 'insurance',
    name: 'Insurance',
    regulations: ['POPIA', 'Solvency II', 'IFRS 17', 'SAM'],
    typicalSources: ['Policy admin', 'Claims', 'Underwriting', 'Actuarial models', 'Bureau data', 'Telematics'],
    typicalUseCases: ['Claims analytics', 'Fraud detection', 'Pricing optimization', 'Risk assessment', 'Regulatory reporting'],
    recommendedPlatforms: ['Snowflake (actuarial analytics)', 'Databricks (ML models)', 'AWS (cost-effective storage)'],
    dataPatterns: [],
    securityLevel: 'high',
    typicalLatency: 'batch',
  },
  government: {
    domain: 'government',
    name: 'Government & Public Sector',
    regulations: ['POPIA', 'PAIA', 'MISS (SA government)', 'Data sovereignty'],
    typicalSources: ['Citizen databases', 'Tax systems', 'Social services', 'Law enforcement', 'Land registry'],
    typicalUseCases: ['Citizen 360', 'Fraud detection', 'Service delivery optimization', 'Revenue collection', 'Planning'],
    recommendedPlatforms: ['On-premises (data sovereignty)', 'Azure Government', 'AWS GovCloud'],
    dataPatterns: [],
    securityLevel: 'critical',
    typicalLatency: 'batch',
  },
  general: {
    domain: 'general',
    name: 'General / Cross-Industry',
    regulations: ['POPIA', 'GDPR'],
    typicalSources: ['Databases', 'APIs', 'Files', 'SaaS tools'],
    typicalUseCases: ['Data warehouse', 'Reporting', 'Analytics', 'ML'],
    recommendedPlatforms: ['Snowflake + dbt', 'Databricks', 'AWS'],
    dataPatterns: [],
    securityLevel: 'standard',
    typicalLatency: 'batch',
  },
};

/** Detect domain from user context */
export function detectDomain(context: string): IndustryDomain {
  const lower = context.toLowerCase();
  if (/bank|transaction|credit|loan|finacle|swift|sarb|pci/i.test(lower)) return 'banking';
  if (/retail|ecommerce|shop|inventory|pos|customer segment/i.test(lower)) return 'retail';
  if (/telco|telecom|cdr|msisdn|cell tower|network/i.test(lower)) return 'telco';
  if (/health|patient|clinical|hipaa|hospital|pharma/i.test(lower)) return 'healthcare';
  if (/manufactur|sensor|iot|scada|plc|oee|predictive maintenance/i.test(lower)) return 'manufacturing';
  if (/insurance|claim|policy|underwrite|actuari/i.test(lower)) return 'insurance';
  if (/government|citizen|public sector|municipality/i.test(lower)) return 'government';
  return 'general';
}
