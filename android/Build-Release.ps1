#Requires -Version 7.4
[CmdletBinding()]
param(
  [string]$SigningDirectory = (Join-Path $env:USERPROFILE '.codex/android-signing/models-suite'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'artifacts')
)
$ErrorActionPreference = 'Stop'
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'JAVA_HOME (JDK 17) and ANDROID_HOME (SDK with API 36/build-tools 36.0.0) are required.' }
$release = Get-Content (Join-Path $PSScriptRoot 'release.json') -Raw | ConvertFrom-Json
$loaded = $false
try {
  if (-not $env:MODELS_ANDROID_KEYSTORE) {
    if (-not $IsWindows) { throw 'Supply external signing environment variables on non-Windows hosts.' }
    $secure = Get-Content (Join-Path $SigningDirectory 'password.dpapi') -Raw | ConvertTo-SecureString
    $env:MODELS_ANDROID_STORE_PASSWORD = [Net.NetworkCredential]::new('', $secure).Password
    $env:MODELS_ANDROID_KEY_PASSWORD = $env:MODELS_ANDROID_STORE_PASSWORD
    $env:MODELS_ANDROID_KEYSTORE = Join-Path $SigningDirectory 'models-suite-release.p12'
    $env:MODELS_ANDROID_KEY_ALIAS = 'models-suite-release'
    $loaded = $true
  }
  $repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  if ([IO.Path]::GetFullPath($env:MODELS_ANDROID_KEYSTORE).StartsWith($repoRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private signing key must be outside Git checkout.' }
  Push-Location $PSScriptRoot
  try {
    & ./gradlew.bat --no-daemon --console=plain assembleRelease bundleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
  } finally { Pop-Location }
  $versionOutput = Join-Path $OutputDirectory $release.versionName
  New-Item -ItemType Directory -Force -Path $versionOutput | Out-Null
  $apk = Join-Path $versionOutput "models-suite-$($release.versionName).apk"
  $aab = Join-Path $versionOutput "models-suite-$($release.versionName).aab"
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'app/build/outputs/apk/release/app-release.apk') -Destination $apk
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'app/build/outputs/bundle/release/app-release.aab') -Destination $aab
  & (Join-Path $PSScriptRoot 'Normalize-Bundle.ps1') -BundlePath $aab
  & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs $apk
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
  & "$env:JAVA_HOME/bin/jarsigner.exe" -verify $aab
  if ($LASTEXITCODE -ne 0) { throw 'AAB signature verification failed.' }
  $records = @($apk,$aab) | ForEach-Object { @{ file = [IO.Path]::GetFileName($_); sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLower(); bytes = (Get-Item -LiteralPath $_).Length } }
  @{ version = $release.versionName; versionCode = $release.versionCode; applicationId = $release.applicationId; artifacts = $records } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $versionOutput 'release-artifacts.json')
  Write-Output "Signed release artifacts: $versionOutput"
} finally {
  if ($loaded) { 'MODELS_ANDROID_STORE_PASSWORD','MODELS_ANDROID_KEY_PASSWORD','MODELS_ANDROID_KEYSTORE','MODELS_ANDROID_KEY_ALIAS' | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue } }
}
