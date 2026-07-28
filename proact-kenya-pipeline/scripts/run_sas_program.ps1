# =============================================================================
# ProACT Kenya Pipeline - SAS Program Runner (PowerShell)
# =============================================================================
# Executes a SAS program against SAS Viya via the sas-viya CLI or REST API.
#
# Usage:
#   .\run_sas_program.ps1 -Program "sas/preflight/preflight_check.sas" -Env "dev" -Destination "simulation"
#
# Environment variables (from GitLab CI/CD):
#   SAS_VIYA_URL     - SAS Viya base URL
#   SAS_USER         - Service account username
#   SAS_PASSWORD     - Service account password
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Program,

    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "uat", "prod")]
    [string]$Env,

    [Parameter(Mandatory=$true)]
    [ValidateSet("simulation", "scenario_planning", "operational")]
    [string]$Destination
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$SasViyaUrl = $env:SAS_VIYA_URL
$SasUser = $env:SAS_USER
$SasPassword = $env:SAS_PASSWORD

if (-not $SasViyaUrl) {
    Write-Error "SAS_VIYA_URL environment variable is not set."
    exit 1
}

if (-not $SasUser -or -not $SasPassword) {
    Write-Error "SAS_USER or SAS_PASSWORD environment variable is not set."
    exit 1
}

# ---------------------------------------------------------------------------
# Resolve program path
# ---------------------------------------------------------------------------
$ProgramPath = Join-Path $PSScriptRoot ".." $Program
if (-not (Test-Path $ProgramPath)) {
    Write-Error "SAS program not found: $ProgramPath"
    exit 1
}

$ProgramContent = Get-Content $ProgramPath -Raw
Write-Host "================================================================="
Write-Host "ProACT Kenya Pipeline - SAS Program Runner"
Write-Host "================================================================="
Write-Host "Program:     $Program"
Write-Host "Environment: $Env"
Write-Host "Destination: $Destination"
Write-Host "SAS Viya:    $SasViyaUrl"
Write-Host "================================================================="

# ---------------------------------------------------------------------------
# Authenticate with SAS Viya
# ---------------------------------------------------------------------------
Write-Host "`nStep 1: Authenticating with SAS Viya..."

$AuthBody = @{
    grant_type = "password"
    username   = $SasUser
    password   = $SasPassword
} | ConvertTo-Json

try {
    $TokenResponse = Invoke-RestMethod -Method Post `
        -Uri "$SasViyaUrl/SASLogon/oauth/token" `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "grant_type=password&username=$SasUser&password=$SasPassword" `
        -Headers @{
            "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("sas.cli:"))
        }

    $AccessToken = $TokenResponse.access_token
    Write-Host "Authentication successful."
}
catch {
    Write-Error "Authentication failed: $($_.Exception.Message)"
    exit 1
}

# ---------------------------------------------------------------------------
# Submit SAS Program via Compute API
# ---------------------------------------------------------------------------
Write-Host "`nStep 2: Creating compute session..."

$Headers = @{
    "Authorization" = "Bearer $AccessToken"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# Create compute session
try {
    $SessionResponse = Invoke-RestMethod -Method Post `
        -Uri "$SasViyaUrl/compute/sessions" `
        -Headers $Headers `
        -Body (@{ name = "proact-kenya-$Env-$Destination" } | ConvertTo-Json)

    $SessionId = $SessionResponse.id
    Write-Host "Compute session created: $SessionId"
}
catch {
    Write-Error "Failed to create compute session: $($_.Exception.Message)"
    exit 1
}

# ---------------------------------------------------------------------------
# Execute SAS code with SYSPARM
# ---------------------------------------------------------------------------
Write-Host "`nStep 3: Submitting SAS program..."

$SysParm = "ENV=$Env&DESTINATION=$Destination"
$SasCode = "%let SYSPARM = $SysParm;`n$ProgramContent"

try {
    $JobBody = @{
        code = $SasCode
    } | ConvertTo-Json -Depth 10

    $JobResponse = Invoke-RestMethod -Method Post `
        -Uri "$SasViyaUrl/compute/sessions/$SessionId/jobs" `
        -Headers $Headers `
        -Body $JobBody

    $JobId = $JobResponse.id
    Write-Host "Job submitted: $JobId"
}
catch {
    Write-Error "Failed to submit SAS job: $($_.Exception.Message)"
    exit 1
}

# ---------------------------------------------------------------------------
# Poll for job completion
# ---------------------------------------------------------------------------
Write-Host "`nStep 4: Waiting for job completion..."

$MaxWait = 1800  # 30 minutes max
$Elapsed = 0
$PollInterval = 10

do {
    Start-Sleep -Seconds $PollInterval
    $Elapsed += $PollInterval

    $StatusResponse = Invoke-RestMethod -Method Get `
        -Uri "$SasViyaUrl/compute/sessions/$SessionId/jobs/$JobId/state" `
        -Headers $Headers

    $State = $StatusResponse.value
    Write-Host "  [$Elapsed s] Job state: $State"

} while ($State -notin @("completed", "failed", "canceled", "error") -and $Elapsed -lt $MaxWait)

# ---------------------------------------------------------------------------
# Retrieve log and check results
# ---------------------------------------------------------------------------
Write-Host "`nStep 5: Retrieving job log..."

try {
    $LogResponse = Invoke-RestMethod -Method Get `
        -Uri "$SasViyaUrl/compute/sessions/$SessionId/jobs/$JobId/log" `
        -Headers $Headers

    foreach ($line in $LogResponse.items) {
        $logLine = $line.line
        if ($logLine -match "^ERROR") {
            Write-Host "  $logLine" -ForegroundColor Red
        }
        elseif ($logLine -match "^WARNING") {
            Write-Host "  $logLine" -ForegroundColor Yellow
        }
        else {
            Write-Host "  $logLine"
        }
    }
}
catch {
    Write-Warning "Could not retrieve full log: $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# Cleanup session
# ---------------------------------------------------------------------------
Write-Host "`nStep 6: Cleaning up compute session..."

try {
    Invoke-RestMethod -Method Delete `
        -Uri "$SasViyaUrl/compute/sessions/$SessionId" `
        -Headers $Headers | Out-Null
    Write-Host "Session terminated."
}
catch {
    Write-Warning "Session cleanup warning: $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# Final result
# ---------------------------------------------------------------------------
if ($State -eq "completed") {
    Write-Host "`n================================================================="
    Write-Host "SUCCESS: SAS program completed successfully."
    Write-Host "================================================================="
    exit 0
}
else {
    Write-Error "FAILED: SAS program ended with state: $State"
    exit 1
}
