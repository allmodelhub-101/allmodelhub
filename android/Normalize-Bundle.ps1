#Requires -Version 7.4
[CmdletBinding()]
param([Parameter(Mandatory)][string]$BundlePath)
$ErrorActionPreference='Stop'
$bundle=[IO.Path]::GetFullPath($BundlePath)
if ([IO.Path]::GetExtension($bundle) -ne '.aab') { throw 'Only JAR-signed AAB entry ordering may be normalized. Never repack a signed APK.' }
$temporary=$bundle + '.normalize'
if (Test-Path -LiteralPath $temporary) { throw 'Temporary bundle already exists.' }
$source=[IO.Compression.ZipFile]::OpenRead($bundle)
$target=$null
try {
  if (-not $source.GetEntry('META-INF/MANIFEST.MF')) { throw 'Missing signed JAR manifest.' }
  $target=[IO.Compression.ZipFile]::Open($temporary,[IO.Compression.ZipArchiveMode]::Create)
  # AGP places signing metadata last. JAR stream readers need manifest/signature
  # metadata first. Entry content and signatures are preserved byte-for-byte.
  $entries=$source.Entries | Sort-Object @{Expression={if($_.FullName -eq 'META-INF/MANIFEST.MF'){0}elseif($_.FullName -match '^META-INF/[^/]+\.(SF|RSA|DSA|EC)$'){1}else{2}}},FullName
  foreach ($entry in $entries) {
    $copy=$target.CreateEntry($entry.FullName,[IO.Compression.CompressionLevel]::Optimal)
    $copy.LastWriteTime=$entry.LastWriteTime
    $copy.ExternalAttributes=$entry.ExternalAttributes
    $reader=$entry.Open(); $writer=$copy.Open()
    try { $reader.CopyTo($writer) } finally { $reader.Dispose(); $writer.Dispose() }
  }
} finally { $source.Dispose(); if($target){$target.Dispose()} }
Move-Item -LiteralPath $temporary -Destination $bundle -Force
