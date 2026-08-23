# Build arm-setup.msi from build-sea.mjs's arm.exe (docs/guides/
# 03-client-downloader.md §7). Requires the WiX v4 toolset (`dotnet tool
# install --global wix`).
#
# Usage: pwsh packaging/windows/build-msi.ps1 -Version 1.0.0

param(
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $here)
$armExe = Join-Path $repoRoot "packaging/dist/arm.exe"
$outMsi = Join-Path $repoRoot "packaging/dist/arm-setup-$Version.msi"

if (-not (Test-Path $armExe)) {
    Write-Error "arm.exe not found at $armExe — run 'node packaging/build-sea.mjs' first (on Windows, or cross-build)."
    exit 1
}

Write-Host "[build-msi] building $outMsi"
wix build (Join-Path $here "arm.wxs") -d "ArmExePath=$armExe" -d "Version=$Version" -o $outMsi
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[build-msi] signing"
& (Join-Path $here "sign.ps1") -Path $outMsi

$hash = (Get-FileHash -Algorithm SHA256 $outMsi).Hash.ToLower()
Set-Content -Path "$outMsi.sha256" -Value "$hash  $(Split-Path -Leaf $outMsi)"
Write-Host "[build-msi] sha256: $hash"
