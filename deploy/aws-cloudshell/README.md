# 🐘 EADD — AWS CloudShell Deployment

Deploy the entire EADD (Elephant Autonomous Data Systems) platform from AWS CloudShell in one command.

## Quick Start

Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell/) and paste:

```bash
git clone --depth 1 -b eadpa-phase0-foundation https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-.git
cd Elephant-Autonomous-Data-Systems-EADD-/deploy/aws-cloudshell
chmod +x deploy-eadd.sh && ./deploy-eadd.sh
```

## What Gets Deployed

| Resource | Name | Purpose |
|----------|------|---------|
| Lambda | `eadd-backend-api` | Backend API (Node.js 18) with Bedrock AI |
| API Gateway | `eadd-dev-api` | HTTPS endpoint for frontend |
| S3 Buckets | `eadd-dev-data-lake`, `-artifacts`, `-config` | Storage |
| DynamoDB | `eadd-dev-sessions`, `-pipelines`, `-conversations` | State |
| IAM Role | `eadd-dev-lambda-role` | Permissions for Lambda |
| CloudWatch | Dashboard + Error Alarms | Monitoring |

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy-eadd.sh` | Full deployment (first time) |
| `update-lambda.sh` | Quick code update (no infra changes) |
| `teardown.sh` | Delete ALL resources (**destructive**) |
| `quick-start.sh` | One-liner download + deploy |

## Environment Variables

Set these BEFORE running if you want non-default values:

```bash
export AWS_REGION=us-east-1         # Default: us-east-1
export EADD_ENV=dev                 # Default: dev (options: dev, staging, prod)
```

## After Deployment

1. **Test the API**:
   ```bash
   curl https://<API_ID>.execute-api.us-east-1.amazonaws.com/health
   ```

2. **Update Vercel frontend**:
   - Go to [Vercel Dashboard](https://vercel.com) → elephant-pod → Settings → Environment Variables
   - Set `NEXT_PUBLIC_API_URL` = your API Gateway URL

3. **Enable Bedrock Model Access**:
   - Go to AWS Console → Bedrock → Model Access
   - Enable `anthropic.claude-sonnet-4-20250514`

4. **View Logs**:
   ```bash
   aws logs tail /aws/lambda/eadd-backend-api --follow --region us-east-1
   ```

5. **View Dashboard**:
   - AWS Console → CloudWatch → Dashboards → `eadd-dev-dashboard`

## Cost Estimate

| Service | Monthly (USD) | Notes |
|---------|--------------|-------|
| Lambda | ~$0-5 | Pay per request, free tier covers 1M requests |
| API Gateway | ~$0-3 | $1 per million requests |
| DynamoDB | ~$0-5 | Pay per request, free tier covers 25GB |
| S3 | ~$0-2 | $0.023/GB/month |
| Bedrock (Claude) | ~$5-50 | $3/1M input tokens, $15/1M output tokens |
| CloudWatch | ~$0-3 | Logs + metrics |
| **Total** | **~$5-70** | Depends on usage |

## Troubleshooting

### "Access Denied" errors
Your IAM user/role needs these permissions:
- `lambda:*`
- `apigateway:*`
- `s3:*`
- `dynamodb:*`
- `iam:*`
- `cloudwatch:*`
- `logs:*`
- `bedrock:*`

### Lambda timeout
Increase timeout: `aws lambda update-function-configuration --function-name eadd-backend-api --timeout 300`

### Bedrock "model not available"
You must manually enable model access in the AWS Console:
AWS Console → Bedrock → Model Access → Request Access → Claude Sonnet

### CloudShell storage limit
CloudShell has 1GB persistent storage. If you run out:
```bash
rm -rf /tmp/eadd-*
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                           │
│  elephant-pod.vercel.app                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway (HTTP API)                                      │
│  eadd-dev-api.execute-api.us-east-1.amazonaws.com            │
└──────────────────────────┬──────────────────────────────────┘
                           │ Lambda Proxy
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Lambda: eadd-backend-api                                    │
│  ├── Agent Orchestrator (12 AI agents)                       │
│  ├── Bedrock Client (Claude AI)                              │
│  ├── Pipeline Generator                                      │
│  └── Output Quality Pipeline (code validator + explainer)    │
└────┬────────────────┬────────────────┬──────────────────────┘
     │                │                │
     ▼                ▼                ▼
┌─────────┐   ┌───────────┐   ┌──────────────┐
│ DynamoDB │   │ S3 Buckets│   │ AWS Bedrock  │
│ (state)  │   │ (storage) │   │ (Claude AI)  │
└──────────┘   └───────────┘   └──────────────┘
```

## Cleanup

To remove ALL EADD resources:

```bash
chmod +x teardown.sh
./teardown.sh
```

⚠️ This is **irreversible**. All data will be deleted.
