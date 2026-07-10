/**
 * EADD Cost Section Generator
 * 
 * Appends a cost estimate to every pipeline solution.
 * Users see BEFORE they deploy what it will cost.
 * 
 * WHY: Cloud bills are the #1 surprise for new data engineers.
 * Showing cost upfront builds trust and prevents bill shock.
 * 
 * Covers: AWS, Azure, GCP, Databricks, Snowflake
 * Currencies: USD + ZAR (South African Rand)
 */

const USD_TO_ZAR = 18.50;

interface CostContext {
  pipelineName?: string;
  platform?: string;
  dailyVolumeGB?: number;
  frequency?: string;
}

interface CostLine {
  component: string;
  monthlyUSD: number;
  notes: string;
}

/**
 * Generate a formatted cost estimate section based on pipeline context.
 */
export function generateCostSection(context: CostContext): string {
  const platform = (context.platform || 'aws').toLowerCase();
  const dailyGB = context.dailyVolumeGB || 10;
  const frequency = context.frequency || 'daily';
  const name = context.pipelineName || 'pipeline';

  const costs = calculateCosts(platform, dailyGB, frequency);
  const totalUSD = costs.reduce((sum, c) => sum + c.monthlyUSD, 0);
  const totalZAR = totalUSD * USD_TO_ZAR;

  return formatCostTable(name, platform, costs, totalUSD, totalZAR, dailyGB);
}


function calculateCosts(platform: string, dailyGB: number, frequency: string): CostLine[] {
  const monthlyGB = dailyGB * 30;
  const freqMultiplier = frequency === 'real_time' ? 720
    : frequency === 'hourly' ? 720
    : frequency === 'daily' ? 30
    : 4; // weekly

  switch (platform) {
    case 'aws':
      return [
        { component: 'AWS Glue ETL', monthlyUSD: Math.ceil(dailyGB / 10) * 0.5 * 0.44 * freqMultiplier, notes: '$0.44/DPU-hour, ~0.5hr per 10GB' },
        { component: 'S3 Storage', monthlyUSD: monthlyGB * 12 * 0.023, notes: '$0.023/GB/month, 12-month retention' },
        { component: 'Data Transfer', monthlyUSD: monthlyGB * 0.02, notes: '$0.02/GB intra-region' },
        { component: 'CloudWatch + Secrets', monthlyUSD: 15, notes: 'Monitoring, logging, secrets mgmt' },
        { component: 'Athena Queries', monthlyUSD: monthlyGB * 5 / 1000, notes: '$5/TB scanned (use partitioning!)' },
      ];

    case 'databricks':
      return [
        { component: 'Jobs Compute (DBU)', monthlyUSD: Math.ceil(dailyGB / 5) * 0.3 * 0.15 * freqMultiplier, notes: '$0.15/DBU-hour for Jobs' },
        { component: 'Delta Storage (S3/ADLS)', monthlyUSD: monthlyGB * 12 * 0.023, notes: 'Underlying cloud storage' },
        { component: 'Platform Fee', monthlyUSD: Math.ceil(dailyGB / 5) * 0.3 * 0.05 * freqMultiplier, notes: 'Databricks platform overhead' },
        { component: 'Monitoring', monthlyUSD: 50, notes: 'Basic workspace monitoring' },
      ];

    case 'snowflake':
      const whSize = dailyGB < 10 ? 1 : dailyGB < 100 ? 2 : 4;
      const runHours = dailyGB < 10 ? 0.1 : dailyGB < 100 ? 0.3 : 0.8;
      return [
        { component: 'Compute (credits)', monthlyUSD: whSize * runHours * freqMultiplier * 2.0, notes: `$2/credit, ${whSize} credits/hr warehouse` },
        { component: 'Storage', monthlyUSD: (monthlyGB * 12 / 1000) * 23, notes: '$23/TB/month compressed' },
        { component: 'Serverless Tasks', monthlyUSD: freqMultiplier * 0.05, notes: 'Snowpipe, task scheduling' },
      ];

    case 'azure':
      return [
        { component: 'ADF Pipeline Runs', monthlyUSD: freqMultiplier * 0.50, notes: '$0.50/run activity' },
        { component: 'Synapse Compute', monthlyUSD: dailyGB * 0.10 * freqMultiplier, notes: 'Serverless SQL pool' },
        { component: 'ADLS Storage', monthlyUSD: monthlyGB * 12 * 0.02, notes: '$0.02/GB/month' },
        { component: 'Monitoring', monthlyUSD: 40, notes: 'Azure Monitor + Log Analytics' },
      ];

    default:
      return [
        { component: 'Compute (estimated)', monthlyUSD: dailyGB * 2, notes: 'Generic compute estimate' },
        { component: 'Storage', monthlyUSD: monthlyGB * 12 * 0.025, notes: 'Object storage estimate' },
        { component: 'Operations', monthlyUSD: 30, notes: 'Monitoring, alerting, secrets' },
      ];
  }
}


function formatCostTable(
  name: string,
  platform: string,
  costs: CostLine[],
  totalUSD: number,
  totalZAR: number,
  dailyGB: number
): string {
  const rows = costs.map(c =>
    `| ${c.component} | $${c.monthlyUSD.toFixed(0)} | R${(c.monthlyUSD * USD_TO_ZAR).toFixed(0)} | ${c.notes} |`
  ).join('\n');

  return `---

## 💰 Cost Estimate: ${name}

**Platform**: ${platform.toUpperCase()} | **Daily Volume**: ${dailyGB}GB | **Rate**: 1 USD = R${USD_TO_ZAR}

| Component | Monthly (USD) | Monthly (ZAR) | Notes |
|-----------|--------------|---------------|-------|
${rows}
| **TOTAL** | **$${totalUSD.toFixed(0)}** | **R${totalZAR.toFixed(0)}** | |

**Annual projection**: $${(totalUSD * 12).toFixed(0)} / R${(totalZAR * 12).toFixed(0)}

### 📈 Scaling Projection
| Growth | Monthly Cost | Notes |
|--------|-------------|-------|
| Current (${dailyGB}GB/day) | R${totalZAR.toFixed(0)} | Current state |
| 2x (${dailyGB * 2}GB/day) | R${(totalZAR * 1.7).toFixed(0)} | Sub-linear due to fixed costs |
| 5x (${dailyGB * 5}GB/day) | R${(totalZAR * 3.5).toFixed(0)} | Consider reserved capacity |
| 10x (${dailyGB * 10}GB/day) | R${(totalZAR * 6).toFixed(0)} | Reserved + spot mix recommended |

### 💡 Cost Optimization Tips
- **Reserved capacity**: Save ~40% with 1-year commitment on predictable workloads
- **Spot/preemptible instances**: Save ~70% for batch jobs that tolerate interruption
- **Storage tiering**: Move Bronze data >30 days old to cold storage (save ~60% on storage)
- **Partition data**: Reduce scan costs by 80%+ with date partitioning

> ⚠️ Estimates based on on-demand pricing. Actual costs may vary ±20%.
`;
}
