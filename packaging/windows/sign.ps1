# EV code-signing for arm.exe / the WiX MSI (docs/guides/03-client-downloader.md §7).
#
# Unsigned binaries get blocked by SmartScreen and destroy the "very easy"
# adoption promise (A7) — signing is required from the first beta. This
# script signs with an EV cert referenced by thumbprint in a certificate
# store (CI runners use an HSM-backed cert, never a file on disk).
#
# CREDENTIAL GATE: when ARM_WINDOWS_CERT_THUMBPRINT is unset, this script
# does NOT sign — it reports the gate and exits 0, leaving the artifact
# tagged unsigned-dev by build-sea.mjs. Never fabricate a signature.

param(
    [Parameter(Mandatory = $true)][string]$Path
)

$thumbprint = $env:ARM_WINDOWS_CERT_THUMBPRINT
$timestampUrl = "http://timestamp.digicert.com"

if (-not $thumbprint) {
    Write-Host "[sign.ps1] CREDENTIAL GATE: ARM_WINDOWS_CERT_THUMBPRINT is not set — leaving '$Path' UNSIGNED (tag: unsigned-dev)."
    exit 0
}

Write-Host "[sign.ps1] signing '$Path' with certificate thumbprint $thumbprint"
& signtool.exe sign /sha1 $thumbprint /fd SHA256 /tr $timestampUrl /td SHA256 /d "ARM Agent Client" $Path
if ($LASTEXITCODE -ne 0) {
    Write-Error "[sign.ps1] signtool failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "[sign.ps1] verifying signature"
& signtool.exe verify /pa $Path
exit $LASTEXITCODE
