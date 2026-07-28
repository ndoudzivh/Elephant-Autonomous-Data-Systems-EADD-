# ProACT Kenya Pipeline — Joiner Setup Guide

> **Welcome!** This guide will walk you through everything you need to set up and run the ProACT Kenya CI/CD pipeline from scratch. Follow each section in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Access Requests](#2-access-requests)
3. [Clone the Repository](#3-clone-the-repository)
4. [GitLab Project Setup](#4-gitlab-project-setup)
5. [Create Branches](#5-create-branches)
6. [Create GitLab Environments](#6-create-gitlab-environments)
7. [Configure CI/CD Variables](#7-configure-cicd-variables)
8. [Protected Branches Setup](#8-protected-branches-setup)
9. [GitLab Runner Setup](#9-gitlab-runner-setup)
10. [SAS Viya CAS Libraries](#10-sas-viya-cas-libraries)
11. [Denodo Views](#11-denodo-views)
12. [Run Your First Pipeline](#12-run-your-first-pipeline)
13. [Day-to-Day Workflow](#13-day-to-day-workflow)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Before you start, make sure you have:

| Requirement | Description |
|-------------|-------------|
| **Standard Bank AD Account** | Your A-number (e.g., A271668) |
| **GitLab Access** | Account on `gitlab.standardbank.co.za` |
| **SAS Viya Access** | Login to `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud` |
| **Denodo Access** | Credentials for the `rsvrdpopsarlending` schema |
| **Git Client** | Git installed on your local machine |
| **PowerShell 7+** | For running scripts locally (optional for testing) |

---

## 2. Access Requests

Submit access requests for the following (if you don't already have them):

### 2.1 GitLab Project Access
- URL: `https://gitlab.standardbank.co.za/A271668/proact-kenya-pipeline`
- Request **Developer** role (or **Maintainer** if you will manage environments)
- Contact the project owner to be added

### 2.2 SAS Viya Access
- Instance: `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud`
- Request access to the **Compute** server
- Request access to CAS libraries:
  - `CAS_AR_CSE_Kenya_Dev` (Development)
  - `CAS_AR_CSE_Kenya_UAT` (UAT)
  - `CAS_AR_CSE_Kenya` (Production)

### 2.3 Denodo Access
- Request read access to schema: `rsvrdpopsarlending`
- DSN for testing: `Denodo_AR1_test`
- DSN for production: `Denodo_AR_Prod`

> **Tip:** Raise all access requests on Day 1. They can take 2–5 business days.

---

## 3. Clone the Repository

Open a terminal and run:

```bash
# Clone the repository
git clone https://gitlab.standardbank.co.za/A271668/proact-kenya-pipeline.git

# Navigate into the project
cd proact-kenya-pipeline

# Check you're on the main branch
git branch
```

You should see the following structure:

```
proact-kenya-pipeline/
├── .gitlab-ci.yml              ← Pipeline definition (DO NOT edit on main directly)
├── .gitignore
├── README.md
├── docs/
│   ├── ENVIRONMENT_SETUP.md
│   ├── GITLAB_VARIABLES.md
│   └── JOINER_GUIDE.md         ← You are here
├── sas/
│   ├── preflight/
│   │   └── preflight_check.sas
│   ├── publish/
│   │   ├── publish_simulation.sas
│   │   ├── publish_scenario.sas
│   │   └── publish_operational.sas
│   ├── verify/
│   │   └── verify_scoring.sas
│   └── monitor/
│       └── monitor_scoring.sas
└── scripts/
    └── run_sas_program.ps1
```

---

## 4. GitLab Project Setup

> **If the project already exists, skip to Section 5.**

### 4.1 Create a New Project (if starting from scratch)

1. Log in to `https://gitlab.standardbank.co.za`
2. Click **New Project** → **Create blank project**
3. Settings:
   - Project name: `proact-kenya-pipeline`
   - Project URL: `https://gitlab.standardbank.co.za/A271668/proact-kenya-pipeline`
   - Visibility: **Private**
   - Initialize with a README: **No** (we already have code)
4. Click **Create project**

### 4.2 Push Existing Code

```bash
cd proact-kenya-pipeline

# Add the remote
git remote add origin https://gitlab.standardbank.co.za/A271668/proact-kenya-pipeline.git

# Ensure main branch is named "main"
git branch -m main

# Push
git push -u origin main
```

---

## 5. Create Branches

The pipeline uses a **GitFlow** branching model:

```
feature/*  →  develop  →  release/*  →  main
              (Dev)        (UAT)        (Prod)
```

### Create the branches:

```bash
# Create develop branch (for Dev environment)
git checkout -b develop
git push -u origin develop

# Create release branch (for UAT environment)
git checkout -b release
git push -u origin release

# Go back to main
git checkout main
```

### Branch-to-Environment Mapping:

| Branch | Environment | When it runs |
|--------|-------------|--------------|
| `develop` | **Dev** | Every push to develop |
| `release` or `release/*` | **UAT** | Every push to release branch |
| `main` | **Prod** | Every merge to main |

---

## 6. Create GitLab Environments

1. Go to your project on GitLab
2. Navigate to **Deployments → Environments**
3. Click **New environment** and create these three:

| Name | External URL (optional) | Protected |
|------|------------------------|-----------|
| `dev` | *(leave blank)* | No |
| `uat` | *(leave blank)* | No |
| `prod` | *(leave blank)* | **Yes** |

### Protect Production Environment:

1. Go to **Settings → CI/CD → Protected environments**
2. Select `prod`
3. Set **Allowed to deploy**: Maintainers only
4. Set **Required approvals**: 1 (or more per your governance policy)

---

## 7. Configure CI/CD Variables

This is the most critical step. Variables inject secrets and environment-specific values into the pipeline.

### 7.1 Navigate to Variables

1. Go to **Settings → CI/CD**
2. Expand **Variables**
3. Click **Add variable** for each entry below

### 7.2 Global Variables (Scope: All Environments)

Add these variables with scope = **All (default)**:

| Key | Value | Type | Protected | Masked |
|-----|-------|------|-----------|--------|
| `SAS_VIYA_URL` | `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud` | Variable | Yes | No |
| `SAS_USER` | *(your SAS service account)* | Variable | Yes | **Yes** |
| `SAS_PASSWORD` | *(encoded password)* | Variable | Yes | **Yes** |
| `DENODO_USER` | *(your AD username)* | Variable | Yes | **Yes** |
| `DENODO_PASSWORD` | `{SAS002}2A9EC31325E4A21B159AD9FE434A3AE850F29B5A2CA3B29E26263C1C5802B03A` | Variable | Yes | **Yes** |
| `MODEL_PREFIX` | `KE` | Variable | No | No |

### 7.3 Environment-Scoped Variables

> **Important:** Add each variable **three times**, once per environment scope.

#### For Dev (Scope: `dev`):

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR1_test` | No | No |
| `CASLIB_SUFFIX` | `_Dev` | No | No |

#### For UAT (Scope: `uat`):

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR1_test` | No | No |
| `CASLIB_SUFFIX` | `_UAT` | No | No |

#### For Prod (Scope: `prod`):

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR_Prod` | **Yes** | No |
| `CASLIB_SUFFIX` | *(leave empty)* | No | No |

### 7.4 How to Set the Environment Scope

When clicking **Add variable**:
1. Fill in Key and Value
2. Look for the **Environment scope** dropdown
3. Change from `All (default)` to the specific environment name
4. Screenshot reference:

```
┌────────────────────────────────────────┐
│  Add variable                          │
├────────────────────────────────────────┤
│  Key:    DENODO_DSN                    │
│  Value:  Denodo_AR1_test               │
│  Type:   Variable                      │
│  Environment scope: [ dev ▼ ]  ← HERE │
│  ☐ Protect variable                   │
│  ☐ Mask variable                      │
│                                        │
│          [ Add variable ]              │
└────────────────────────────────────────┘
```

### 7.5 Verify Your Variables

After adding all variables, you should see this list:

```
SAS_VIYA_URL        → All environments
SAS_USER            → All environments (masked)
SAS_PASSWORD        → All environments (masked)
DENODO_USER         → All environments (masked)
DENODO_PASSWORD     → All environments (masked)
MODEL_PREFIX        → All environments
DENODO_DSN          → dev
DENODO_DSN          → uat
DENODO_DSN          → prod
CASLIB_SUFFIX       → dev
CASLIB_SUFFIX       → uat
CASLIB_SUFFIX       → prod
```

**Total: 12 variable entries**

---

## 8. Protected Branches Setup

1. Go to **Settings → Repository → Protected branches**
2. Configure as follows:

| Branch | Allowed to Merge | Allowed to Push | Allowed to Force Push |
|--------|-----------------|-----------------|----------------------|
| `main` | Maintainers | **No one** | No |
| `release` | Developers + Maintainers | Developers + Maintainers | No |
| `develop` | Developers + Maintainers | Developers + Maintainers | No |

> **Why?** `main` should only receive merges through Merge Requests (never direct pushes). This ensures the Prod pipeline only runs after code review.

---

## 9. GitLab Runner Setup

The pipeline requires a GitLab Runner with the tag **`proact`**.

### 9.1 Check if Runner Exists

1. Go to **Settings → CI/CD → Runners → Expand**
2. Look for a runner with tag `proact`
3. If it exists and shows a green circle (online), you're good!

### 9.2 Register a New Runner (if needed)

On the runner host machine (Windows with PowerShell):

```powershell
# Download GitLab Runner
# https://docs.gitlab.com/runner/install/windows.html

# Register the runner
gitlab-runner register `
  --url "https://gitlab.standardbank.co.za" `
  --registration-token "<TOKEN_FROM_GITLAB>" `
  --executor "shell" `
  --shell "powershell" `
  --tag-list "proact" `
  --description "ProACT Kenya Runner"
```

### 9.3 Runner Requirements

The runner host machine must have:
- [x] PowerShell 7+ installed
- [x] Network access to SAS Viya (`sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud`)
- [x] Denodo ODBC DSN configured (`Denodo_AR1_test` and `Denodo_AR_Prod`)
- [x] Git client installed
- [x] Tag: `proact`

---

## 10. SAS Viya CAS Libraries

The pipeline writes model scores to CAS libraries. These must exist on SAS Viya.

### Required CAS Libraries:

| CASLib Name | Environment | Purpose |
|-------------|-------------|---------|
| `CAS_AR_CSE_Kenya_Dev` | Dev | Development model scores |
| `CAS_AR_CSE_Kenya_UAT` | UAT | UAT model scores |
| `CAS_AR_CSE_Kenya` | Prod | Production model scores |

### How to Create a CASLib (if it doesn't exist):

1. Log in to SAS Viya: `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud`
2. Open **SAS Environment Manager → Data → CAS Libraries**
3. Click **Create CAS Library**
4. Settings:
   - Name: `CAS_AR_CSE_Kenya_Dev`
   - Type: Path-based (SASHDAT)
   - Path: `/data/cas/kenya/dev/` (or as per your admin)
5. Save

> **Note:** SAS Viya is in lockdown mode — no filesystem paths from SAS code. All data access goes through CAS libraries only.

### CAS Tables Created by Pipeline:

| CAS Table | Destination | Denodo Source View |
|-----------|-------------|-------------------|
| `KE_model_simulation` | Simulation | `vw_ke_proact_simulation` |
| `KE_model_scenario` | Scenario Planning | `vw_ke_proact_scenario` |
| `KE_model_operational` | Operational | `vw_ke_proact_operational` |

---

## 11. Denodo Views

The pipeline reads data from Denodo virtual views. These must exist before the pipeline can run.

### Required Denodo Views:

| View Name | Schema | DSN |
|-----------|--------|-----|
| `vw_ke_proact_simulation` | `rsvrdpopsarlending` | `Denodo_AR1_test` (test) / `Denodo_AR_Prod` (prod) |
| `vw_ke_proact_scenario` | `rsvrdpopsarlending` | Same as above |
| `vw_ke_proact_operational` | `rsvrdpopsarlending` | Same as above |

### How to Verify Denodo Access:

1. Open SAS Viya Studio
2. Run this test program:

```sas
libname _test_ odbc datasrc="Denodo_AR1_test"
    schema=rsvrdpopsarlending
    user="YOUR_AD_USER"
    password="YOUR_PASSWORD"
    dm_unicode="utf-16"
    PRESERVE_TAB_NAMES=YES;

proc datasets lib=_test_; quit;
libname _test_ clear;
```

If you see a list of tables, your Denodo access is working.

---

## 12. Run Your First Pipeline

### 12.1 Create a Feature Branch and Push to Develop

```bash
# Start from develop
git checkout develop

# Create a feature branch
git checkout -b feature/my-first-change

# Make a small change (e.g., add a comment to a SAS file)
echo "/* My first change */" >> sas/preflight/preflight_check.sas

# Commit and push
git add .
git commit -m "test: verify pipeline runs"
git push -u origin feature/my-first-change
```

### 12.2 Create a Merge Request to Develop

1. Go to GitLab → Your project
2. You'll see a banner: "Create merge request for feature/my-first-change"
3. Click it
4. Target branch: `develop`
5. Click **Create merge request**
6. Click **Merge**

### 12.3 Watch the Dev Pipeline Run

1. Go to **CI/CD → Pipelines**
2. You should see a new pipeline running on `develop`
3. It will execute:
   - `preflight:simulation:dev`
   - `preflight:scenario:dev`
   - `preflight:operational:dev`
   - Then publish, verify stages...
   - Stops at **Approve** stages (waiting for manual click)

### 12.4 Approve a Stage

1. In the pipeline view, find the **Approve** job (orange/paused icon)
2. Click the **Play** button (▶️) to approve
3. The pipeline continues to the next stage

### 12.5 Expected Pipeline View:

```
┌─────────────┐   ┌─────────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  PREFLIGHT  │ → │   PUBLISH   │ → │  VERIFY  │ → │ APPROVE  │ → │ MONITOR  │
│  (auto)     │   │   (auto)    │   │  (auto)  │   │ (manual) │   │  (auto)  │
└─────────────┘   └─────────────┘   └──────────┘   └──────────┘   └──────────┘
   3 jobs            3 jobs           2 jobs*        3 jobs         1 job*
```
*Verify runs for Simulation and Scenario only. Monitor runs for Operational only.

---

## 13. Day-to-Day Workflow

### Making Changes:

```bash
# 1. Always start from develop
git checkout develop
git pull origin develop

# 2. Create a feature branch
git checkout -b feature/update-model-logic

# 3. Make your changes to SAS files
# Edit files in sas/publish/ or sas/verify/ etc.

# 4. Commit with a meaningful message
git add .
git commit -m "feat: update operational scoring logic for new LGD model"

# 5. Push your branch
git push -u origin feature/update-model-logic

# 6. Create a Merge Request to develop (via GitLab UI)
# 7. Get it reviewed and merged → Dev pipeline runs automatically
```

### Promoting to UAT:

```bash
# Merge develop into release
git checkout release
git pull origin release
git merge develop
git push origin release
# → UAT pipeline runs automatically
```

### Promoting to Production:

```bash
# Create a Merge Request from release → main on GitLab
# Get approval from Maintainer
# Merge → Prod pipeline runs automatically
```

### Pipeline Stages Explained:

| Stage | What It Does | Auto/Manual |
|-------|-------------|-------------|
| **Preflight** | Checks CAS session works, Denodo ODBC connects, CASLib is writable | Auto |
| **Publish** | Extracts data from Denodo view → loads into CAS table (promoted) → saves to disk | Auto |
| **Verify** | Confirms CAS table exists, row count > 0, columns valid, data quality OK | Auto |
| **Approve** | Governance gate — someone must manually click to approve | **Manual** |
| **Monitor** | Post-deployment check — verifies operational table is accessible and healthy | Auto |

---

## 14. Troubleshooting

### Pipeline stuck at "pending"
- **Cause:** No runner with tag `proact` is available
- **Fix:** Check **Settings → CI/CD → Runners** — ensure a runner with tag `proact` is online (green dot)

### "Failed to start CAS session"
- **Cause:** SAS Viya is down or credentials are wrong
- **Fix:**
  1. Log in to SAS Viya manually to confirm it's up
  2. Check `SAS_USER` and `SAS_PASSWORD` variables in CI/CD settings
  3. Make sure the password is SAS-encoded: `{SAS002}...`

### "Denodo ODBC connection failed"
- **Cause:** DSN not configured on runner, wrong credentials, or network issue
- **Fix:**
  1. RDP/SSH into the runner machine
  2. Open ODBC Data Source Administrator → check DSN exists
  3. Test connection: `Test-Connection sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud`
  4. Verify `DENODO_USER` and `DENODO_PASSWORD` in CI/CD variables

### "CASLib not accessible"
- **Cause:** The CAS library doesn't exist yet or you don't have permission
- **Fix:**
  1. Log in to SAS Viya Environment Manager
  2. Go to Data → CAS Libraries
  3. Check the library exists (e.g., `CAS_AR_CSE_Kenya_Dev`)
  4. Check your AD account has read/write access to it

### "CAS table has 0 rows"
- **Cause:** Denodo view is empty or the query returned no data
- **Fix:**
  1. Query the Denodo view directly in SAS Studio
  2. Check filters/date ranges in the view definition
  3. Contact the Denodo team if the view was recently changed

### "Pipeline runs on wrong environment"
- **Cause:** You pushed to the wrong branch
- **Fix:** Check branch-environment mapping:
  - `develop` = Dev
  - `release/*` = UAT
  - `main` = Prod

### "Approve stage won't let me click Play"
- **Cause:** You don't have permission for that environment
- **Fix:** Ask a Maintainer to either approve it or add you to the protected environment's allowed deployers list

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────────────┐
│  ProACT Kenya Pipeline - Quick Reference                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GitLab URL:   gitlab.standardbank.co.za/A271668/                │
│                proact-kenya-pipeline                              │
│                                                                  │
│  SAS Viya:     sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud  │
│                                                                  │
│  Runner Tag:   proact                                            │
│                                                                  │
│  Branches:     develop → Dev                                     │
│                release/* → UAT                                    │
│                main → Prod                                        │
│                                                                  │
│  CASLibs:      CAS_AR_CSE_Kenya_Dev (dev)                       │
│                CAS_AR_CSE_Kenya_UAT (uat)                        │
│                CAS_AR_CSE_Kenya (prod)                            │
│                                                                  │
│  Denodo DSN:   Denodo_AR1_test (dev/uat)                         │
│                Denodo_AR_Prod (prod)                              │
│                                                                  │
│  Schema:       rsvrdpopsarlending                                │
│                                                                  │
│  Model Tables: KE_model_simulation                               │
│                KE_model_scenario                                  │
│                KE_model_operational                               │
│                                                                  │
│  Pipeline:     Preflight → Publish → Verify → Approve → Monitor │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Need Help?

| Topic | Contact |
|-------|---------|
| GitLab access | Project Owner (A271668) |
| SAS Viya access | SAS Platform Team |
| Denodo views | Data Engineering Team |
| Pipeline failures | Check CI/CD → Pipelines → Failed job logs |
| CAS library creation | SAS Administrator |

---

**Last Updated:** July 2026  
**Version:** 1.0
