#Requires -Version 7.4
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Destination,
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.codex/android-signing/models-suite')
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([IO.Path]::GetFullPath($Destination).StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Backup must be outside the repository.' }
if (Test-Path -LiteralPath $Destination) { throw 'Refusing to overwrite a backup.' }
$passphrase = Read-Host 'Choose a strong backup passphrase (store it separately)' -AsSecureString
$password = [Net.NetworkCredential]::new('', $passphrase).Password
if ($password.Length -lt 16) { throw 'Use a passphrase of at least 16 characters.' }
$signingPassword = Get-Content (Join-Path $SigningDirectory 'password.dpapi') -Raw | ConvertTo-SecureString
$payload = @{
  applicationId = 'com.modelssuite.app'; alias = 'models-suite-release'
  password = [Net.NetworkCredential]::new('', $signingPassword).Password
  pkcs12 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $SigningDirectory 'models-suite-release.p12')))
} | ConvertTo-Json -Compress
$salt = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$nonce = [Security.Cryptography.RandomNumberGenerator]::GetBytes(12)
$key = [Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2($password, $salt, 600000, [Security.Cryptography.HashAlgorithmName]::SHA256, 32)
$plain = [Text.Encoding]::UTF8.GetBytes($payload)
$cipher = [byte[]]::new($plain.Length)
$tag = [byte[]]::new(16)
$aes = [Security.Cryptography.AesGcm]::new($key,16)
try {
  $aes.Encrypt($nonce,$plain,$cipher,$tag)
  @{ format='models-suite-signing-v1'; kdf='PBKDF2-SHA256'; iterations=600000; salt=[Convert]::ToBase64String($salt); nonce=[Convert]::ToBase64String($nonce); tag=[Convert]::ToBase64String($tag); ciphertext=[Convert]::ToBase64String($cipher) } | ConvertTo-Json | Set-Content -LiteralPath $Destination -NoNewline
  Write-Output 'Encrypted portable signing backup saved. Keep it and its passphrase in separate secure locations.'
} finally { $aes.Dispose(); [Security.Cryptography.CryptographicOperations]::ZeroMemory($key); [Security.Cryptography.CryptographicOperations]::ZeroMemory($plain); $password=$null; $payload=$null }
