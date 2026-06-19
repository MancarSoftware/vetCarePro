Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$RuntimeRoot = Join-Path $RepoRoot 'release\runtime'
$ApiRuntime = Join-Path $RuntimeRoot 'api'
$NodeRuntime = Join-Path $RuntimeRoot 'node'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

function Copy-Directory {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    throw "No existe la ruta requerida: $Source"
  }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
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

Write-Host 'Preparando runtime 1.0.0 para instalador Windows...' -ForegroundColor Cyan

if (Test-Path $RuntimeRoot) {
  Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $RuntimeRoot, $ApiRuntime, $NodeRuntime -Force | Out-Null

Copy-Item -Path $NodeExe -Destination (Join-Path $NodeRuntime 'node.exe') -Force
Copy-Directory (Join-Path $RepoRoot 'apps\api\dist') (Join-Path $ApiRuntime 'dist')
Copy-Directory (Join-Path $RepoRoot 'apps\api\prisma') (Join-Path $ApiRuntime 'prisma')
Copy-Directory (Join-Path $RepoRoot 'scripts\runtime') (Join-Path $ApiRuntime 'scripts')

Copy-Item -Path (Join-Path $RepoRoot 'docker-compose.yml') -Destination (Join-Path $RuntimeRoot 'docker-compose.yml') -Force
Copy-Item -Path (Join-Path $RepoRoot '.env.example') -Destination (Join-Path $RuntimeRoot '.env.example') -Force
Copy-Item -Path (Join-Path $RepoRoot 'README.md') -Destination (Join-Path $RuntimeRoot 'README.md') -Force

$apiPackage = @{
  name = '@vetcare/api-runtime'
  version = '1.0.0'
  private = $true
  main = 'dist/main.js'
  dependencies = @{
    '@nestjs/common' = '^11.1.26'
    '@nestjs/config' = '^4.0.2'
    '@nestjs/core' = '^11.1.26'
    '@nestjs/jwt' = '^11.0.2'
    '@nestjs/platform-express' = '^11.1.26'
    '@prisma/adapter-pg' = '^7.8.0'
    '@prisma/client' = '^7.8.0'
    bcrypt = '^6.0.0'
    'class-transformer' = '^0.5.1'
    'class-validator' = '^0.14.3'
    helmet = '^8.1.0'
    pg = '^8.16.3'
    'reflect-metadata' = '^0.2.2'
    rxjs = '^7.8.2'
  }
}

$apiPackage |
  ConvertTo-Json -Depth 8 |
  Set-Content -Path (Join-Path $ApiRuntime 'package.json') -Encoding UTF8

Push-Location $ApiRuntime
try {
  Invoke-Checked 'Instalando dependencias runtime de API' {
    & npm install --omit=dev --no-audit --no-fund --package-lock=false
  }
} finally {
  Pop-Location
}

Write-Host 'Runtime de release listo en release\runtime.' -ForegroundColor Green
