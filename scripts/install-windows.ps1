param(
  [string]$InstallDir = "$env:ProgramData\Pet Grooming Software",
  [int]$Port = 3017,
  [switch]$CreateStartupTask
)

$ErrorActionPreference = "Stop"

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TargetRoot = [System.IO.Path]::GetFullPath($InstallDir)
$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
  throw "Node.js non trovato. Installa Node.js 18 o superiore prima di continuare."
}

function Copy-AppItem {
  param([string]$RelativePath)
  $source = Join-Path $SourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    return
  }
  $target = Join-Path $TargetRoot $RelativePath
  $targetParent = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
  Copy-Item -LiteralPath $source -Destination $targetParent -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if (-not [string]::Equals($SourceRoot, $TargetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
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
    Copy-AppItem -RelativePath $item
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $TargetRoot "data\uploads") | Out-Null

$StartScript = Join-Path $TargetRoot "start-pet-grooming.ps1"
@"
`$env:PORT = "$Port"
Set-Location -LiteralPath "$TargetRoot"
node server.js
"@ | Set-Content -LiteralPath $StartScript -Encoding UTF8

if ($CreateStartupTask) {
  $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$StartScript`""
  $Trigger = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName "Pet Grooming Software" -Action $Action -Trigger $Trigger -Description "Avvio automatico Pet Grooming Software" -Force | Out-Null
  Write-Host "Attivita di avvio creata: Pet Grooming Software"
}

Write-Host "Installazione completata in $TargetRoot"
Write-Host "Avvio manuale: powershell -ExecutionPolicy Bypass -File `"$StartScript`""
Write-Host "Indirizzo locale: http://localhost:$Port"
