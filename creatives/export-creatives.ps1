# Export every creative HTML in this folder to a 1080x1080 PNG (LinkedIn-ready)
# Usage:  powershell -File export-creatives.ps1
# Output: .\png\<name>.png

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $here "png"
New-Item -ItemType Directory -Force $outDir | Out-Null

# Locate Edge (present on every Windows 11 machine)
$edgePaths = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found. Install Edge or Chrome and adjust the path." }

Get-ChildItem $here -Filter *.html | ForEach-Object {
  $png = Join-Path $outDir ($_.BaseName + ".png")
  $url = "file:///" + ($_.FullName -replace "\\", "/")
  $args = @("--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=1080,1080", "--screenshot=$png", $url)
  Start-Process -FilePath $edge -ArgumentList $args -Wait -WindowStyle Hidden
  if (Test-Path $png) {
    Write-Host "exported $($_.Name) -> png\$($_.BaseName).png"
  } else {
    Write-Warning "FAILED: $($_.Name)"
  }
}
