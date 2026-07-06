# EADPA AWS Deployment Guide

## Quick Summary

| Step | Time | What |
|------|------|------|
| 1 | 5 min | Create AWS account |
| 2 | 5 min | Install tools (AWS CLI, Terraform, Node.js) |
| 3 | 2 min | Configure credentials |
| 4 | 1 min | Enable Bedrock (Claude) access |
| 5 | 5 min | Run deployment script |
| **Total** | **~18 min** | **You're live!** |

---

## Step 1: Create AWS Account

1. Go to **https://aws.amazon.com/free**
2. Click "Create a Free Account"
3. Enter email, password, account name
4. Add payment method (credit/debit card — won't be charged for free tier)
5. Verify phone number
6. Choose "Basic (Free)" support plan
7. Sign in to the console

---

## Step 2: Install Required Tools

### AWS CLI
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Windows - download from https://aws.amazon.com/cli/
```

### Terraform
```bash
# macOS
brew install terraform

# Linux
sudo apt-get install terraform
```

### Node.js + pnpm
```bash
# Install Node.js 20+ from https://nodejs.org
# Then:
npm install -g pnpm
```

---

## Step 3: Configure AWS Credentials

### Create an IAM user:
1. AWS Console → IAM → Users → "Create user"
2. User name: `eadpa-deployer`
3. Permissions: Attach `AdministratorAccess` policy (restrict later for production)
4. Security credentials → "Create access key" → CLI use case
5. Download/copy the Access Key ID and Secret

### Configure locally:
```bash
aws configure
# Enter:
#   Access Key ID: (from step above)
#   Secret Access Key: (from step above)
#   Region: us-east-1
#   Output format: json
```

### Verify:
```bash
aws sts get-caller-identity
# Should show your account ID
```

---

## Step 4: Enable Bedrock (Claude) Access

**This is a manual step in the AWS console:**

1. Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess
2. Click "Manage model access"
3. Find **Anthropic** → check **Claude 3.5 Sonnet** (or Claude 4 Sonnet if available)
4. Click "Save changes"
5. Wait for status: "Access granted" (usually instant)

> **Note**: Bedrock is available in us-east-1, us-west-2, eu-west-1, and ap-southeast-1.
> Use us-east-1 for the broadest model availability.

---

## Step 5: Deploy!

```bash
# From the repository root:
cd infrastructure/aws/scripts

# Make scripts executable
chmod +x *.sh

# Run the setup helper first (optional, checks everything)
./setup-aws-account.sh

# Deploy to dev environment
./deploy.sh dev
```

After ~5 minutes, you'll see:
```
============================================
  DEPLOYMENT COMPLETE!
============================================

  Frontend: https://d1234abcd.cloudfront.net
  Backend:  https://xyz123.lambda-url.us-east-1.on.aws/
============================================
```

Open the Frontend URL in your browser — you're live!

---

## Cost Breakdown (Development Usage)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Lambda | $0 | Free tier: 1M requests/month |
| DynamoDB | $0 | Free tier: 25GB, 200M requests |
| S3 | $0.05 | Free tier: 5GB for 12 months |
| CloudFront | $0 | Free tier: 1TB transfer |
| Bedrock (Claude) | $5-25 | Pay per token (~$3/1M input, $15/1M output) |
| **Total** | **~$5-25/month** | Mostly AI inference costs |

> **To stop all charges:** Run `./teardown.sh dev` to destroy everything.

---

## Troubleshooting

### "Bedrock model not available"
→ Enable model access in console (Step 4 above)

### "Lambda timeout"
→ Increase timeout in terraform (currently 300s / 5 min)

### "CloudFront 403"
→ Wait 5-10 minutes for propagation after first deploy

### "CORS error in browser"
→ The Lambda Function URL has CORS configured; check if your frontend URL matches

---

## Production Deployment (Later)

For production, you'll want to add:
- Custom domain (Route 53 + ACM certificate)
- WAF (Web Application Firewall) on CloudFront
- Cognito for user authentication
- VPC for Lambda (if connecting to private databases)
- Budget alerts (AWS Budgets)
- CloudWatch alarms for monitoring

These are Phase 2+ concerns — get dev working first!
