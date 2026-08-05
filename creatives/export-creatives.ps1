# Export every creative HTML in this folder to 1080x1080 PNGs.
# Usage:  powershell -ExecutionPolicy Bypass -File export-creatives.ps1
#
# Two renditions per creative:
#   .\png\<name>.png       watermarked  - for downloads, shares, LinkedIn, OG previews
#   .\png\web\<name>.png   clean, 720px - for inline display on the website only
#
# The watermark lives in creative.css (.cr-frame::after); the clean pass
# disables it via an injected style override in a temp copy of the page.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $here "png"
$webDir = Join-Path $outDir "web"
New-Item -ItemType Directory -Force $outDir | Out-Null
New-Item -ItemType Directory -Force $webDir | Out-Null

# Locate Edge (present on every Windows 11 machine)
$edgePaths = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found. Install Edge or Chrome and adjust the path." }

function Shoot($htmlPath, $pngPath) {
  $url = "file:///" + ($htmlPath -replace "\\", "/")
  $args = @("--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=1080,1080", "--screenshot=$pngPath", $url)
  Start-Process -FilePath $edge -ArgumentList $args -Wait -WindowStyle Hidden
}

Get-ChildItem $here -Filter *.html | ForEach-Object {
  # 1) watermarked master
  $png = Join-Path $outDir ($_.BaseName + ".png")
  Shoot $_.FullName $png

  # 2) clean web rendition (watermark suppressed via style override)
  $tmp = Join-Path $here ("_clean_" + $_.Name)
  (Get-Content $_.FullName -Raw -Encoding UTF8) -replace "</head>",
    "<style>.cr-frame::after{display:none !important}</style></head>" |
    Set-Content $tmp -Encoding UTF8
  $webPng = Join-Path $webDir ($_.BaseName + ".png")
  Shoot $tmp $webPng
  Remove-Item $tmp -Force

  if ((Test-Path $png) -and (Test-Path $webPng)) {
    Write-Host "exported $($_.Name) -> png\ (wm) + png\web\ (clean)"
  } else {
    Write-Warning "FAILED: $($_.Name)"
  }
}

# Downscale web renditions to 720px - crisp for on-page display, lighter to load
python -c @"
from PIL import Image
import glob, os
for f in glob.glob(r'$webDir\*.png'):
    im = Image.open(f)
    if im.size[0] > 720:
        im.resize((720, 720), Image.LANCZOS).save(f, optimize=True)
print('web renditions downscaled to 720px')
"@
