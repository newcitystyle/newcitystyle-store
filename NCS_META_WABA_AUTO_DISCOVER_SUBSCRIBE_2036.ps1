$ErrorActionPreference = "Stop"

$ProjectRoot = "D:\NewCityStyleApp\new-city-style"
$TokenFile = Join-Path $ProjectRoot "meta_management_token.txt"
$GraphVersion = "v26.0"
$BusinessId = "435123519690455"

function Show-MetaError {
    param([System.Management.Automation.ErrorRecord]$Err)

    Write-Host $Err.Exception.Message -ForegroundColor Red

    try {
        if ($Err.ErrorDetails -and $Err.ErrorDetails.Message) {
            $raw = $Err.ErrorDetails.Message
            Write-Host $raw -ForegroundColor Yellow
        }
    } catch {}
}

function Invoke-MetaGet {
    param(
        [string]$Url,
        [hashtable]$Headers
    )

    return Invoke-RestMethod `
        -Method Get `
        -Uri $Url `
        -Headers $Headers
}

Write-Host ""
Write-Host "NEW CITY STYLE - AUTO DISCOVER + SUBSCRIBE WABA" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $TokenFile)) {
    Write-Host "TOKEN FILE NOT FOUND:" -ForegroundColor Red
    Write-Host $TokenFile -ForegroundColor Yellow
    exit 1
}

$token = (Get-Content $TokenFile -Raw).Trim().Trim('"').Trim("'")

if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 50) {
    Write-Host "TOKEN LOOKS INVALID. Length: $($token.Length)" -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
}

$base = "https://graph.facebook.com/$GraphVersion"

Write-Host "Token length: $($token.Length)" -ForegroundColor DarkGray
Write-Host "Business ID: $BusinessId" -ForegroundColor DarkGray
Write-Host "Graph API: $GraphVersion" -ForegroundColor DarkGray
Write-Host ""

try {
    Write-Host "[1/5] Checking token..." -ForegroundColor Cyan

    $me = Invoke-MetaGet `
        -Url "$base/me?fields=id,name" `
        -Headers $headers

    Write-Host "TOKEN OK: $($me.name) [$($me.id)]" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "TOKEN CHECK FAILED" -ForegroundColor Red
    Show-MetaError $_
    exit 1
}

$allWabas = @()

try {
    Write-Host ""
    Write-Host "[2/5] Looking for OWNED WhatsApp Business Accounts..." -ForegroundColor Cyan

    $owned = Invoke-MetaGet `
        -Url "$base/$BusinessId/owned_whatsapp_business_accounts?fields=id,name&limit=100" `
        -Headers $headers

    if ($owned.data) {
        $allWabas += @($owned.data)
    }

    Write-Host "Owned WABAs found: $(@($owned.data).Count)" -ForegroundColor Green
}
catch {
    Write-Host "Owned WABA lookup failed." -ForegroundColor Yellow
    Show-MetaError $_
}

try {
    Write-Host ""
    Write-Host "[3/5] Looking for CLIENT WhatsApp Business Accounts..." -ForegroundColor Cyan

    $client = Invoke-MetaGet `
        -Url "$base/$BusinessId/client_whatsapp_business_accounts?fields=id,name&limit=100" `
        -Headers $headers

    if ($client.data) {
        $allWabas += @($client.data)
    }

    Write-Host "Client WABAs found: $(@($client.data).Count)" -ForegroundColor Green
}
catch {
    Write-Host "Client WABA lookup failed." -ForegroundColor Yellow
    Show-MetaError $_
}

$allWabas = @(
    $allWabas |
    Where-Object { $_.id } |
    Sort-Object id -Unique
)

Write-Host ""

if ($allWabas.Count -eq 0) {
    Write-Host "NO WABA WAS VISIBLE TO THIS TOKEN." -ForegroundColor Red
    Write-Host ""
    Write-Host "The token itself is valid, but this system user currently cannot enumerate a WhatsApp Business Account under Business ID $BusinessId." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Do NOT change or revoke the existing production WHATSAPP_ACCESS_TOKEN." -ForegroundColor Yellow
    Write-Host "Next fix is in Meta Business Settings: assign the NEW CITY STYLE WhatsApp account to NCS Automation with Full control, then generate a fresh token with:" -ForegroundColor Yellow
    Write-Host "  business_management" -ForegroundColor Yellow
    Write-Host "  whatsapp_business_management" -ForegroundColor Yellow
    Write-Host "  whatsapp_business_messaging" -ForegroundColor Yellow
    exit 2
}

Write-Host "WABAs visible to NCS Automation:" -ForegroundColor Green

foreach ($waba in $allWabas) {
    $displayName = if ($waba.name) { $waba.name } else { "(no name returned)" }
    Write-Host "  - $displayName [$($waba.id)]" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/5] Subscribing NEW CITY STYLE app to each visible WABA..." -ForegroundColor Cyan

$successCount = 0

foreach ($waba in $allWabas) {
    $wabaId = [string]$waba.id
    $displayName = if ($waba.name) { $waba.name } else { "(no name returned)" }

    Write-Host ""
    Write-Host "WABA: $displayName [$wabaId]" -ForegroundColor Cyan

    try {
        $subscribe = Invoke-RestMethod `
            -Method Post `
            -Uri "$base/$wabaId/subscribed_apps" `
            -Headers $headers `
            -ContentType "application/x-www-form-urlencoded" `
            -Body ""

        Write-Host "SUBSCRIBE RESPONSE:" -ForegroundColor Green
        $subscribe | ConvertTo-Json -Depth 10
        $successCount++
    }
    catch {
        Write-Host "SUBSCRIBE FAILED FOR WABA $wabaId" -ForegroundColor Red
        Show-MetaError $_
    }
}

Write-Host ""
Write-Host "[5/5] Verifying subscriptions..." -ForegroundColor Cyan

foreach ($waba in $allWabas) {
    $wabaId = [string]$waba.id
    $displayName = if ($waba.name) { $waba.name } else { "(no name returned)" }

    Write-Host ""
    Write-Host "WABA: $displayName [$wabaId]" -ForegroundColor Cyan

    try {
        $apps = Invoke-MetaGet `
            -Url "$base/$wabaId/subscribed_apps" `
            -Headers $headers

        Write-Host "SUBSCRIBED APPS:" -ForegroundColor Green
        $apps | ConvertTo-Json -Depth 20
    }
    catch {
        Write-Host "READ-BACK FAILED FOR WABA $wabaId" -ForegroundColor Yellow
        Show-MetaError $_
    }
}

Write-Host ""
if ($successCount -gt 0) {
    Write-Host "DONE - At least one WABA subscription call succeeded." -ForegroundColor Green
    Write-Host "Next: send 'Hi' from another phone number to +91 90100 14001 and check the webhook/auto reply." -ForegroundColor Green
} else {
    Write-Host "NO WABA SUBSCRIPTION SUCCEEDED." -ForegroundColor Red
    Write-Host "The output above will show whether the remaining issue is asset assignment or app/WABA permission." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Existing production WHATSAPP_ACCESS_TOKEN was not changed." -ForegroundColor DarkGray
