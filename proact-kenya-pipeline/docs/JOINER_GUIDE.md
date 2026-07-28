# PROACT KENYA SCORING PIPELINE

## GitLab Implementation & Joiner Developer Guide

---

## 1. Overview

The **proact-kenya-pipeline** project is a structured GitLab CI/CD pipeline designed to automate SAS scoring workflows. It ensures consistent execution of:

* Preflight validation
* Publishing scoring datasets
* Verification of outputs
* Monitoring of scoring performance

The pipeline is triggered automatically on merge or manually when needed.

---

## 2. Project Structure

```
proact-kenya-pipeline/
├── .gitlab-ci.yml
├── .gitignore
├── README.md
├── docs/
│   ├── ENVIRONMENT_SETUP.md
│   ├── GITLAB_VARIABLES.md
│   └── JOINER_GUIDE.md
├── sas/
│   ├── preflight/preflight_check.sas
│   ├── publish/publish_simulation.sas
│   ├── publish/publish_scenario.sas
│   ├── publish/publish_operational.sas
│   ├── verify/verify_scoring.sas
│   └── monitor/monitor_scoring.sas
└── scripts/
    └── run_sas_program.ps1
```

---

## 3. How the Pipeline Works

### Execution Flow

1. **Preflight Check**

   * Validates environment, SAS connectivity, and dependencies.

2. **Publish Simulation**

   * Runs initial scoring simulation.

3. **Publish Scenario**

   * Executes scenario-based scoring logic.

4. **Publish Operational**

   * Deploys production-ready scoring outputs.

5. **Verify Scoring**

   * Runs validation checks on outputs.

6. **Monitor Scoring**

   * Captures logs, metrics, and execution status.

---

## 4. Prerequisites

Before implementation, ensure:

* GitLab access to the repository
* SAS Viya environment access
* PowerShell installed (Windows environment)
* Network/firewall access to SAS services

---

## 5. Step-by-Step Implementation

### Step 1: Clone the Repository

```bash
git clone <repo-url>
cd proact-kenya-pipeline
```

---

### Step 2: Configure GitLab CI/CD Variables

Navigate to:

**GitLab → Settings → CI/CD → Variables**

Add required variables (see `docs/GITLAB_VARIABLES.md`), such as:

* `SAS_URL`
* `SAS_USERNAME`
* `SAS_PASSWORD`
* `SAS_ENV`
* `SCRIPT_PATH`

> These variables are used securely during pipeline execution.

---

### Step 3: Setup Local Environment

Follow:

```
docs/ENVIRONMENT_SETUP.md
```

Key setup includes:

* Installing SAS CLI or API access
* Configuring authentication
* Testing PowerShell execution

---

### Step 4: Understand the Pipeline Configuration

Open:

```
.gitlab-ci.yml
```

This file defines:

* Pipeline stages
* Job execution order
* Scripts triggered per stage

Example stages:

```yaml
stages:
  - preflight
  - publish
  - verify
  - monitor
```

---

### Step 5: Execute SAS Programs

All SAS programs are executed via:

```
scripts/run_sas_program.ps1
```

Example usage:

```powershell
.\scripts\run_sas_program.ps1 -Program "sas/preflight/preflight_check.sas"
```

This script:

* Connects to SAS Viya
* Executes the SAS program
* Returns execution status

---

### Step 6: Make Changes (Development Workflow)

1. Create a new branch:

```bash
git checkout -b feature/your-change
```

2. Modify SAS scripts or configs

3. Commit changes:

```bash
git commit -m "Added new scoring logic"
```

4. Push branch:

```bash
git push origin feature/your-change
```

---

### Step 7: Create Merge Request (MR)

* Open Merge Request in GitLab
* Ensure pipeline runs successfully
* Request code review

---

### Step 8: Merge to Main

Once approved:

* Merge into `main` branch
* Pipeline triggers automatically
* Full scoring workflow executes

---

## 6. Key Files Explained

| File                          | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `.gitlab-ci.yml`              | Defines pipeline stages and jobs   |
| `sas/`                        | Contains all SAS execution logic   |
| `scripts/run_sas_program.ps1` | Executes SAS programs              |
| `docs/`                       | Setup and onboarding documentation |

---

## 7. Best Practices

* Always use feature branches
* Test SAS scripts locally before pushing
* Write clear commit messages
* Keep documentation updated
* Never hardcode credentials (use GitLab variables)

---

## 8. Troubleshooting

### Common Issues

**Pipeline Fails at Preflight**

* Check SAS connectivity
* Verify credentials

**SAS Script Fails**

* Review logs from GitLab job output
* Validate dataset paths

**Authentication Errors**

* Ensure GitLab variables are correct
* Reconfigure SAS access tokens

---

## 9. Onboarding New Developers

New joiners should:

1. Read `JOINER_GUIDE.md`
2. Setup environment
3. Run preflight locally
4. Execute a test pipeline
5. Shadow an existing developer

---

## 10. Summary

This pipeline enables:

* Automated SAS scoring execution
* Standardized deployment process
* Reliable validation and monitoring

It ensures consistency, scalability, and governance across all scoring operations.

---

## 11. Support

If you encounter issues:

* Check documentation in `/docs`
* Contact pipeline owner
* Raise a GitLab issue

---

**End of Document**
