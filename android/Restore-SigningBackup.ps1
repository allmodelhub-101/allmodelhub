#Requires -Version 7.4
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Backup,
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.codex/android-signing/models-suite'))
$ErrorActionPreference='Stop'
if (-not $IsWindows) { throw 'This restore helper uses Windows DPAPI for the restored password.' }
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target=[IO.Path]::GetFullPath($SigningDirectory)
if ($target.StartsWith($repoRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Restore outside the repository.' }
if ((Test-Path "$target/models-suite-release.p12") -or (Test-Path "$target/password.dpapi")) { throw 'Refusing to overwrite an existing signing identity.' }
$envelope=Get-Content -LiteralPath $Backup -Raw | ConvertFrom-Json
if ($envelope.format -ne 'models-suite-signing-v1' -or $envelope.iterations -ne 600000) { throw 'Unsupported backup format.' }
$phrase=Read-Host 'Backup passphrase' -AsSecureString
$password=[Net.NetworkCredential]::new('',$phrase).Password
$key=[Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2($password,[Convert]::FromBase64String($envelope.salt),600000,[Security.Cryptography.HashAlgorithmName]::SHA256,32)
$cipher=[Convert]::FromBase64String($envelope.ciphertext)
$plain=[byte[]]::new($cipher.Length)
$aes=[Security.Cryptography.AesGcm]::new($key,16)
try {
  $aes.Decrypt([Convert]::FromBase64String($envelope.nonce),$cipher,[Convert]::FromBase64String($envelope.tag),$plain)
  $payload=[Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
  if ($payload.applicationId -ne 'com.modelssuite.app' -or $payload.alias -ne 'models-suite-release') { throw 'Unexpected signing identity.' }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  $acl=[Security.AccessControl.DirectorySecurity]::new(); $acl.SetAccessRuleProtection($true,$false)
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl.SetOwner($sid)
  foreach ($identity in @($sid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')) }
  Set-Acl -LiteralPath $target -AclObject $acl
  [IO.File]::WriteAllBytes("$target/models-suite-release.p12",[Convert]::FromBase64String($payload.pkcs12))
  ConvertTo-SecureString $payload.password -AsPlainText -Force | ConvertFrom-SecureString | Set-Content "$target/password.dpapi" -NoNewline
  Write-Output 'Signing identity restored under the current Windows account. Verify its public certificate fingerprint before building.'
} finally { $aes.Dispose(); [Security.Cryptography.CryptographicOperations]::ZeroMemory($key); [Security.Cryptography.CryptographicOperations]::ZeroMemory($plain); $password=$null; $payload=$null }
