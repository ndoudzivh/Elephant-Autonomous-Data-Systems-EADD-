# ProACT Kenya Pipeline

GitLab CI/CD pipeline for deploying ProACT model scores to SAS Viya CAS across three environments (Dev, UAT, Prod) and three model destinations (Simulation, Scenario Planning, Operational).

## Pipeline Flow

```
                        ┌─────────────────────────────────────────────────────┐
  SIMULATION            │  Preflight → Publish → Verify → Approve (manual)   │
  KE_model_simulation   └─────────────────────────────────────────────────────┘

                        ┌─────────────────────────────────────────────────────┐
  SCENARIO PLANNING     │  Preflight → Publish → Verify → Approve (manual)   │
  KE_model_scenario     └─────────────────────────────────────────────────────┘

                        ┌─────────────────────────────────────────────────────┐
  OPERATIONAL           │  Preflight → Publish → Approve (manual) → Monitor  │
  KE_model_operational  └─────────────────────────────────────────────────────┘
```

## Branch → Environment Mapping

| Branch | Environment | Description |
|--------|-------------|-------------|
| `develop` | Dev | Development/sandbox |
| `release/*` | UAT | User Acceptance Testing |
| `main` | Prod | Production |

## Quick Start

1. Configure GitLab CI/CD variables (see [docs/GITLAB_VARIABLES.md](docs/GITLAB_VARIABLES.md))
2. Set up environments and protected branches (see [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md))
3. Push to `develop` to trigger Dev pipeline
4. Merge to `release/*` for UAT
5. Merge to `main` for Production

## Project Structure

```
proact-kenya-pipeline/
├── .gitlab-ci.yml              # Pipeline definition
├── README.md
├── docs/
│   ├── ENVIRONMENT_SETUP.md    # Full environment setup guide
│   └── GITLAB_VARIABLES.md     # CI/CD variable reference
├── sas/
│   ├── preflight/
│   │   └── preflight_check.sas # CAS/Denodo connectivity checks
│   ├── publish/
│   │   ├── publish_simulation.sas
│   │   ├── publish_scenario.sas
│   │   └── publish_operational.sas
│   ├── verify/
│   │   └── verify_scoring.sas  # Row count, column, data quality checks
│   └── monitor/
│       └── monitor_scoring.sas # Post-deploy operational monitoring
└── scripts/
    └── run_sas_program.ps1     # PowerShell executor for SAS Viya
```

## Technology Stack

- **SAS Viya** (CAS compute engine)
- **Denodo** (data virtualization, ODBC)
- **GitLab CI/CD** (pipeline orchestration)
- **PowerShell** (runner executor)

## Owner

A271668 — ProACT Kenya Team
