/**
 * EADD Deployment Instructions Generator (Lightweight)
 * 
 * Appends step-by-step deployment instructions to every solution.
 * No pipeline is useful if you can't get it running.
 * 
 * WHY: The gap between "code that works locally" and "code running in
 * production" is where most projects die. Clear deploy instructions
 * bridge that gap.
 */

interface DeployContext {
  pipelineName?: string;
  platform?: string;
}

export function generateDeploySection(context: DeployContext): string {
  const platform = (context.platform || 'aws').toLowerCase();
  const name = context.pipelineName || 'my-pipeline';

  const instructions = getInstructionsForPlatform(platform, name);
  return instructions;
}


function getInstructionsForPlatform(platform: string, name: string): string {
  const common = `---

## 🚀 Deployment Instructions: ${name}

### 📋 Prerequisites

1. **Git** (v2.30+): \`git --version\`
2. **Python** (3.9+): \`python --version\`
3. **pip/poetry**: Package manager for dependencies
`;

  switch (platform) {
    case 'aws':
      return common + getAWSInstructions(name);
    case 'databricks':
      return common + getDatabricksInstructions(name);
    case 'snowflake':
      return common + getSnowflakeInstructions(name);
    case 'azure':
      return common + getAzureInstructions(name);
    default:
      return common + getGenericInstructions(name);
  }
}

function getAWSInstructions(name: string): string {
  return `4. **AWS CLI** (v2+): \`pip install awscli && aws configure\`
5. **Terraform** (v1.5+): \`terraform --version\`
6. **IAM Permissions**: Glue, S3, Lambda, IAM, CloudWatch

### 🔧 Setup

\`\`\`bash
# 1. Clone and install
git clone <repo-url> && cd ${name}
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your AWS credentials reference (never plain text)
source .env

# 3. Verify AWS access
aws sts get-caller-identity
\`\`\`

### 🚀 Deploy

\`\`\`bash
# 4. Initialize Terraform
cd terraform/ && terraform init
terraform workspace select dev

# 5. Preview changes (REVIEW before applying!)
terraform plan -var="pipeline_name=${name}" -out=tfplan

# 6. Apply infrastructure
terraform apply tfplan
# Expected: "Apply complete! Resources: X added"

# 7. Upload pipeline code
aws s3 sync ./src/ s3://${name}-artifacts/code/ --exclude "*.pyc"

# 8. Trigger first run (optional)
aws glue start-job-run --job-name ${name}-ingestion
\`\`\`

### ✅ Verify

\`\`\`bash
# Check job status
aws glue get-job-run --job-name ${name}-ingestion --run-id <RUN_ID>
# Expected: "JobRunState": "SUCCEEDED"

# Check data landed
aws s3 ls s3://${name}-bronze/ --recursive | head -5

# Check monitoring
aws cloudwatch describe-alarms --alarm-name-prefix ${name}
\`\`\`

### 🔄 Rollback (if something goes wrong)

\`\`\`bash
# Stop running jobs
aws glue batch-stop-job-run --job-name ${name}-ingestion --job-run-ids <ID>

# Revert infrastructure
cd terraform/ && terraform destroy -target=module.${name}

# Revert code
git revert HEAD && git push
\`\`\`

### 🔍 Common Issues
- **AccessDenied**: Check IAM policy has Glue + S3 permissions
- **Connection timeout**: Verify VPC security groups allow outbound
- **No space on device**: Increase Glue MaxCapacity or add .repartition()
`;
}


function getDatabricksInstructions(name: string): string {
  return `4. **Databricks CLI**: \`pip install databricks-cli && databricks configure --token\`
5. **Personal Access Token**: With cluster create + jobs manage permissions
6. **Unity Catalog** enabled workspace

### 🔧 Setup

\`\`\`bash
# 1. Clone and install
git clone <repo-url> && cd ${name}
pip install -r requirements.txt

# 2. Configure Databricks CLI
databricks configure --token
# Enter: host = https://your-workspace.cloud.databricks.com
# Enter: token = dapi_xxxxx

# 3. Verify connectivity
databricks workspace ls /
\`\`\`

### 🚀 Deploy

\`\`\`bash
# 4. Upload notebooks/code
databricks workspace import_dir ./src /Shared/${name} --overwrite

# 5. Create the job
databricks jobs create --json-file jobs/${name}.json
# Note the job_id from output

# 6. Run initial execution
databricks jobs run-now --job-id <JOB_ID>
\`\`\`

### ✅ Verify

\`\`\`bash
# Check run status
databricks runs get --run-id <RUN_ID>
# Expected: "state": { "result_state": "SUCCESS" }

# Check Delta tables created
databricks workspace ls /Shared/${name}/
\`\`\`

### 🔄 Rollback
\`\`\`bash
databricks jobs delete --job-id <JOB_ID>
databricks workspace rm -r /Shared/${name}
\`\`\`
`;
}

function getSnowflakeInstructions(name: string): string {
  return `4. **SnowSQL**: \`brew install snowflake-snowsql\` or download from Snowflake
5. **Account**: Active Snowflake account with SYSADMIN or ACCOUNTADMIN role
6. **Warehouse**: Permission to CREATE WAREHOUSE, CREATE DATABASE

### 🔧 Setup

\`\`\`bash
# 1. Clone and install
git clone <repo-url> && cd ${name}

# 2. Configure SnowSQL
snowsql -a <account> -u <username>
# Enter password when prompted
\`\`\`

### 🚀 Deploy

\`\`\`sql
-- 3. Create database objects
snowsql -f sql/01_create_database.sql
snowsql -f sql/02_create_schemas.sql
snowsql -f sql/03_create_tables.sql

-- 4. Create tasks (scheduled execution)
snowsql -f sql/04_create_tasks.sql

-- 5. Resume root task (starts the schedule)
ALTER TASK ${name}_root_task RESUME;
\`\`\`

### ✅ Verify

\`\`\`sql
-- Check task history
SELECT * FROM TABLE(information_schema.task_history())
WHERE name = '${name.toUpperCase()}_ROOT_TASK'
ORDER BY scheduled_time DESC LIMIT 5;

-- Check data
SELECT COUNT(*) FROM ${name}_db.silver.main_table;
\`\`\`

### 🔄 Rollback
\`\`\`sql
ALTER TASK ${name}_root_task SUSPEND;
DROP DATABASE IF EXISTS ${name}_db CASCADE;
\`\`\`
`;
}


function getAzureInstructions(name: string): string {
  return `4. **Azure CLI**: \`az login\`
5. **Subscription**: Active Azure subscription with Contributor role
6. **Resource Group**: Target resource group created

### 🔧 Setup

\`\`\`bash
# 1. Clone and install
git clone <repo-url> && cd ${name}
pip install -r requirements.txt

# 2. Login to Azure
az login
az account set --subscription <SUBSCRIPTION_ID>

# 3. Verify access
az group show --name <RESOURCE_GROUP>
\`\`\`

### 🚀 Deploy

\`\`\`bash
# 4. Deploy ARM/Bicep templates
az deployment group create \\
  --resource-group <RG> \\
  --template-file infra/main.bicep \\
  --parameters pipelineName=${name}

# 5. Deploy ADF pipeline
az datafactory pipeline create \\
  --resource-group <RG> \\
  --factory-name ${name}-adf \\
  --name ${name}-pipeline \\
  --pipeline @pipelines/${name}.json

# 6. Trigger first run
az datafactory pipeline create-run \\
  --resource-group <RG> \\
  --factory-name ${name}-adf \\
  --name ${name}-pipeline
\`\`\`

### ✅ Verify
\`\`\`bash
az datafactory pipeline-run show --resource-group <RG> \\
  --factory-name ${name}-adf --run-id <RUN_ID>
\`\`\`

### 🔄 Rollback
\`\`\`bash
az deployment group delete --resource-group <RG> --name ${name}
\`\`\`
`;
}

function getGenericInstructions(name: string): string {
  return `4. **Docker** (v24+): \`docker --version\`
5. **Docker Compose** (v2.20+): \`docker compose version\`

### 🔧 Setup & Deploy

\`\`\`bash
# 1. Clone and install
git clone <repo-url> && cd ${name}

# 2. Configure environment
cp .env.example .env && vim .env

# 3. Build and run
docker compose up -d

# 4. Check logs
docker compose logs -f ${name}-worker
\`\`\`

### ✅ Verify
\`\`\`bash
docker compose ps  # All services should be "Up"
curl http://localhost:8080/health  # Should return 200
\`\`\`

### 🔄 Rollback
\`\`\`bash
docker compose down -v
git checkout main
docker compose up -d
\`\`\`
`;
}
