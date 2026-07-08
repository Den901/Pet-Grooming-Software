param(
  [string]$Version = "",
  [switch]$SkipUpdate
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PackageJson = Get-Content -LiteralPath (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = $PackageJson.version
}

$PackageBase = "Pet-Grooming-Software-$Version"
$Dist = Join-Path $Root "dist"
$StageRoot = Join-Path $Dist "_stage"
$Stage = Join-Path $StageRoot $PackageBase

function Assert-UnderPath {
  param(
    [string]$PathToCheck,
    [string]$ParentPath
  )
  $parentFull = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\')
  $pathFull = [System.IO.Path]::GetFullPath($PathToCheck).TrimEnd('\')
  if (-not $pathFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Percorso fuori dalla cartella attesa: $pathFull"
  }
}

function Copy-ReleaseItem {
  param([string]$RelativePath)
  $source = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    return
  }
  $target = Join-Path $Stage $RelativePath
  $targetParent = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
  Copy-Item -LiteralPath $source -Destination $targetParent -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Dist, $StageRoot | Out-Null
if (Test-Path -LiteralPath $Stage) {
  Assert-UnderPath -PathToCheck $Stage -ParentPath $StageRoot
  Remove-Item -LiteralPath $Stage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$items = @(
  "server.js",
  "package.json",
  "README.md",
  ".gitignore",
  "start-windows.bat",
  "start-linux.sh",
  "public",
  "scripts",
  "docs"
)

foreach ($item in $items) {
  Copy-ReleaseItem -RelativePath $item
}

New-Item -ItemType Directory -Force -Path (Join-Path $Stage "data\uploads") | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $Stage "data\uploads\.gitkeep") | Out-Null

$windowsZip = Join-Path $Dist "$PackageBase-windows.zip"
if (Test-Path -LiteralPath $windowsZip) {
  Assert-UnderPath -PathToCheck $windowsZip -ParentPath $Dist
  Remove-Item -LiteralPath $windowsZip -Force
}
Compress-Archive -LiteralPath $Stage -DestinationPath $windowsZip -Force

$linuxTar = Join-Path $Dist "$PackageBase-linux.tar.gz"
if (Test-Path -LiteralPath $linuxTar) {
  Assert-UnderPath -PathToCheck $linuxTar -ParentPath $Dist
  Remove-Item -LiteralPath $linuxTar -Force
}
tar -czf $linuxTar -C $StageRoot $PackageBase

if (-not $SkipUpdate) {
  $updateFile = Join-Path $Dist "$PackageBase.pgs-update"
  $manifestFile = Join-Path $Dist "pet-grooming-update.json"
  node (Join-Path $Root "scripts\create-update-package.mjs") --version $Version --out $updateFile
  node (Join-Path $Root "scripts\create-update-manifest.mjs") --version $Version --out $manifestFile
}

Write-Host "Creati pacchetti release in $Dist"
Write-Host "- $windowsZip"
Write-Host "- $linuxTar"
if (-not $SkipUpdate) {
  Write-Host "- $(Join-Path $Dist "$PackageBase.pgs-update")"
  Write-Host "- $(Join-Path $Dist "pet-grooming-update.json")"
}
