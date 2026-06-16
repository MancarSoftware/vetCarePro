Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\prepare-local.ps1"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Push-Location $RepoRoot
try {
  Write-Host 'Iniciando API local y aplicacion Electron...' -ForegroundColor Cyan
  & npm run dev:services
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
