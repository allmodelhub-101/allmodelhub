#Requires -Version 7.4
[CmdletBinding()]
param([string]$SigningDirectory = (Join-Path $env:USERPROFILE '.codex/android-signing/models-suite'))
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This initializer uses Windows DPAPI. Other hosts must supply the documented signing environment variables.' }
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$signingRoot = [IO.Path]::GetFullPath($SigningDirectory)
if ($signingRoot.StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Signing material must be outside the repository.' }
New-Item -ItemType Directory -Force -Path $signingRoot | Out-Null
# Private key/password are readable only by the current Windows user and SYSTEM.
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl.SetOwner($sid)
foreach ($identity in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $signingRoot -AclObject $acl
$keyFile = Join-Path $signingRoot 'models-suite-release.p12'
$passwordFile = Join-Path $signingRoot 'password.dpapi'
if ((Test-Path -LiteralPath $keyFile) -or (Test-Path -LiteralPath $passwordFile)) { throw 'Signing identity already exists; refusing to overwrite it.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 17 before initialization.' }
$env:MODELS_ANDROID_STORE_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
try {
  $secure = ConvertTo-SecureString $env:MODELS_ANDROID_STORE_PASSWORD -AsPlainText -Force
  ConvertFrom-SecureString $secure | Set-Content -LiteralPath $passwordFile -NoNewline
  & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $keyFile -storetype PKCS12 -alias 'models-suite-release' -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Models Suite, O=Models Suite' -storepass:env MODELS_ANDROID_STORE_PASSWORD -keypass:env MODELS_ANDROID_STORE_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Key generation failed. Inspect the private signing directory before retrying.' }
  & "$env:JAVA_HOME/bin/keytool.exe" -exportcert -rfc -keystore $keyFile -alias 'models-suite-release' -storepass:env MODELS_ANDROID_STORE_PASSWORD -file (Join-Path $signingRoot 'release-certificate.pem')
  if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
  Write-Output "Signing identity created outside Git: $signingRoot"
  Write-Output 'Back up this identity using Export-SigningBackup.ps1 before distributing the app. DPAPI alone is not a portable backup.'
} finally { Remove-Item Env:MODELS_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue }
