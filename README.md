# EADD — Elephant Autonomous Data Systems

> AI-powered data engineering platform that builds, tests, and deploys production data pipelines through conversation.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-EADD_AI-blue?logo=linkedin)](https://www.linkedin.com/company/elephant-autonomous-data-systems-eadd-ai-/)
[![Live Demo](https://img.shields.io/badge/Live-elephant--pod.vercel.app-green)](https://elephant-pod.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-ndoudzivh-black?logo=github)](https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-)

## What is EADD?

EADD is a multi-agent AI platform that works as an entire data engineering team. Describe the pipeline you need in plain English, and it generates production-ready code — complete with Lakehouse Bronze/Silver/Gold architecture, data quality checks, cost estimates, educational explanations, and deployment instructions.

**Key Features:**
- 🤖 **12 Specialized AI Agents** with dynamic routing
- 🏛️ **Lakehouse Architecture** (Bronze → Silver → Gold medallion layers)
- 📝 **Code Accuracy Validation** (catches .with() → .withColumn() and 50+ common mistakes)
- 🎓 **Educational Explanations** (explains WHY every decision is made, like a mentor)
- 📊 **Step-by-Step Delivery** (complex builds broken into confirmable layers)
- 💰 **Cost Estimates** on every solution (ZAR + USD, scaling projections)
- 🚀 **Deployment Instructions** at the end of every solution
- 📁 **File Upload** with auto-schema discovery and pipeline generation
- 🔗 **Repo Connect** (GitHub/GitLab) with pipeline/schema scanning
- 🔐 **Policy Gate** — production deploys require human approval

**It is NOT:**
- A system where the LLM ever sees row-level data
- A system where production deployment happens without explicit human approval

## Architecture

```
User (Chat) --> Next.js Frontend --> Express API --> AWS Bedrock (Claude)
                                        |
                     +------------------+------------------+
                     |                  |                  |
              Schema Engine    Compiler Backends    Mapping Engine
              (YAML Spec)      (AWS/Azure/dbt)     (Star/Vault/SCD2)
                     |                  |                  |
              Quality Engine   Orchestration Engine   Execution Engine
              (Checks/Score)   (Airflow/Dagster/CI)  (Sandbox/Prod)
```

## Packages

| Package | Description |
|---------|-------------|
| `@eadpa/frontend` | Next.js + Tailwind + ShadCN conversational UI |
| `@eadpa/backend` | Express API with streaming SSE, WebSocket support |
| `@eadpa/shared` | TypeScript types and utilities |
| `@eadpa/schema-engine` | YAML pipeline schema validator and parser |
| `@eadpa/compiler-core` | Plugin interface for compiler backends |
| `@eadpa/compiler-aws` | AWS backend (Glue, S3, Athena, Step Functions, Lambda, Terraform) |
| `@eadpa/mapping-engine` | Source-to-target mapping, model generation, drift detection |
| `@eadpa/quality-engine` | Data quality checks, scoring, quarantine, reporting |
| `@eadpa/orchestration-engine` | Airflow, Dagster, GitHub Actions, GitLab CI generators |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (optional, for local services)

### Development

```bash
# Install dependencies
pnpm install

# Start development (frontend + backend)
pnpm dev

# Or start individually
cd packages/frontend && pnpm dev   # http://localhost:3000
cd packages/backend && pnpm dev    # http://localhost:4000
```

### With Docker (full stack)

```bash
docker-compose up -d
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
# DynamoDB: http://localhost:8000
```

## How It Works

1. **Chat**: Describe the pipeline you want in natural language
2. **Generate**: The agent creates a cloud-agnostic YAML spec
3. **Compile**: YAML is compiled to platform-specific code (AWS Glue, dbt, etc.)
4. **Test**: Pipeline runs in sandbox with sample data (automatic)
5. **Deploy**: Production deployment requires explicit human approval

## Key Design Decisions

- **AI API**: AWS Bedrock (Claude) — keeps inference inside AWS network boundary
- **Multi-cloud**: Plugin architecture; YAML schema is cloud-agnostic, backends are plugins
- **Security**: LLM never sees row-level data; only schemas and metadata
- **Approval Gates**: Sandbox execution is automatic; production requires human review
- **Phase 1 Target**: AWS (Glue + S3 + Athena + Step Functions)

## Pipeline YAML Example

```yaml
name: customer-analytics
version: 1.0.0
metadata:
  owner: data-team
  schedule: "0 6 * * *"

source:
  type: postgres
  connection:
    secret_ref: secrets/customer-db/credentials
  incremental:
    enabled: true
    strategy: timestamp
    watermark_column: updated_at

layers:
  - layer: bronze
    format: delta
    load_mode: append
  - layer: silver
    format: delta
    load_mode: merge
    dedup:
      enabled: true
      columns: [customer_id]
      strategy: last
  - layer: gold
    format: delta
    load_mode: merge
    partitioning:
      columns: [date]
      type: date
      granularity: day

quality:
  enabled: true
  checks:
    - name: no_null_ids
      type: null
      severity: error
    - name: unique_customers
      type: unique
      severity: warning

target:
  cloud: aws
  region: us-east-1
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, ShadCN UI, Zustand, Framer Motion
- **Backend**: Node.js, Express, WebSocket (ws), Pino logger
- **AI**: AWS Bedrock (Claude Sonnet), streaming SSE
- **Infrastructure**: AWS (Glue, S3, Step Functions, Lambda, Athena, DynamoDB)
- **IaC**: Terraform
- **Testing**: Vitest, Great Expectations (generated), dbt tests (generated)

## Contributing

This is an active development project. See the requirements documents for the full vision and phasing plan.

## License

Proprietary - All rights reserved.
