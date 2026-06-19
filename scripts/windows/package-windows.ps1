param(
  [switch]$DirOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

function Invoke-Checked {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Host ("==> {0}" -f $Label) -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label fallo."
  }
}

& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\prepare-local.ps1" -SkipInfra
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Push-Location $RepoRoot
try {
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  Invoke-Checked 'Compilando API y desktop' { & npm run build }
  Invoke-Checked 'Preparando runtime embebido' { & npm run release:runtime }

  if ($DirOnly) {
    Invoke-Checked 'Generando paquete de directorio Electron' {
      & npm run pack -w '@vetcare/desktop'
    }
  } else {
    Invoke-Checked 'Generando instalador Windows NSIS' {
      & npm run dist:win -w '@vetcare/desktop'
    }
  }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Artefactos generados en apps\desktop\dist.' -ForegroundColor Green
