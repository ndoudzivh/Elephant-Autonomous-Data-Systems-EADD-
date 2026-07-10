/**
 * EADD Deployment Instructions Generator
 * 
 * Every pipeline solution ends with clear, step-by-step deployment instructions.
 * No code is useful if you can't get it running.
 * 
 * Covers:
 * - Prerequisites (accounts, permissions, tools)
 * - Environment setup (local dev, CI/CD, cloud)
 * - Step-by-step deployment commands
 * - Verification steps (how to confirm it's working)
 * - Rollback instructions (how to undo if something goes wrong)
 * - Common issues and troubleshooting
 * 
 * Section 25 — Deployment Guides
 */

export type DeployTarget = 'aws' | 'azure' | 'gcp' | 'databricks' | 'snowflake' | 'local' | 'kubernetes';
export type DeployMethod = 'terraform' | 'cdk' | 'cloudformation' | 'manual' | 'helm' | 'github_actions' | 'gitlab_ci';

export interface DeploymentGuide {
  pipelineName: string;
  target: DeployTarget;
  method: DeployMethod;
  prerequisites: Prerequisite[];
  environmentSetup: EnvironmentStep[];
  deploymentSteps: DeployStep[];
  verificationSteps: VerificationStep[];
  rollbackPlan: RollbackStep[];
  troubleshooting: TroubleshootingEntry[];
  estimatedDeployTime: string;
  supportContact: string;
}


export interface Prerequisite {
  name: string;
  description: string;
  installCommand?: string;
  versionRequired?: string;
  link?: string;
  category: 'tool' | 'account' | 'permission' | 'secret';
}

export interface EnvironmentStep {
  order: number;
  title: string;
  commands: string[];
  explanation: string;
  platform: 'all' | 'mac' | 'linux' | 'windows';
}

export interface DeployStep {
  order: number;
  title: string;
  command: string;
  explanation: string;
  expectedOutput?: string;
  warningIfFails?: string;
  requiresApproval?: boolean;
  timeoutSeconds?: number;
}

export interface VerificationStep {
  order: number;
  title: string;
  command: string;
  expectedResult: string;
  explanation: string;
}

export interface RollbackStep {
  order: number;
  title: string;
  command: string;
  explanation: string;
  when: string;
}

export interface TroubleshootingEntry {
  problem: string;
  symptoms: string[];
  cause: string;
  solution: string;
  commands?: string[];
}


// ============================================================
// DEPLOYMENT TEMPLATE GENERATORS
// ============================================================

export class DeploymentInstructionGenerator {
  /**
   * Generate deployment instructions for a pipeline
   */
  generate(pipelineName: string, target: DeployTarget, method: DeployMethod): DeploymentGuide {
    return {
      pipelineName,
      target,
      method,
      prerequisites: this.getPrerequisites(target, method),
      environmentSetup: this.getEnvironmentSetup(target, method),
      deploymentSteps: this.getDeploymentSteps(target, method, pipelineName),
      verificationSteps: this.getVerificationSteps(target, pipelineName),
      rollbackPlan: this.getRollbackPlan(target, method, pipelineName),
      troubleshooting: this.getTroubleshooting(target),
      estimatedDeployTime: this.estimateDeployTime(target, method),
      supportContact: 'eadd-support@your-org.com',
    };
  }

  /**
   * Format deployment guide as readable markdown
   */
  formatGuide(guide: DeploymentGuide): string {
    return `
## 🚀 Deployment Instructions: ${guide.pipelineName}

**Target**: ${guide.target.toUpperCase()} | **Method**: ${guide.method} | **Estimated time**: ${guide.estimatedDeployTime}

---

### 📋 Prerequisites

Before you begin, ensure you have:

${guide.prerequisites.map((p, i) => `${i + 1}. **${p.name}** (${p.category})
   ${p.description}${p.installCommand ? `\n   \`\`\`bash\n   ${p.installCommand}\n   \`\`\`` : ''}${p.versionRequired ? `\n   Required version: ${p.versionRequired}` : ''}`).join('\n\n')}

---

### 🔧 Environment Setup

${guide.environmentSetup.map(s => `**Step ${s.order}: ${s.title}**${s.platform !== 'all' ? ` (${s.platform} only)` : ''}

${s.explanation}

\`\`\`bash
${s.commands.join('\n')}
\`\`\``).join('\n\n')}

---

### 🚀 Deployment Steps

${guide.deploymentSteps.map(s => `**Step ${s.order}: ${s.title}**${s.requiresApproval ? ' ⚠️ REQUIRES APPROVAL' : ''}

${s.explanation}

\`\`\`bash
${s.command}
\`\`\`
${s.expectedOutput ? `\nExpected output: \`${s.expectedOutput}\`` : ''}
${s.warningIfFails ? `\n> ⚠️ If this fails: ${s.warningIfFails}` : ''}`).join('\n\n')}

---

### ✅ Verification

After deployment, verify everything is working:

${guide.verificationSteps.map(v => `**${v.order}. ${v.title}**

\`\`\`bash
${v.command}
\`\`\`

Expected: ${v.expectedResult}
${v.explanation}`).join('\n\n')}

---

### 🔄 Rollback Plan

If something goes wrong, follow these steps IN ORDER:

${guide.rollbackPlan.map(r => `**${r.order}. ${r.title}** (when: ${r.when})

\`\`\`bash
${r.command}
\`\`\`

${r.explanation}`).join('\n\n')}

---

### 🔍 Troubleshooting

${guide.troubleshooting.map(t => `**Problem: ${t.problem}**
- Symptoms: ${t.symptoms.join(', ')}
- Cause: ${t.cause}
- Solution: ${t.solution}${t.commands ? `\n\`\`\`bash\n${t.commands.join('\n')}\n\`\`\`` : ''}`).join('\n\n')}

---
> 📧 Need help? Contact: ${guide.supportContact}
`;
  }


  private getPrerequisites(target: DeployTarget, method: DeployMethod): Prerequisite[] {
    const common: Prerequisite[] = [
      { name: 'Git', description: 'Version control', installCommand: 'git --version', versionRequired: '>=2.30', category: 'tool' },
      { name: 'Node.js', description: 'Runtime for build tools', installCommand: 'node --version', versionRequired: '>=18.0', category: 'tool' },
    ];

    const targetSpecific: Record<DeployTarget, Prerequisite[]> = {
      aws: [
        { name: 'AWS CLI', description: 'AWS command line interface', installCommand: 'pip install awscli && aws configure', versionRequired: '>=2.0', category: 'tool' },
        { name: 'AWS Account', description: 'Active AWS account with billing enabled', link: 'https://aws.amazon.com', category: 'account' },
        { name: 'IAM Permissions', description: 'AdministratorAccess or specific Glue/S3/Lambda/IAM policies', category: 'permission' },
        { name: 'AWS Credentials', description: 'Access Key + Secret Key configured in ~/.aws/credentials', category: 'secret' },
      ],
      azure: [
        { name: 'Azure CLI', description: 'Azure command line interface', installCommand: 'curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash && az login', versionRequired: '>=2.50', category: 'tool' },
        { name: 'Azure Subscription', description: 'Active Azure subscription', link: 'https://portal.azure.com', category: 'account' },
        { name: 'Resource Group', description: 'Contributor role on target resource group', category: 'permission' },
      ],
      gcp: [
        { name: 'gcloud CLI', description: 'Google Cloud SDK', installCommand: 'curl https://sdk.cloud.google.com | bash && gcloud init', versionRequired: '>=400', category: 'tool' },
        { name: 'GCP Project', description: 'Active GCP project with billing', link: 'https://console.cloud.google.com', category: 'account' },
        { name: 'Service Account', description: 'SA with BigQuery Admin + Storage Admin roles', category: 'permission' },
      ],
      databricks: [
        { name: 'Databricks CLI', description: 'Databricks command line', installCommand: 'pip install databricks-cli && databricks configure --token', category: 'tool' },
        { name: 'Databricks Workspace', description: 'Active workspace with Unity Catalog enabled', category: 'account' },
        { name: 'Personal Access Token', description: 'Token with cluster create and jobs manage permissions', category: 'secret' },
      ],
      snowflake: [
        { name: 'SnowSQL', description: 'Snowflake CLI', installCommand: 'brew install snowflake-snowsql', category: 'tool' },
        { name: 'Snowflake Account', description: 'Active Snowflake account', link: 'https://app.snowflake.com', category: 'account' },
        { name: 'ACCOUNTADMIN or SYSADMIN', description: 'Role with CREATE WAREHOUSE, CREATE DATABASE permissions', category: 'permission' },
      ],
      local: [
        { name: 'Docker', description: 'Container runtime', installCommand: 'docker --version', versionRequired: '>=24.0', category: 'tool' },
        { name: 'Docker Compose', description: 'Multi-container orchestration', installCommand: 'docker compose version', versionRequired: '>=2.20', category: 'tool' },
      ],
      kubernetes: [
        { name: 'kubectl', description: 'Kubernetes CLI', installCommand: 'kubectl version --client', versionRequired: '>=1.28', category: 'tool' },
        { name: 'Helm', description: 'Kubernetes package manager', installCommand: 'helm version', versionRequired: '>=3.12', category: 'tool' },
        { name: 'Cluster Access', description: 'kubeconfig with deploy permissions to target namespace', category: 'permission' },
      ],
    };

    const methodSpecific: Prerequisite[] = [];
    if (method === 'terraform') {
      methodSpecific.push({ name: 'Terraform', description: 'Infrastructure as code tool', installCommand: 'terraform --version', versionRequired: '>=1.5', category: 'tool' });
    }

    return [...common, ...(targetSpecific[target] || []), ...methodSpecific];
  }


  private getEnvironmentSetup(target: DeployTarget, method: DeployMethod): EnvironmentStep[] {
    const steps: EnvironmentStep[] = [
      {
        order: 1,
        title: 'Clone the repository',
        commands: ['git clone <repo-url>', 'cd <pipeline-name>'],
        explanation: 'Get the latest pipeline code from your Git repository.',
        platform: 'all',
      },
      {
        order: 2,
        title: 'Install dependencies',
        commands: ['pip install -r requirements.txt', '# or: poetry install'],
        explanation: 'Install Python dependencies for the pipeline.',
        platform: 'all',
      },
      {
        order: 3,
        title: 'Configure environment variables',
        commands: ['cp .env.example .env', '# Edit .env with your values', 'source .env'],
        explanation: 'Set up connection strings, API keys, and configuration. NEVER commit .env to git.',
        platform: 'all',
      },
    ];

    if (method === 'terraform') {
      steps.push({
        order: 4,
        title: 'Initialize Terraform',
        commands: ['cd terraform/', 'terraform init', 'terraform workspace select dev  # or: terraform workspace new dev'],
        explanation: 'Download Terraform providers and select the target environment workspace.',
        platform: 'all',
      });
    }

    if (target === 'aws') {
      steps.push({
        order: steps.length + 1,
        title: 'Verify AWS access',
        commands: ['aws sts get-caller-identity', '# Should show your account ID and role'],
        explanation: 'Confirm your AWS credentials are configured correctly and have the required permissions.',
        platform: 'all',
      });
    }

    if (target === 'databricks') {
      steps.push({
        order: steps.length + 1,
        title: 'Verify Databricks connectivity',
        commands: ['databricks workspace ls /', '# Should list workspace root directories'],
        explanation: 'Confirm your Databricks token is configured and workspace is accessible.',
        platform: 'all',
      });
    }

    return steps;
  }

  private getDeploymentSteps(target: DeployTarget, method: DeployMethod, pipelineName: string): DeployStep[] {
    if (method === 'terraform') {
      return this.getTerraformDeploySteps(target, pipelineName);
    }
    if (method === 'github_actions') {
      return this.getGitHubActionsDeploySteps(pipelineName);
    }
    return this.getManualDeploySteps(target, pipelineName);
  }

  private getTerraformDeploySteps(target: DeployTarget, pipelineName: string): DeployStep[] {
    return [
      {
        order: 1,
        title: 'Preview infrastructure changes',
        command: `cd terraform/ && terraform plan -var="pipeline_name=${pipelineName}" -out=tfplan`,
        explanation: 'Shows what Terraform WILL create/modify/destroy. Review carefully before applying.',
        expectedOutput: 'Plan: X to add, 0 to change, 0 to destroy',
        warningIfFails: 'Check credentials, provider config, and state backend access.',
      },
      {
        order: 2,
        title: 'Apply infrastructure',
        command: 'terraform apply tfplan',
        explanation: 'Creates the cloud infrastructure (S3 buckets, IAM roles, Glue jobs, etc.).',
        expectedOutput: 'Apply complete! Resources: X added, 0 changed, 0 destroyed.',
        requiresApproval: true,
        timeoutSeconds: 300,
      },
      {
        order: 3,
        title: 'Deploy pipeline code',
        command: `aws s3 sync ./src/ s3://${pipelineName}-artifacts/code/ --exclude "*.pyc"`,
        explanation: 'Upload pipeline Python/SQL code to the artifacts bucket where Glue/Spark can access it.',
      },
      {
        order: 4,
        title: 'Deploy orchestration (Airflow DAG)',
        command: `aws s3 cp ./dags/ s3://${pipelineName}-airflow/dags/ --recursive`,
        explanation: 'Upload Airflow DAGs. MWAA will auto-detect and schedule them.',
      },
      {
        order: 5,
        title: 'Trigger initial run (optional)',
        command: `aws glue start-job-run --job-name ${pipelineName}-ingestion`,
        explanation: 'Manually trigger the first pipeline run to verify everything works end-to-end.',
        expectedOutput: 'JobRunId: jr_xxxxx',
      },
    ];
  }


  private getGitHubActionsDeploySteps(pipelineName: string): DeployStep[] {
    return [
      {
        order: 1,
        title: 'Create feature branch',
        command: `git checkout -b feature/${pipelineName}`,
        explanation: 'All changes go through a branch → PR → review → merge workflow.',
      },
      {
        order: 2,
        title: 'Commit and push',
        command: `git add . && git commit -m "feat: add ${pipelineName} pipeline" && git push -u origin feature/${pipelineName}`,
        explanation: 'Push to remote. This triggers the CI pipeline (lint + test).',
      },
      {
        order: 3,
        title: 'Create Pull Request',
        command: `gh pr create --title "feat: ${pipelineName} pipeline" --body "New pipeline deployment"`,
        explanation: 'Create a PR for code review. CI runs automatically. Requires approval before merge.',
        expectedOutput: 'Pull request created: #XXX',
      },
      {
        order: 4,
        title: 'Merge to develop (deploys to dev)',
        command: 'gh pr merge --squash',
        explanation: 'After approval, merge triggers CD to development environment.',
        requiresApproval: true,
      },
      {
        order: 5,
        title: 'Promote to staging',
        command: 'git checkout main && git merge develop && git push',
        explanation: 'Merge develop into main triggers staging deployment with integration tests.',
        requiresApproval: true,
      },
      {
        order: 6,
        title: 'Promote to production',
        command: `gh workflow run cd-production.yml -f pipeline=${pipelineName}`,
        explanation: 'Manual workflow dispatch for production deployment. Includes approval gate.',
        requiresApproval: true,
      },
    ];
  }

  private getManualDeploySteps(target: DeployTarget, pipelineName: string): DeployStep[] {
    switch (target) {
      case 'snowflake':
        return [
          { order: 1, title: 'Create database objects', command: `snowsql -f sql/create_objects.sql -D pipeline=${pipelineName}`, explanation: 'Creates schemas, tables, stages, and file formats in Snowflake.' },
          { order: 2, title: 'Upload transformation code', command: `snowsql -f sql/create_tasks.sql`, explanation: 'Creates Snowflake Tasks for scheduled execution.' },
          { order: 3, title: 'Create Snowpipe (if streaming)', command: `snowsql -f sql/create_pipe.sql`, explanation: 'Sets up auto-ingestion from S3/Azure using Snowpipe.' },
          { order: 4, title: 'Resume tasks', command: `snowsql -q "ALTER TASK ${pipelineName}_root_task RESUME;"`, explanation: 'Starts the scheduled execution. Tasks are created in SUSPENDED state by default.' },
        ];
      case 'databricks':
        return [
          { order: 1, title: 'Upload notebooks/scripts', command: `databricks workspace import_dir ./src /Shared/${pipelineName}`, explanation: 'Upload pipeline code to Databricks workspace.' },
          { order: 2, title: 'Create job', command: `databricks jobs create --json-file jobs/${pipelineName}.json`, explanation: 'Creates a Databricks Job with schedule, cluster config, and notification settings.' },
          { order: 3, title: 'Run initial execution', command: `databricks jobs run-now --job-id <JOB_ID>`, explanation: 'Trigger the first run to verify end-to-end.' },
        ];
      default:
        return [
          { order: 1, title: 'Deploy infrastructure', command: `make deploy-infra ENV=dev`, explanation: 'Provisions cloud resources.' },
          { order: 2, title: 'Deploy pipeline code', command: `make deploy-code ENV=dev`, explanation: 'Deploys application code.' },
          { order: 3, title: 'Run smoke test', command: `make smoke-test ENV=dev`, explanation: 'Validates basic functionality.' },
        ];
    }
  }


  private getVerificationSteps(target: DeployTarget, pipelineName: string): VerificationStep[] {
    const common: VerificationStep[] = [
      {
        order: 1,
        title: 'Check pipeline execution status',
        command: target === 'aws' ? `aws glue get-job-run --job-name ${pipelineName}-ingestion --run-id <RUN_ID>` : `databricks jobs get-run --run-id <RUN_ID>`,
        expectedResult: 'Status: SUCCEEDED',
        explanation: 'Confirm the pipeline ran without errors.',
      },
      {
        order: 2,
        title: 'Verify data landed in target',
        command: target === 'snowflake' ? `snowsql -q "SELECT COUNT(*) FROM ${pipelineName}.silver.main_table;"` : `aws athena start-query-execution --query-string "SELECT COUNT(*) FROM ${pipelineName}_db.silver_table"`,
        expectedResult: 'Row count > 0 matching expected source volume',
        explanation: 'Confirm data was actually written to the target system.',
      },
      {
        order: 3,
        title: 'Check data quality results',
        command: `cat logs/quality_report.json | jq '.score'`,
        expectedResult: 'Quality score >= 95%',
        explanation: 'Verify data quality checks passed above threshold.',
      },
      {
        order: 4,
        title: 'Verify monitoring is active',
        command: target === 'aws' ? `aws cloudwatch describe-alarms --alarm-name-prefix ${pipelineName}` : 'echo "Check your monitoring dashboard"',
        expectedResult: 'Alarms in OK state',
        explanation: 'Confirm monitoring and alerting is configured and healthy.',
      },
    ];

    return common;
  }

  private getRollbackPlan(target: DeployTarget, method: DeployMethod, pipelineName: string): RollbackStep[] {
    if (method === 'terraform') {
      return [
        { order: 1, title: 'Identify the issue', command: `terraform show | grep -A5 "${pipelineName}"`, explanation: 'Check what resources were created and their current state.', when: 'Deployment failed or produces errors' },
        { order: 2, title: 'Rollback infrastructure', command: 'terraform apply -target=module.pipeline -var="version=previous"', explanation: 'Revert to previous version of infrastructure. Terraform tracks state so this is safe.', when: 'Infrastructure changes caused the issue' },
        { order: 3, title: 'Rollback code (if needed)', command: `git revert HEAD && git push`, explanation: 'Revert the last commit and push. CI/CD will redeploy the previous version.', when: 'Code changes caused the issue' },
        { order: 4, title: 'Full destroy (nuclear option)', command: `terraform destroy -target=module.${pipelineName}`, explanation: '⚠️ LAST RESORT: Completely removes all resources. Use only if partial rollback fails.', when: 'Nothing else works — start fresh' },
      ];
    }

    return [
      { order: 1, title: 'Stop the pipeline', command: target === 'aws' ? `aws glue stop-job-run --job-name ${pipelineName}` : `databricks jobs cancel-run --run-id <RUN_ID>`, explanation: 'Immediately stop any running executions.', when: 'Pipeline is producing incorrect data' },
      { order: 2, title: 'Revert to previous version', command: `git checkout tags/last-stable && make deploy`, explanation: 'Deploy the last known-good version.', when: 'New deployment has bugs' },
      { order: 3, title: 'Restore data (if needed)', command: `aws s3 sync s3://backups/${pipelineName}/ s3://production/${pipelineName}/`, explanation: 'Restore data from backup if the pipeline corrupted the target.', when: 'Data was corrupted by the failed run' },
    ];
  }


  private getTroubleshooting(target: DeployTarget): TroubleshootingEntry[] {
    const common: TroubleshootingEntry[] = [
      {
        problem: 'Permission denied / Access denied',
        symptoms: ['403 Forbidden', 'AccessDeniedException', 'not authorized to perform'],
        cause: 'IAM role or service account lacks required permissions.',
        solution: 'Check the IAM policy attached to your role. Ensure it has the permissions listed in prerequisites.',
        commands: ['aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names s3:PutObject'],
      },
      {
        problem: 'Connection timeout to source',
        symptoms: ['Connection timed out', 'Network unreachable', 'Could not connect'],
        cause: 'Network configuration (VPC, security groups, firewall) blocking the connection.',
        solution: 'Verify security groups allow outbound on the required port. Check VPC endpoints or NAT gateway configuration.',
        commands: ['aws ec2 describe-security-groups --group-ids <sg-id>'],
      },
      {
        problem: 'Out of memory (OOM)',
        symptoms: ['Container killed', 'OutOfMemoryError', 'Exit code 137'],
        cause: 'Pipeline processing more data than allocated memory can handle.',
        solution: 'Increase worker memory (Glue: MaxCapacity, Spark: spark.executor.memory) or add partitioning to process less data per task.',
      },
      {
        problem: 'Schema mismatch / Column not found',
        symptoms: ['AnalysisException', 'Column X not found', 'Schema drift detected'],
        cause: 'Source schema changed without updating the pipeline.',
        solution: 'Check source schema for changes. Update schema definition in pipeline config. Consider adding schema evolution handling.',
      },
      {
        problem: 'Duplicate records in output',
        symptoms: ['Row count higher than expected', 'Duplicate keys', 'Failed uniqueness test'],
        cause: 'Pipeline ran twice (retry) without idempotency, or JOIN produced a Cartesian product.',
        solution: 'Add MERGE/UPSERT instead of INSERT. Check JOIN conditions for missing keys. Add deduplication step.',
      },
    ];

    const targetSpecific: Record<DeployTarget, TroubleshootingEntry[]> = {
      aws: [
        {
          problem: 'Glue job fails with "No space left on device"',
          symptoms: ['DiskSpaceFullException', 'No space left on device'],
          cause: 'Shuffle data exceeds local disk on Glue workers.',
          solution: 'Increase NumberOfWorkers or use G.2X worker type (more disk). Also add .repartition() before heavy shuffle operations.',
        },
      ],
      databricks: [
        {
          problem: 'Cluster failed to start',
          symptoms: ['CLOUD_PROVIDER_LAUNCH_FAILURE', 'Cluster terminated'],
          cause: 'Cloud quota exceeded or instance type unavailable in region.',
          solution: 'Try a different instance type or request quota increase from your cloud provider.',
        },
      ],
      snowflake: [
        {
          problem: 'Warehouse auto-suspended during long query',
          symptoms: ['Statement cancelled', 'Warehouse suspended'],
          cause: 'STATEMENT_TIMEOUT_IN_SECONDS exceeded or warehouse auto-suspended.',
          solution: 'Increase AUTO_SUSPEND timeout or set STATEMENT_TIMEOUT_IN_SECONDS higher for long-running operations.',
          commands: ['ALTER WAREHOUSE wh SET AUTO_SUSPEND = 300;'],
        },
      ],
      azure: [],
      gcp: [],
      local: [],
      kubernetes: [],
    };

    return [...common, ...(targetSpecific[target] || [])];
  }

  private estimateDeployTime(target: DeployTarget, method: DeployMethod): string {
    const minutes: Record<DeployMethod, number> = {
      terraform: 15,
      cdk: 12,
      cloudformation: 20,
      manual: 30,
      helm: 10,
      github_actions: 8,
      gitlab_ci: 8,
    };
    return `~${minutes[method] || 15} minutes`;
  }
}
