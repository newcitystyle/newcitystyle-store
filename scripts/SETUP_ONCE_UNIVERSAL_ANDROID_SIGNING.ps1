# One-time secure signing setup for ONE permanent NEW CITY STYLE Android app.
# Does NOT touch any sales, products, dues, customer accounts or local databases.
$ErrorActionPreference = 'Stop'
$repo = 'newcitystyle/newcitystyle-store'
$dir = 'D:\NCS_BACKUP\ANDROID_UNIVERSAL_SIGNING'
$key = Join-Path $dir 'NEW_CITY_STYLE_UNIVERSAL_RELEASE.p12'
$passwordStore = Join-Path $dir 'signing_password_windows_dpapi.txt'
$alias = 'ncsuniversal'
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
 throw 'GITHUB_CLI_REQUIRED: Install GitHub CLI via winget install GitHub.cli, then run gh auth login.'
}
& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { throw 'GITHUB_LOGIN_REQUIRED: Run gh auth login.' }
if (!(Get-Command keytool -ErrorAction SilentlyContinue)) {
 throw 'JAVA_JDK_REQUIRED: Install JDK17 and ensure keytool is on PATH.'
}
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if ((Test-Path $key) -xor (Test-Path $passwordStore)) {
 throw 'SIGNING_BACKUP_INCOMPLETE: Key or password exists without the other; recovery required, cannot silently rotate.'
}
if(!(Test-Path $key)) {
 $bytes = New-Object byte[] 32
 [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
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
