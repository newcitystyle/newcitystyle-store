# One-time secure signing setup for ONE permanent NEW CITY STYLE Android app.
# Does NOT touch any sales, products, dues, customer accounts or local databases.
$ErrorActionPreference = 'Stop'
$repo = 'newcitystyle/newcitystyle-store'
$dir = 'D:\NCS_BACKUP\ANDROID_UNIVERSAL_SIGNING'
$key = Join-Path $dir 'NEW_CITY_STYLE_UNIVERSAL_RELEASE.p12'
$passwordStore = Join-Path $dir 'signing_password_windows_dpapi.txt'
$alias = 'ncsuniversal'
# V304: Bootstrap missing developer tools. No financial data is touched.
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
  $ghGuess = Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe'
  if (Test-Path -LiteralPath $ghGuess) {
    $env:PATH = (Split-Path -Parent $ghGuess) + ';' + $env:PATH
  } else {
    if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
      throw 'GITHUB_CLI_INSTALLER_MISSING: Windows App Installer (winget) is required.'
    }
    Write-Host 'INSTALLING_GITHUB_CLI' -ForegroundColor Cyan
    & winget install --id GitHub.cli --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {throw 'GITHUB_CLI_INSTALL_FAILED'}
    if (Test-Path -LiteralPath $ghGuess) {
      $env:PATH = (Split-Path -Parent $ghGuess) + ';' + $env:PATH
    }
  }
}
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GITHUB_CLI_INSTALLED_BUT_PATH_NOT_READY: Open a new PowerShell window and retry.'
}
Write-Host 'CHECKING_GITHUB_LOGIN' -ForegroundColor Cyan
& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'GitHub account authorization is needed once. Follow the browser instructions.' -ForegroundColor Yellow
  & gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) {throw 'GITHUB_LOGIN_NOT_COMPLETED'}
}
$keytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolCmd) {
  $possible = @(
    (Join-Path $env:ProgramFiles 'Microsoft\jdk-17*\bin\keytool.exe'),
    (Join-Path $env:ProgramFiles 'Java\jdk-17*\bin\keytool.exe')
  )
  $found = @($possible | ForEach-Object { Get-Item -Path $_ -ErrorAction SilentlyContinue } | Select-Object -First 1)
  if ($found.Count -gt 0) {
    $env:PATH = (Split-Path -Parent $found[0].FullName) + ';' + $env:PATH
  } else {
    if (!(Get-Command winget -ErrorAction SilentlyContinue)) {throw 'JAVA_KEYTOOL_NOT_INSTALLED'}
    Write-Host 'INSTALLING_JAVA_JDK17' -ForegroundColor Cyan
    & winget install --id Microsoft.OpenJDK.17 --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {throw 'JAVA_JDK_INSTALL_FAILED'}
    $jdk = @(Get-Item -Path (Join-Path $env:ProgramFiles 'Microsoft\jdk-17*\bin\keytool.exe') -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($jdk.Count -gt 0) { $env:PATH = (Split-Path -Parent $jdk[0].FullName) + ';' + $env:PATH }
  }
}
if (!(Get-Command keytool -ErrorAction SilentlyContinue)) {
 throw 'JAVA_KEYTOOL_PATH_NOT_READY: Open a new PowerShell window and retry.'
}
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if ((Test-Path $key) -xor (Test-Path $passwordStore)) {
 throw 'SIGNING_BACKUP_INCOMPLETE: Key or password exists without the other; recovery required, cannot silently rotate.'
}
if(!(Test-Path $key)) {
 $bytes = New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 $pass=[Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').TrimEnd('=')
 & keytool -genkeypair -keystore $key -storetype PKCS12 -alias $alias -keyalg RSA -keysize 3072 -validity 12000 -storepass $pass -keypass $pass -dname 'CN=NEW CITY STYLE Universal, OU=Business Applications, O=NEW CITY STYLE, C=IN' -noprompt
 if($LASTEXITCODE -ne 0 -or !(Test-Path $key)){throw 'KEY_GENERATION_FAILED'}
 ConvertTo-SecureString $pass -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordStore -NoNewline
}
$secure=ConvertTo-SecureString (Get-Content -LiteralPath $passwordStore -Raw)
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$pass=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
& keytool -list -keystore $key -storepass $pass -alias $alias *> $null
if($LASTEXITCODE -ne 0){throw 'SIGNING_CERTIFICATE_VALIDATION_FAILED'}
$encoded=[Convert]::ToBase64String([IO.File]::ReadAllBytes($key))
$encoded | & gh secret set NCS_ANDROID_RELEASE_KEYSTORE_B64 --repo $repo
if($LASTEXITCODE -ne 0){throw 'KEYSTORE_SECRET_UPLOAD_FAILED'}
$pass | & gh secret set NCS_ANDROID_RELEASE_STORE_PASSWORD --repo $repo
if($LASTEXITCODE -ne 0){throw 'STORE_PASSWORD_SECRET_UPLOAD_FAILED'}
$alias | & gh secret set NCS_ANDROID_RELEASE_KEY_ALIAS --repo $repo
if($LASTEXITCODE -ne 0){throw 'KEY_ALIAS_SECRET_UPLOAD_FAILED'}
$pass | & gh secret set NCS_ANDROID_RELEASE_KEY_PASSWORD --repo $repo
if($LASTEXITCODE -ne 0){throw 'KEY_PASSWORD_SECRET_UPLOAD_FAILED'}
$pass=$null
$encoded=$null
Write-Host 'NCS_PERMANENT_RELEASE_SIGNING_CONFIGURED' -ForegroundColor Green
Write-Host "PRIVATE_KEY_LOCAL_BACKUP=$key"
Write-Host "DPAPI_PASSWORD_LOCAL_BACKUP=$passwordStore"
Write-Host 'Store an additional secure copy of both backups outside this computer.'
Write-Host 'Old preview apps use a different app ID; they can coexist. Once new permanent app installed, future builds update it without uninstall.'
& gh workflow run ncs-universal-pro-apk.yml --ref feature/ncs-universal-single-app-native-foundation --repo $repo
if ($LASTEXITCODE -eq 0) {
 Write-Host 'PERMANENT_APP_BUILD_REQUESTED' -ForegroundColor Green
} else {
 Write-Host 'Signing key is configured; workflow dispatch not available. A new code push will trigger build.' -ForegroundColor Yellow
}
