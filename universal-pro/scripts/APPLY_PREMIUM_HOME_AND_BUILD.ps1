$ErrorActionPreference = 'Stop'
$project = 'D:\NCS_UNIVERSAL_PRO\PROJECT'
$target = Join-Path $project 'app\src\main\java\store\newcitystyle\universalpro\CompactBusinessHome.kt'
$backupDir = 'D:\NCS_UNIVERSAL_PRO\BACKUPS'
$desktop = [Environment]::GetFolderPath('Desktop')
$downloads = Join-Path $env:USERPROFILE 'Downloads'
$builder = Join-Path $downloads 'NCS_BUILD_APK_TO_DESKTOP_V2.ps1'
$commit = 'ea82bbc7ca648f42f74b73620cad7bba24e6d43b'
$url = "https://raw.githubusercontent.com/newcitystyle/newcitystyle-store/$commit/universal-pro/app/src/main/java/store/newcitystyle/universalpro/CompactBusinessHome.kt"
try {
    Write-Host 'NEW CITY STYLE PREMIUM HOME — LOCAL SAFE UPDATE' -ForegroundColor Cyan
    if (!(Test-Path -LiteralPath $target)) { throw "Android source not found: $target" }
    if (!(Test-Path -LiteralPath $builder)) { throw "Build script missing from Downloads: $builder" }
    $old = [IO.File]::ReadAllText($target)
    if (!$old.Contains('internal fun CompactBusinessHome(onNavigate:(String)->Unit)')) {
        throw 'Unexpected local Home screen signature. No replacement performed.'
    }
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $backupDir "CompactBusinessHome_BEFORE_PREMIUM_$stamp.kt"
    Copy-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
    Write-Host "SOURCE_BACKUP=$backup" -ForegroundColor Green
    $temp = Join-Path $env:TEMP "NCS_PREMIUM_HOME_$stamp.kt"
    Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing -TimeoutSec 120
    $new = [IO.File]::ReadAllText($temp)
    if (!$new.Contains('internal fun CompactBusinessHome(onNavigate:(String)->Unit)') -or
        !$new.Contains('PremiumKpi') -or !$new.Contains('NcsCloud.dashboard')) {
        throw 'Downloaded source validation failed; existing source untouched.'
    }
    Copy-Item -LiteralPath $temp -Destination $target -Force
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    Write-Host 'HOME_UI_PATCH_APPLIED; local business database untouched.' -ForegroundColor Green
    Write-Host 'Starting existing APK build script...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $builder
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build script exit code $LASTEXITCODE. See Desktop build log. Source backup: $backup" -ForegroundColor Yellow
        exit $LASTEXITCODE
    }
    $apk = Get-ChildItem -LiteralPath $desktop -Filter 'NEW_CITY_STYLE_UNIVERSAL_PRO_DEBUG_*.apk' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -ne $apk) { Write-Host "DESKTOP_APK=$($apk.FullName)" -ForegroundColor Green }
    Write-Host "SOURCE_BACKUP=$backup"
    Write-Host 'Premium Home code installed. Only trust APK if builder reports BUILD SUCCESSFUL.' -ForegroundColor Green
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
