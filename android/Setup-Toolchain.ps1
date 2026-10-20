#Requires -Version 7.4
[CmdletBinding()]
param([string]$ToolchainDirectory = (Join-Path $env:USERPROFILE '.codex/android-toolchain'))
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $ToolchainDirectory | Out-Null
function Get-VerifiedArchive([string]$Url,[string]$Checksum,[string]$Name) {
  $archive = Join-Path $ToolchainDirectory $Name
  if (-not (Test-Path $archive)) { Invoke-WebRequest -Uri $Url -OutFile $archive }
  if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLower() -ne $Checksum) { throw "Checksum mismatch: $Name" }
  return $archive
}
$jdkZip=Get-VerifiedArchive 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip' 'e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0' 'jdk.zip'
$sdkZip=Get-VerifiedArchive 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a' 'commandlinetools.zip'
if (-not (Test-Path "$ToolchainDirectory/jdk")) { Expand-Archive -LiteralPath $jdkZip -DestinationPath "$ToolchainDirectory/jdk" }
if (-not (Test-Path "$ToolchainDirectory/command-tools")) { Expand-Archive -LiteralPath $sdkZip -DestinationPath "$ToolchainDirectory/command-tools" }
$env:JAVA_HOME=(Get-ChildItem "$ToolchainDirectory/jdk" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME=Join-Path $ToolchainDirectory 'sdk'
New-Item -ItemType Directory -Force -Path $env:ANDROID_HOME | Out-Null
$manager=Join-Path $ToolchainDirectory 'command-tools/cmdline-tools/bin/sdkmanager.bat'
& $manager "--sdk_root=$env:ANDROID_HOME" --licenses
if ($LASTEXITCODE -ne 0) { throw 'Android SDK licenses are required.' }
& $manager "--sdk_root=$env:ANDROID_HOME" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw 'SDK installation failed.' }
Write-Output 'Toolchain ready in this PowerShell process. JAVA_HOME and ANDROID_HOME are set; no machine settings changed.'
