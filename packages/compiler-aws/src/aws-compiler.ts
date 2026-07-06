/**
 * AWS Compiler Backend
 * Main compiler class that orchestrates all AWS-specific generators.
 */

import { BaseCompiler } from '@eadpa/compiler-core';
import type {
  CompilationResult,
  CompilationError,
  GeneratedFile,
  CompilerOptions,
  CompilerCapabilities,
  CompilerMetadata,
  CostEstimation,
} from '@eadpa/compiler-core';
import type { PipelineSpec } from '@eadpa/shared';
import { GlueETLGenerator } from './generators/glue-etl';
import { S3LayoutGenerator } from './generators/s3-layout';
import { StepFunctionsGenerator } from './generators/step-functions';
import { AthenaGenerator } from './generators/athena';
import { LambdaGenerator } from './generators/lambda';
import { TerraformGenerator } from './generators/terraform';

export class AWSCompiler extends BaseCompiler {
  readonly id = 'aws-glue-s3';
  readonly name = 'AWS (Glue + S3 + Athena)';
  readonly provider = 'aws' as const;
  readonly version = '0.1.0';

  readonly capabilities: CompilerCapabilities = {
    formats: ['parquet', 'delta', 'iceberg', 'json', 'csv'],
    loadModes: ['append', 'overwrite', 'merge', 'scd1', 'scd2'],
    sourceTypes: [
      'postgres', 'mysql', 'sqlserver', 'oracle',
      's3', 'kafka', 'kinesis', 'rest_api',
    ],
    incremental: true,
    scd2: true,
    streaming: true,
    realtime: false,
    orchestrationEngines: ['step_functions', 'airflow'],
  };

  private glueGenerator: GlueETLGenerator;
  private s3Generator: S3LayoutGenerator;
  private sfnGenerator: StepFunctionsGenerator;
  private athenaGenerator: AthenaGenerator;
  private lambdaGenerator: LambdaGenerator;
  private terraformGenerator: TerraformGenerator;

  constructor() {
    super();
    this.glueGenerator = new GlueETLGenerator();
    this.s3Generator = new S3LayoutGenerator();
    this.sfnGenerator = new StepFunctionsGenerator();
    this.athenaGenerator = new AthenaGenerator();
    this.lambdaGenerator = new LambdaGenerator();
    this.terraformGenerator = new TerraformGenerator();
  }

  async compile(spec: PipelineSpec, options?: CompilerOptions): Promise<CompilationResult> {
    const startTime = Date.now();
    const files: GeneratedFile[] = [];
    const errors: CompilationError[] = [];

    try {
      // Validate first
      const validationErrors = await this.validate(spec);
      if (validationErrors.some(e => e.severity === 'error')) {
        return {
          success: false,
          files: [],
          errors: validationErrors,
          warnings: [],
          metadata: this.buildMetadata([], startTime),
        };
      }

      // Generate Glue ETL scripts for each layer
      const glueFiles = this.glueGenerator.generate(spec);
      files.push(...glueFiles);

      // Generate S3 layout/path configuration
      const s3Files = this.s3Generator.generate(spec);
      files.push(...s3Files);

      // Generate Step Functions state machine
      const sfnFiles = this.sfnGenerator.generate(spec);
      files.push(...sfnFiles);

      // Generate Athena DDL for querying
      const athenaFiles = this.athenaGenerator.generate(spec);
      files.push(...athenaFiles);

      // Generate Lambda functions for orchestration
      const lambdaFiles = this.lambdaGenerator.generate(spec);
      files.push(...lambdaFiles);

      // Generate Terraform IaC (if requested)
      if (options?.generateInfra !== false) {
        const terraformFiles = this.terraformGenerator.generate(spec);
        files.push(...terraformFiles);
      }

      // Generate project config files
      files.push(this.generateProjectConfig(spec));
      files.push(this.generateRequirements());
      files.push(this.generateReadme(spec));

      const metadata = this.buildMetadata(files, startTime);
      metadata.targetServices = ['AWS Glue', 'Amazon S3', 'AWS Step Functions', 'Amazon Athena', 'AWS Lambda'];

      return {
        success: true,
        files,
        errors: [],
        warnings: validationErrors.filter(e => e.severity === 'warning'),
        metadata,
      };
    } catch (error: any) {
      errors.push({
        code: 'COMPILATION_FAILED',
        message: error.message,
        severity: 'error',
      });
      return {
        success: false,
        files,
        errors,
        warnings: [],
        metadata: this.buildMetadata(files, startTime),
      };
    }
  }

  async validate(spec: PipelineSpec): Promise<CompilationError[]> {
    const errors: CompilationError[] = [];

    // Check target cloud
    if (spec.target.cloud !== 'aws') {
      errors.push({
        code: 'WRONG_TARGET',
        message: `AWS backend cannot compile for target '${spec.target.cloud}'`,
        path: '/target/cloud',
        severity: 'error',
      });
    }

    // Check source type support
    const supportedSources = this.capabilities.sourceTypes;
    if (!supportedSources.includes(spec.source.type)) {
      errors.push({
        code: 'UNSUPPORTED_SOURCE',
        message: `Source type '${spec.source.type}' is not supported by the AWS backend`,
        path: '/source/type',
        severity: 'error',
        suggestion: `Supported sources: ${supportedSources.join(', ')}`,
      });
    }

    // Check format support
    for (const layer of spec.layers) {
      if (!this.capabilities.formats.includes(layer.format)) {
        errors.push({
          code: 'UNSUPPORTED_FORMAT',
          message: `Format '${layer.format}' in ${layer.layer} layer is not supported`,
          path: `/layers/${layer.layer}/format`,
          severity: 'error',
          suggestion: `Supported formats: ${this.capabilities.formats.join(', ')}`,
        });
      }
    }

    return errors;
  }

  async estimateCost(spec: PipelineSpec): Promise<CostEstimation> {
    const breakdown = [
      {
        service: 'AWS Glue',
        operation: 'ETL Processing (DPU-hours)',
        monthly_usd: 15.0,
        per_run_usd: 0.50,
        notes: 'Assuming 2 DPU, 15 min per run, daily schedule',
      },
      {
        service: 'Amazon S3',
        operation: 'Storage + Requests',
        monthly_usd: 2.30,
        per_run_usd: 0.01,
        notes: 'Assuming 100GB stored, standard tier',
      },
      {
        service: 'AWS Step Functions',
        operation: 'State transitions',
        monthly_usd: 0.75,
        per_run_usd: 0.025,
        notes: 'Assuming ~30 transitions per run',
      },
      {
        service: 'Amazon Athena',
        operation: 'Queries (data scanned)',
        monthly_usd: 5.0,
        per_run_usd: 0.0,
        notes: 'Assuming 1TB scanned/month for analytics',
      },
    ];

    return {
      monthlyEstimate: breakdown.reduce((sum, b) => sum + b.monthly_usd, 0),
      perRunEstimate: breakdown.reduce((sum, b) => sum + b.per_run_usd, 0),
      breakdown,
      confidence: 'medium',
      assumptions: [
        'Daily schedule (30 runs/month)',
        '2 DPU Glue workers, 15 min average runtime',
        '100GB total storage in S3',
        'Standard S3 storage class',
        'Incremental processing (not full refresh)',
      ],
    };
  }

  async generateInfrastructure(spec: PipelineSpec): Promise<GeneratedFile[]> {
    return this.terraformGenerator.generate(spec);
  }

  getMetadata(): CompilerMetadata {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      targetServices: ['AWS Glue', 'Amazon S3', 'AWS Step Functions', 'Amazon Athena', 'AWS Lambda'],
      outputFormats: ['python', 'json', 'sql', 'hcl', 'yaml'],
      requiredConfig: ['AWS_REGION', 'S3_BUCKET', 'IAM_ROLE', 'GLUE_DATABASE'],
    };
  }

  private generateProjectConfig(spec: PipelineSpec): GeneratedFile {
    const content = `# EADPA Generated Pipeline Configuration
# Pipeline: ${spec.name}
# Target: AWS (Glue + S3 + Athena + Step Functions)

pipeline:
  name: ${spec.name}
  version: ${spec.version}

aws:
  region: ${spec.target.region || 'us-east-1'}
  glue:
    database: ${this.sanitizeName(spec.name)}_db
    workers: ${spec.cloud_overrides?.aws?.glue_workers || 2}
    version: "${spec.cloud_overrides?.aws?.glue_version || '4.0'}"
  s3:
    bucket: ${spec.cloud_overrides?.aws?.s3_bucket || '${S3_BUCKET}'}
    prefix: pipelines/${spec.name}
  step_functions:
    state_machine_name: ${this.sanitizeName(spec.name)}_workflow
`;
    return {
      path: 'config/pipeline.yaml',
      content,
      language: 'yaml',
      description: 'Pipeline configuration for AWS deployment',
    };
  }

  private generateRequirements(): GeneratedFile {
    return {
      path: 'requirements.txt',
      content: `# Generated by EADPA AWS Compiler
awsglue-libs==4.0.0
pyspark==3.3.0
boto3>=1.34.0
delta-spark==2.4.0
pyiceberg>=0.6.0
great-expectations>=0.18.0
pyyaml>=6.0
`,
      language: 'text',
      description: 'Python dependencies for the pipeline',
    };
  }

  private generateReadme(spec: PipelineSpec): GeneratedFile {
    return {
      path: 'README.md',
      content: `# ${spec.name}

> Generated by EADPA (Enterprise Autonomous Data Pipeline Agent)

## Pipeline Overview

- **Source**: ${spec.source.type}
- **Target**: AWS (Glue + S3 + Athena)
- **Layers**: ${spec.layers.map(l => l.layer).join(' → ')}
- **Schedule**: ${spec.orchestration?.schedule || 'Manual'}
- **Load Mode**: ${spec.layers.map(l => \`\${l.layer}:\${l.load_mode}\`).join(', ')}

## Project Structure

\`\`\`
├── glue/                    # AWS Glue ETL scripts (PySpark)
│   ├── bronze_ingestion.py  # Raw data ingestion
│   ├── silver_transform.py  # Data cleansing & transformation
│   └── gold_aggregate.py    # Business-ready aggregations
├── athena/                  # Athena DDL statements
│   └── create_tables.sql    # Table definitions
├── step_functions/          # Orchestration workflow
│   └── workflow.asl.json    # State machine definition
├── lambda/                  # Lambda functions
│   └── trigger.py           # Pipeline trigger handler
├── terraform/               # Infrastructure as Code
│   ├── main.tf              # Main Terraform config
│   ├── variables.tf         # Input variables
│   └── outputs.tf           # Terraform outputs
├── tests/                   # Data quality tests
├── config/                  # Configuration files
│   └── pipeline.yaml        # Pipeline configuration
├── requirements.txt         # Python dependencies
└── README.md                # This file
\`\`\`

## Deployment

1. Configure AWS credentials and region
2. Set environment variables (see \`.env.example\`)
3. Deploy infrastructure: \`terraform apply\`
4. Upload Glue scripts to S3
5. Start the Step Functions workflow

## Data Quality

Quality checks run automatically after each layer:
${spec.quality?.checks?.map(c => `- **${c.name}**: ${c.type} check (severity: ${c.severity})`).join('\n') || '- No quality checks configured'}

## Cost Estimate

Estimated monthly cost: ~$23/month (based on daily runs, 2 DPU Glue workers)
`,
      language: 'markdown',
      description: 'Project documentation',
    };
  }
}
