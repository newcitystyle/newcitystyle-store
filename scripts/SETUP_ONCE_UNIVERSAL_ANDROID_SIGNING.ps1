# One-time Android signing identity setup for all future NEW CITY STYLE updates.
# Operates on signing key only; no business databases are read or modified.
$ErrorActionPreference = "Stop"
$repo = "newcitystyle/newcitystyle-store"
$backup = "D:\NCS_BACKUP\ANDROID_UNIVERSAL_SIGNING"
$key = Join-Path $backup "ncs-universal-debug.keystore"
if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw "GITHUB_CLI_MISSING: Install GitHub CLI and sign in with gh auth login" }
& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { throw "GITHUB_NOT_LOGGED_IN: Run gh auth login first." }
if (!(Get-Command keytool -ErrorAction SilentlyContinue)) { throw "JAVA_KEYTOOL_MISSING: Install Java JDK 17." }
New-Item -Path $backup -ItemType Directory -Force | Out-Null
if (!(Test-Path -LiteralPath $key)) {
  & keytool -genkeypair -v -keystore $key -alias androiddebugkey -keyalg RSA -keysize 3072 -validity 10000 -storepass android -keypass android -dname "CN=NEW CITY STYLE Universal, OU=Android, O=NEW CITY STYLE, C=IN" -noprompt
  if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $key)) { throw "KEY_GENERATION_FAILED" }
}
$bytes = [IO.File]::ReadAllBytes($key)
if ($bytes.Length -lt 2000) { throw "KEYSTORE_INVALID" }
$encoded = [Convert]::ToBase64String($bytes)
$encoded | & gh secret set NCS_ANDROID_DEBUG_KEYSTORE_B64 --repo $repo
if ($LASTEXITCODE -ne 0) { throw "GITHUB_SECRET_UPLOAD_FAILED" }
& keytool -list -v -keystore $key -storepass android -alias androiddebugkey | Select-String -Pattern '^SHA256:|^Alias name:'
Write-Host "PERMANENT_NCS_SIGNING_SECRET_CONFIGURED" -ForegroundColor Green
Write-Host "LOCAL_KEYSTORE_BACKUP=$key" -ForegroundColor Green
Write-Host "CRITICAL: Keep the signing keystore in an encrypted second backup."
Write-Host "Existing APKs with another signing certificate cannot update in-place. One initial migration may be required."
