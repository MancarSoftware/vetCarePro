param(
  [switch]$SkipInfra
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envPath = Join-Path $RepoRoot '.env'
$examplePath = Join-Path $RepoRoot '.env.example'
$dataRoot = 'C:\VetCarePro'

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  [string[]]$content = @()
  if (Test-Path $Path) {
    $content = Get-Content -Path $Path
  }

  $line = "$Key=$Value"
  $found = $false
  $updated = foreach ($item in $content) {
    if ($item -match "^\s*$([regex]::Escape($Key))=") {
      $found = $true
      $line
    } else {
      $item
    }
  }

  if (-not $found) {
    $updated += $line
  }

  Set-Content -Path $Path -Value $updated -Encoding UTF8
}

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

Write-Host 'Preparando VetCare Pro para Windows local...' -ForegroundColor Cyan

foreach ($path in @($dataRoot, "$dataRoot\uploads", "$dataRoot\backups", "$dataRoot\logs", "$dataRoot\temp")) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

if (-not (Test-Path $envPath)) {
  if (-not (Test-Path $examplePath)) {
    throw 'No existe .env.example para crear .env.'
  }
  Copy-Item -Path $examplePath -Destination $envPath
}

Set-EnvValue $envPath 'DATABASE_URL' 'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public'
Set-EnvValue $envPath 'API_HOST' '127.0.0.1'
Set-EnvValue $envPath 'API_PORT' '4782'
Set-EnvValue $envPath 'VITE_API_URL' 'http://127.0.0.1:4782/api'
Set-EnvValue $envPath 'VETCARE_DATA_DIR' 'C:/VetCarePro'
Set-EnvValue $envPath 'UPLOADS_PATH' 'C:/VetCarePro/uploads'
Set-EnvValue $envPath 'BACKUPS_PATH' 'C:/VetCarePro/backups'
Set-EnvValue $envPath 'POSTGRES_CONTAINER' 'vetcare-pro-postgres'

Write-Host 'Carpetas locales listas:' -ForegroundColor Green
Write-Host '  C:\VetCarePro\uploads'
Write-Host '  C:\VetCarePro\backups'
Write-Host '  C:\VetCarePro\logs'

Push-Location $RepoRoot
try {
  if ($SkipInfra) {
    Write-Host 'Infraestructura omitida por parametro -SkipInfra.' -ForegroundColor Yellow
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\doctor.ps1"
    if ($LASTEXITCODE -ne 0) {
      throw 'El diagnostico local encontro problemas.'
    }

    Invoke-Checked 'Levantando PostgreSQL local' { & npm run infra:up }
    Invoke-Checked 'Generando cliente Prisma' { & npm run db:generate }
    Invoke-Checked 'Aplicando migraciones Prisma' { & npm run db:deploy }
  }
} finally {
  Pop-Location
}

Write-Host 'Preparacion local completada.' -ForegroundColor Green
