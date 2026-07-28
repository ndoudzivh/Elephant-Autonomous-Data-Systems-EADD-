# GitLab CI/CD Variables Reference

## How to Configure

1. Navigate to your project: `https://gitlab.standardbank.co.za/A271668/proact-kenya-pipeline`
2. Go to **Settings → CI/CD → Variables → Expand**
3. Add each variable below

## Variables to Add

### Global Variables (All Environments)

| Key | Value | Protected | Masked | Scope |
|-----|-------|-----------|--------|-------|
| `SAS_VIYA_URL` | `https://sasviya.tc00828-app.afs1-prod.aws-za.sbgrp.cloud` | Yes | No | All |
| `SAS_USER` | *(service account)* | Yes | Yes | All |
| `SAS_PASSWORD` | *(encoded password)* | Yes | Yes | All |
| `DENODO_USER` | *(AD username)* | Yes | Yes | All |
| `DENODO_PASSWORD` | `{SAS002}2A9EC31325E4A21B159AD9FE434A3AE850F29B5A2CA3B29E26263C1C5802B03A` | Yes | Yes | All |
| `MODEL_PREFIX` | `KE` | No | No | All |

### Environment-Scoped Variables

#### Dev (scope: `dev`)

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR1_test` | No | No |
| `CASLIB_SUFFIX` | `_Dev` | No | No |

#### UAT (scope: `uat`)

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR1_test` | No | No |
| `CASLIB_SUFFIX` | `_UAT` | No | No |

#### Prod (scope: `prod`)

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `DENODO_DSN` | `Denodo_AR_Prod` | Yes | No |
| `CASLIB_SUFFIX` | *(empty string)* | No | No |

---

## Setting Environment Scope in GitLab

When adding a variable:
1. Click **Add Variable**
2. Fill in Key and Value
3. Under **Environment scope**, change from `All (default)` to the specific environment name (`dev`, `uat`, or `prod`)
4. Check **Protect variable** for production secrets
5. Check **Mask variable** for passwords/tokens
6. Click **Add variable**

> **Important:** If a variable should differ per environment, add it 3 times with different scopes (not once with scope "All").

---

## Variable Inheritance Diagram

```
┌─────────────────────────────────────────┐
│  GitLab CI/CD Variables (Project-level) │
├─────────────────────────────────────────┤
│                                         │
│  Scope: All environments                │
│  ├── SAS_VIYA_URL                       │
│  ├── SAS_USER (masked)                  │
│  ├── SAS_PASSWORD (masked)              │
│  ├── DENODO_USER (masked)               │
│  ├── DENODO_PASSWORD (masked)           │
│  └── MODEL_PREFIX = KE                  │
│                                         │
│  Scope: dev                             │
│  ├── DENODO_DSN = Denodo_AR1_test       │
│  └── CASLIB_SUFFIX = _Dev              │
│                                         │
│  Scope: uat                             │
│  ├── DENODO_DSN = Denodo_AR1_test       │
│  └── CASLIB_SUFFIX = _UAT             │
│                                         │
│  Scope: prod (protected)                │
│  ├── DENODO_DSN = Denodo_AR_Prod        │
│  └── CASLIB_SUFFIX = (empty)           │
│                                         │
└─────────────────────────────────────────┘
```
