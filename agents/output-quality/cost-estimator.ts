/**
 * EADD Pipeline Cost Estimator
 * 
 * Every pipeline solution gets a cost estimate BEFORE deployment.
 * No surprises on the cloud bill.
 * 
 * Covers: Compute, Storage, Network, Licensing, Operational overhead.
 * Currencies: USD + ZAR (South African context).
 * 
 * Section 24.1 — FinOps Integration
 */

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'databricks' | 'snowflake' | 'on_prem';
export type PricingTier = 'on_demand' | 'reserved_1yr' | 'reserved_3yr' | 'spot' | 'serverless';

export interface CostEstimate {
  /** Pipeline name */
  pipelineName: string;
  /** Cloud provider */
  provider: CloudProvider;
  /** Pricing tier used for estimate */
  pricingTier: PricingTier;
  /** Monthly cost breakdown */
  monthly: CostBreakdown;
  /** Annual projection */
  annual: CostBreakdown;
  /** Cost per GB processed */
  costPerGB: number;
  /** Cost at different scale points */
  scalingProjection: ScalingPoint[];
  /** Optimization recommendations */
  recommendations: CostRecommendation[];
  /** Comparison with alternatives */
  alternatives: AlternativeCost[];
  /** Currency */
  currency: 'USD' | 'ZAR';
  /** USD to ZAR rate used */
  exchangeRate: number;
  /** When this estimate was generated */
  estimatedAt: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Assumptions made */
  assumptions: string[];
}


export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  licensing: number;
  monitoring: number;
  total: number;
  /** Human-readable summary */
  summary: string;
}

export interface ScalingPoint {
  dataVolumeGB: number;
  monthlyCost: number;
  costPerGB: number;
  notes: string;
}

export interface CostRecommendation {
  title: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercent: number;
  effort: 'low' | 'medium' | 'high';
  description: string;
}

export interface AlternativeCost {
  provider: CloudProvider;
  monthlyCost: number;
  pros: string[];
  cons: string[];
}


// ============================================================
// PRICING DATABASE (approximate mid-2026 pricing)
// ============================================================

const USD_TO_ZAR = 18.50; // Approximate exchange rate

interface ServicePricing {
  service: string;
  unit: string;
  onDemandUSD: number;
  reservedUSD?: number;
  spotUSD?: number;
  notes: string;
}

const AWS_PRICING: ServicePricing[] = [
  { service: 'S3 Storage', unit: 'per GB/month', onDemandUSD: 0.023, notes: 'Standard tier. Glacier = $0.004/GB' },
  { service: 'S3 Requests', unit: 'per 1000 PUT', onDemandUSD: 0.005, notes: 'GET = $0.0004/1000' },
  { service: 'Glue ETL', unit: 'per DPU-hour', onDemandUSD: 0.44, notes: '1 DPU = 4 vCPU + 16GB RAM. Min 2 DPU.' },
  { service: 'Glue Crawler', unit: 'per DPU-hour', onDemandUSD: 0.44, notes: 'Runs ~2-5 min per crawl typically' },
  { service: 'Lambda', unit: 'per 1M requests', onDemandUSD: 0.20, notes: 'Plus $0.0000166667/GB-sec compute' },
  { service: 'Step Functions', unit: 'per 1000 transitions', onDemandUSD: 0.025, notes: 'Standard workflows' },
  { service: 'Athena', unit: 'per TB scanned', onDemandUSD: 5.00, notes: 'Use partitioning to reduce scan!' },
  { service: 'Redshift', unit: 'per node-hour (dc2.large)', onDemandUSD: 0.25, reservedUSD: 0.10, notes: 'Serverless = $0.375/RPU-hour' },
  { service: 'MSK (Kafka)', unit: 'per broker-hour (m5.large)', onDemandUSD: 0.21, notes: 'Plus storage at $0.10/GB/month' },
  { service: 'Kinesis', unit: 'per shard-hour', onDemandUSD: 0.015, notes: 'Plus $0.014 per 1M PUT records' },
  { service: 'Data Transfer', unit: 'per GB out', onDemandUSD: 0.09, notes: 'First 10TB/month. Intra-region = $0.01' },
  { service: 'CloudWatch', unit: 'per metric/month', onDemandUSD: 0.30, notes: 'First 10K metrics. Logs = $0.50/GB ingested' },
  { service: 'Secrets Manager', unit: 'per secret/month', onDemandUSD: 0.40, notes: 'Plus $0.05 per 10K API calls' },
];

const DATABRICKS_PRICING: ServicePricing[] = [
  { service: 'Jobs Compute', unit: 'per DBU-hour', onDemandUSD: 0.15, notes: 'All-Purpose = $0.55/DBU. Jobs are cheapest.' },
  { service: 'SQL Compute', unit: 'per DBU-hour', onDemandUSD: 0.22, notes: 'Serverless SQL warehouse' },
  { service: 'Delta Live Tables', unit: 'per DBU-hour', onDemandUSD: 0.20, reservedUSD: 0.08, notes: 'Core + Advanced tiers' },
  { service: 'Unity Catalog', unit: 'included', onDemandUSD: 0, notes: 'Included in workspace cost' },
  { service: 'Model Serving', unit: 'per DBU-hour', onDemandUSD: 0.07, notes: 'Serverless model endpoints' },
];

const SNOWFLAKE_PRICING: ServicePricing[] = [
  { service: 'Compute (XS)', unit: 'per credit', onDemandUSD: 2.00, notes: 'XS warehouse = 1 credit/hour. Auto-suspends!' },
  { service: 'Compute (S)', unit: 'per credit', onDemandUSD: 2.00, notes: 'S = 2 credits/hour' },
  { service: 'Compute (M)', unit: 'per credit', onDemandUSD: 2.00, notes: 'M = 4 credits/hour' },
  { service: 'Compute (L)', unit: 'per credit', onDemandUSD: 2.00, notes: 'L = 8 credits/hour' },
  { service: 'Storage', unit: 'per TB/month', onDemandUSD: 23.00, notes: 'Compressed. On-demand tier.' },
  { service: 'Serverless Tasks', unit: 'per credit', onDemandUSD: 2.47, notes: 'Snowpipe, tasks, etc.' },
  { service: 'Data Transfer', unit: 'per TB', onDemandUSD: 20.00, notes: 'Cross-region/cross-cloud only' },
];


// ============================================================
// THE COST ESTIMATOR ENGINE
// ============================================================

export interface PipelineProfile {
  /** Daily data volume in GB */
  dailyVolumeGB: number;
  /** Number of source tables */
  sourceTables: number;
  /** Processing frequency */
  frequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
  /** Retention period in months */
  retentionMonths: number;
  /** Does it need streaming? */
  streaming: boolean;
  /** Number of transformations */
  transformationComplexity: 'simple' | 'medium' | 'complex';
  /** Target platform */
  platform: CloudProvider;
  /** Region */
  region: string;
}

export class PipelineCostEstimator {
  private exchangeRate = USD_TO_ZAR;

  /**
   * Generate a full cost estimate for a pipeline
   */
  estimate(profile: PipelineProfile, pipelineName: string): CostEstimate {
    const monthly = this.calculateMonthlyCost(profile);
    const annual = this.multiplyBreakdown(monthly, 12);
    const scalingProjection = this.projectScaling(profile, monthly);
    const recommendations = this.generateRecommendations(profile, monthly);
    const alternatives = this.calculateAlternatives(profile);

    return {
      pipelineName,
      provider: profile.platform,
      pricingTier: 'on_demand',
      monthly,
      annual,
      costPerGB: monthly.total / (profile.dailyVolumeGB * 30),
      scalingProjection,
      recommendations,
      alternatives,
      currency: 'ZAR',
      exchangeRate: this.exchangeRate,
      estimatedAt: new Date().toISOString(),
      confidence: this.assessConfidence(profile),
      assumptions: this.listAssumptions(profile),
    };
  }

  /**
   * Format cost estimate as a readable section for the user
   */
  formatEstimate(estimate: CostEstimate): string {
    const m = estimate.monthly;
    return `
## 💰 Cost Estimate: ${estimate.pipelineName}

| Component | Monthly (ZAR) | Monthly (USD) |
|-----------|--------------|---------------|
| Compute | R${m.compute.toLocaleString()} | $${(m.compute / this.exchangeRate).toFixed(0)} |
| Storage | R${m.storage.toLocaleString()} | $${(m.storage / this.exchangeRate).toFixed(0)} |
| Network | R${m.network.toLocaleString()} | $${(m.network / this.exchangeRate).toFixed(0)} |
| Licensing | R${m.licensing.toLocaleString()} | $${(m.licensing / this.exchangeRate).toFixed(0)} |
| Monitoring | R${m.monitoring.toLocaleString()} | $${(m.monitoring / this.exchangeRate).toFixed(0)} |
| **TOTAL** | **R${m.total.toLocaleString()}** | **$${(m.total / this.exchangeRate).toFixed(0)}** |

**Annual projection**: R${estimate.annual.total.toLocaleString()} ($${(estimate.annual.total / this.exchangeRate).toFixed(0)})
**Cost per GB**: R${estimate.costPerGB.toFixed(2)}/GB

### 📈 Scaling Projection
${estimate.scalingProjection.map(s => `- At ${s.dataVolumeGB}GB/day: R${s.monthlyCost.toLocaleString()}/month (${s.notes})`).join('\n')}

### 💡 Cost Optimization Opportunities
${estimate.recommendations.map(r => `- **${r.title}**: Save R${r.savings.toLocaleString()}/month (${r.savingsPercent}%) — Effort: ${r.effort}`).join('\n')}

### 🔄 Platform Alternatives
${estimate.alternatives.map(a => `- **${a.provider}**: R${a.monthlyCost.toLocaleString()}/month — ${a.pros[0]}`).join('\n')}

> ⚠️ **Confidence**: ${estimate.confidence} | **Assumptions**: ${estimate.assumptions.slice(0, 3).join(', ')}
`;
  }


  private calculateMonthlyCost(profile: PipelineProfile): CostBreakdown {
    let compute = 0;
    let storage = 0;
    let network = 0;
    let licensing = 0;
    let monitoring = 0;

    const monthlyGB = profile.dailyVolumeGB * 30;

    switch (profile.platform) {
      case 'aws':
        // Glue ETL compute
        const glueDPUHours = this.estimateGlueDPUHours(profile);
        compute = glueDPUHours * 0.44 * this.exchangeRate;
        // S3 storage (with retention)
        storage = monthlyGB * profile.retentionMonths * 0.023 * this.exchangeRate;
        // Data transfer
        network = monthlyGB * 0.02 * this.exchangeRate;
        // CloudWatch, Secrets Manager
        monitoring = (profile.sourceTables * 0.30 + 2 * 0.40 + monthlyGB * 0.01) * this.exchangeRate;
        break;

      case 'databricks':
        // DBU hours
        const dbuHours = this.estimateDBUHours(profile);
        compute = dbuHours * 0.15 * this.exchangeRate;
        // Delta Lake storage (on cloud storage)
        storage = monthlyGB * profile.retentionMonths * 0.023 * this.exchangeRate;
        network = monthlyGB * 0.01 * this.exchangeRate;
        licensing = dbuHours * 0.05 * this.exchangeRate; // Platform fee
        monitoring = 50 * this.exchangeRate; // Basic monitoring
        break;

      case 'snowflake':
        // Credits consumed
        const credits = this.estimateSnowflakeCredits(profile);
        compute = credits * 2.00 * this.exchangeRate;
        // Storage
        storage = (monthlyGB * profile.retentionMonths / 1000) * 23 * this.exchangeRate;
        network = monthlyGB > 100 ? (monthlyGB / 1000) * 20 * this.exchangeRate : 0;
        monitoring = 30 * this.exchangeRate;
        break;

      case 'azure':
        compute = this.estimateAzureCost(profile) * this.exchangeRate;
        storage = monthlyGB * profile.retentionMonths * 0.02 * this.exchangeRate;
        network = monthlyGB * 0.02 * this.exchangeRate;
        monitoring = 40 * this.exchangeRate;
        break;

      case 'gcp':
        compute = this.estimateGCPCost(profile) * this.exchangeRate;
        storage = monthlyGB * profile.retentionMonths * 0.02 * this.exchangeRate;
        network = monthlyGB * 0.01 * this.exchangeRate;
        monitoring = 35 * this.exchangeRate;
        break;

      default:
        compute = 500 * this.exchangeRate;
        storage = monthlyGB * 0.05 * this.exchangeRate;
    }

    const total = compute + storage + network + licensing + monitoring;
    return {
      compute: Math.round(compute),
      storage: Math.round(storage),
      network: Math.round(network),
      licensing: Math.round(licensing),
      monitoring: Math.round(monitoring),
      total: Math.round(total),
      summary: `R${Math.round(total).toLocaleString()}/month (${profile.platform.toUpperCase()}, ${profile.frequency}, ${profile.dailyVolumeGB}GB/day)`,
    };
  }


  private estimateGlueDPUHours(profile: PipelineProfile): number {
    const complexityMultiplier = profile.transformationComplexity === 'simple' ? 1 : profile.transformationComplexity === 'medium' ? 2.5 : 5;
    const frequencyMultiplier = profile.frequency === 'real_time' ? 720 : profile.frequency === 'hourly' ? 720 : profile.frequency === 'daily' ? 30 : 4;
    const baseHours = Math.ceil(profile.dailyVolumeGB / 10) * 0.5; // ~0.5 hours per 10GB
    return baseHours * complexityMultiplier * frequencyMultiplier;
  }

  private estimateDBUHours(profile: PipelineProfile): number {
    const complexityMultiplier = profile.transformationComplexity === 'simple' ? 1 : profile.transformationComplexity === 'medium' ? 3 : 6;
    const frequencyRuns = profile.frequency === 'real_time' ? 720 : profile.frequency === 'hourly' ? 720 : profile.frequency === 'daily' ? 30 : 4;
    const baseDBU = Math.ceil(profile.dailyVolumeGB / 5) * 0.3;
    return baseDBU * complexityMultiplier * frequencyRuns;
  }

  private estimateSnowflakeCredits(profile: PipelineProfile): number {
    const warehouseSize = profile.dailyVolumeGB < 10 ? 1 : profile.dailyVolumeGB < 100 ? 2 : 4; // credits/hour
    const runTimeHours = profile.transformationComplexity === 'simple' ? 0.1 : profile.transformationComplexity === 'medium' ? 0.3 : 0.8;
    const runsPerMonth = profile.frequency === 'daily' ? 30 : profile.frequency === 'hourly' ? 720 : 4;
    return warehouseSize * runTimeHours * runsPerMonth;
  }

  private estimateAzureCost(profile: PipelineProfile): number {
    // ADF + Synapse approximate
    const adfRuns = profile.frequency === 'daily' ? 30 : profile.frequency === 'hourly' ? 720 : 4;
    return adfRuns * 0.50 + profile.dailyVolumeGB * 0.10;
  }

  private estimateGCPCost(profile: PipelineProfile): number {
    // Dataflow + BigQuery approximate
    const bqCost = profile.dailyVolumeGB * 30 * 5 / 1000; // $5 per TB scanned
    const dataflowCost = profile.dailyVolumeGB * 0.05 * 30;
    return bqCost + dataflowCost;
  }

  private multiplyBreakdown(monthly: CostBreakdown, months: number): CostBreakdown {
    return {
      compute: monthly.compute * months,
      storage: monthly.storage * months,
      network: monthly.network * months,
      licensing: monthly.licensing * months,
      monitoring: monthly.monitoring * months,
      total: monthly.total * months,
      summary: `R${(monthly.total * months).toLocaleString()}/year`,
    };
  }


  private projectScaling(profile: PipelineProfile, currentMonthly: CostBreakdown): ScalingPoint[] {
    const baseGB = profile.dailyVolumeGB;
    return [
      { dataVolumeGB: baseGB, monthlyCost: currentMonthly.total, costPerGB: currentMonthly.total / (baseGB * 30), notes: 'Current state' },
      { dataVolumeGB: baseGB * 2, monthlyCost: Math.round(currentMonthly.total * 1.7), costPerGB: Math.round(currentMonthly.total * 1.7) / (baseGB * 2 * 30), notes: '2x growth — sub-linear cost increase due to fixed overheads' },
      { dataVolumeGB: baseGB * 5, monthlyCost: Math.round(currentMonthly.total * 3.5), costPerGB: Math.round(currentMonthly.total * 3.5) / (baseGB * 5 * 30), notes: '5x growth — consider reserved capacity' },
      { dataVolumeGB: baseGB * 10, monthlyCost: Math.round(currentMonthly.total * 6), costPerGB: Math.round(currentMonthly.total * 6) / (baseGB * 10 * 30), notes: '10x growth — reserved + spot mix recommended' },
    ];
  }

  private generateRecommendations(profile: PipelineProfile, monthly: CostBreakdown): CostRecommendation[] {
    const recs: CostRecommendation[] = [];

    // Reserved capacity recommendation
    if (monthly.compute > 5000) {
      recs.push({
        title: 'Use Reserved/Committed Capacity',
        currentCost: monthly.compute,
        optimizedCost: Math.round(monthly.compute * 0.6),
        savings: Math.round(monthly.compute * 0.4),
        savingsPercent: 40,
        effort: 'low',
        description: '1-year reserved pricing gives ~40% discount on compute. Requires commitment but predictable workloads justify it.',
      });
    }

    // Spot instances for non-critical
    if (profile.frequency === 'daily' && monthly.compute > 2000) {
      recs.push({
        title: 'Use Spot/Preemptible Instances',
        currentCost: monthly.compute,
        optimizedCost: Math.round(monthly.compute * 0.3),
        savings: Math.round(monthly.compute * 0.7),
        savingsPercent: 70,
        effort: 'medium',
        description: 'Batch jobs that can tolerate interruption save 60-90% with spot instances. Add retry logic and checkpoint recovery.',
      });
    }

    // Storage tiering
    if (monthly.storage > 3000 && profile.retentionMonths > 6) {
      recs.push({
        title: 'Storage Lifecycle Tiering',
        currentCost: monthly.storage,
        optimizedCost: Math.round(monthly.storage * 0.4),
        savings: Math.round(monthly.storage * 0.6),
        savingsPercent: 60,
        effort: 'low',
        description: 'Move Bronze data older than 30 days to cold/archive storage (Glacier/Cool Blob). Rarely accessed historical data costs 80% less in cold tier.',
      });
    }

    // Auto-suspend (Snowflake)
    if (profile.platform === 'snowflake') {
      recs.push({
        title: 'Auto-Suspend Warehouse (1 min)',
        currentCost: monthly.compute,
        optimizedCost: Math.round(monthly.compute * 0.5),
        savings: Math.round(monthly.compute * 0.5),
        savingsPercent: 50,
        effort: 'low',
        description: 'Set AUTO_SUSPEND = 60 on all warehouses. Snowflake charges per-second, so idle warehouses cost nothing when suspended.',
      });
    }

    // Partitioning to reduce scan cost
    if (profile.platform === 'aws' && profile.dailyVolumeGB > 50) {
      recs.push({
        title: 'Partition Data by Date',
        currentCost: monthly.compute,
        optimizedCost: Math.round(monthly.compute * 0.7),
        savings: Math.round(monthly.compute * 0.3),
        savingsPercent: 30,
        effort: 'medium',
        description: 'Partitioning on date column reduces Athena scan cost (charged per TB scanned) and Glue read time significantly.',
      });
    }

    return recs;
  }


  private calculateAlternatives(profile: PipelineProfile): AlternativeCost[] {
    const alternatives: AlternativeCost[] = [];
    const monthlyGB = profile.dailyVolumeGB * 30;

    if (profile.platform !== 'snowflake') {
      const sfCredits = this.estimateSnowflakeCredits(profile);
      alternatives.push({
        provider: 'snowflake',
        monthlyCost: Math.round((sfCredits * 2 + monthlyGB * profile.retentionMonths * 0.023) * this.exchangeRate),
        pros: ['Pay-per-query (auto-suspend)', 'Zero management overhead', 'Excellent SQL performance'],
        cons: ['Vendor lock-in', 'Expensive at very high concurrency', 'Limited ML/streaming'],
      });
    }

    if (profile.platform !== 'databricks') {
      const dbuHours = this.estimateDBUHours(profile);
      alternatives.push({
        provider: 'databricks',
        monthlyCost: Math.round((dbuHours * 0.15 + monthlyGB * profile.retentionMonths * 0.023) * this.exchangeRate),
        pros: ['Unified batch + streaming', 'Best for ML workloads', 'Delta Lake included'],
        cons: ['Higher baseline cost', 'Steeper learning curve', 'Cluster startup time'],
      });
    }

    if (profile.platform !== 'aws') {
      alternatives.push({
        provider: 'aws',
        monthlyCost: Math.round((this.estimateGlueDPUHours(profile) * 0.44 + monthlyGB * profile.retentionMonths * 0.023) * this.exchangeRate),
        pros: ['Serverless (Glue)', 'Most services/integrations', 'Pay-per-use'],
        cons: ['Complex pricing', 'Many moving parts', 'Glue cold start latency'],
      });
    }

    return alternatives;
  }

  private assessConfidence(profile: PipelineProfile): 'high' | 'medium' | 'low' {
    if (profile.dailyVolumeGB > 0 && profile.sourceTables > 0) return 'high';
    if (profile.dailyVolumeGB > 0) return 'medium';
    return 'low';
  }

  private listAssumptions(profile: PipelineProfile): string[] {
    return [
      `Daily volume: ${profile.dailyVolumeGB}GB (constant, no spikes)`,
      `Processing frequency: ${profile.frequency}`,
      `Data retention: ${profile.retentionMonths} months`,
      `On-demand pricing (no reserved capacity)`,
      `Standard compression ratio (~3:1 for Parquet)`,
      `Single region deployment`,
      `No cross-cloud data transfer`,
      `Exchange rate: 1 USD = R${this.exchangeRate}`,
    ];
  }
}
