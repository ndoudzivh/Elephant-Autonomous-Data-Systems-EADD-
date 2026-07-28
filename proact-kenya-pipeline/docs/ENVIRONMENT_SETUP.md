# ProACT Kenya Pipeline - Environment Setup Guide

## Overview

This pipeline deploys model scores across **3 environments** (Dev, UAT, Prod) and **3 model destinations** (Simulation, Scenario Planning, Operational) on SAS Viya via GitLab CI/CD.

---

## GitLab CI/CD Environment Variables

Configure these in **GitLab → Settings → CI/CD → Variables**.

### Required Variables (All Environments)

| Variable | Description | Example |
|----------|-------------|---------|
| `SAS_VIYA_URL` | SAS Viya base URL | `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud` |
| `SAS_USER` | Service account for SAS Viya compute | Service account ID |
| `SAS_PASSWORD` | Encoded password for SAS Viya | `{SAS002}...` |
| `DENODO_DSN` | Denodo ODBC Data Source Name | See per-environment below |
| `DENODO_USER` | Denodo username | AD username |
| `DENODO_PASSWORD` | Denodo encoded password | `{SAS002}...` |

### Per-Environment Values

| Variable | Dev | UAT | Prod |
|----------|-----|-----|------|
| `DENODO_DSN` | `Denodo_AR1_test` | `Denodo_AR1_test` | `Denodo_AR_Prod` |
| `CASLIB_SUFFIX` | `_Dev` | `_UAT` | *(none)* |
| CASLib Name | `CAS_AR_CSE_Kenya_Dev` | `CAS_AR_CSE_Kenya_UAT` | `CAS_AR_CSE_Kenya` |

---

## GitLab Environment Configuration

### Step 1: Create Environments

Go to **GitLab → Deployments → Environments** and create:

1. **dev** — Development/sandbox environment
2. **uat** — User Acceptance Testing
3. **prod** — Production (protected)

### Step 2: Scope Variables to Environments

In **Settings → CI/CD → Variables**, add variables scoped per environment:

```
Variable: DENODO_DSN
  - Environment: dev  → Value: Denodo_AR1_test
  - Environment: uat  → Value: Denodo_AR1_test
  - Environment: prod → Value: Denodo_AR_Prod
```

### Step 3: Protect Production Environment

Go to **Settings → CI/CD → Environments → prod → Edit**:
- Enable **Required approvals** (set to 1+)
- Add **Allowed to deploy**: only authorized deployers
- Enable **Protected environment**

---

## Branch Strategy (GitFlow)

| Branch | Environment | Trigger |
|--------|-------------|---------|
| `develop` | Dev | Push to develop |
| `release/*` or `release` | UAT | Push to release branch |
| `main` | Prod | Merge to main |

### Workflow:
```
feature/* → develop (Dev)
develop → release/* (UAT)
release/* → main (Prod)
```

---

## GitLab Runner Configuration

### Runner Tag
All pipeline jobs use tag: **`proact`**

### Runner Requirements
- PowerShell executor (Windows or pwsh on Linux)
- Network access to:
  - SAS Viya instance (`sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud`)
  - Denodo ODBC (via DSN configured on runner host)
- Git client

---

## Pipeline Stages per Destination

### Simulation (`SB_model_simulation`)
```
Preflight → Publish → Verify → Approve (manual)
```

### Scenario Planning (`SB_model_scenario`)
```
Preflight → Publish → Verify → Approve (manual)
```

### Operational (`SB_model_operational`)
```
Preflight → Publish → Approve (manual) → Monitor
```

> **Note:** Operational has **Monitor** (post-approval scoring test) instead of a pre-approval Verify. This ensures the model is monitored in production after governance sign-off.

---

## CAS Library & Table Naming

| Destination | CAS Table Name | Denodo View |
|-------------|---------------|-------------|
| Simulation | `KE_model_simulation` | `vw_ke_proact_simulation` |
| Scenario Planning | `KE_model_scenario` | `vw_ke_proact_scenario` |
| Operational | `KE_model_operational` | `vw_ke_proact_operational` |

### CAS Connection Pattern
```sas
cas mysas;
libname mycas cas caslib="CAS_AR_CSE_Kenya_Dev";  /* or _UAT or no suffix for prod */
```

---

## Protected Branches Setup

In **GitLab → Settings → Repository → Protected Branches**:

| Branch | Allowed to Merge | Allowed to Push |
|--------|-----------------|-----------------|
| `main` | Maintainers | No one (MR only) |
| `release` | Developers + Maintainers | Developers + Maintainers |
| `develop` | Developers + Maintainers | Developers + Maintainers |

---

## Manual Approval Gates

The **Approve** stage uses `when: manual` in GitLab CI/CD:
- Pipeline pauses at Approve stage
- Authorized team member clicks "Play" to approve
- Set `allow_failure: false` to block downstream stages until approved

### Who Can Approve:
- Configure in **Settings → CI/CD → Protected environments**
- Recommended: At minimum 1 senior team member for UAT, 2 for Prod

---

## Quick Start Checklist

- [ ] Create GitLab project: `A271668/proact-kenya-pipeline`
- [ ] Create branches: `main`, `develop`, `release`
- [ ] Protect branches (see above)
- [ ] Create environments: `dev`, `uat`, `prod`
- [ ] Configure CI/CD variables (scoped per environment)
- [ ] Register GitLab runner with tag `proact`
- [ ] Create Denodo views: `vw_ke_proact_simulation`, `vw_ke_proact_scenario`, `vw_ke_proact_operational`
- [ ] Create CAS libraries: `CAS_AR_CSE_Kenya_Dev`, `CAS_AR_CSE_Kenya_UAT`, `CAS_AR_CSE_Kenya`
- [ ] Push code to `develop` and verify Dev pipeline runs
- [ ] Test UAT promotion via release branch
- [ ] Test Prod deployment via merge to main
