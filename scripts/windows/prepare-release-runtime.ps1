Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$RuntimeRoot = Join-Path $RepoRoot 'release\runtime'
$ApiRuntime = Join-Path $RuntimeRoot 'api'
$NodeRuntime = Join-Path $RuntimeRoot 'node'
$PostgresRuntime = Join-Path $RuntimeRoot 'postgres\pgsql'
$NodeExe = (Get-Command node -ErrorAction Stop).Source

$PostgresVersion = '16.14-1'
$PostgresArchiveName = "postgresql-$PostgresVersion-windows-x64-binaries.zip"
$PostgresDownloadUrl = $env:VETCARE_POSTGRES_DOWNLOAD_URL
if ([string]::IsNullOrWhiteSpace($PostgresDownloadUrl)) {
  $PostgresDownloadUrl = "https://get.enterprisedb.com/postgresql/$PostgresArchiveName"
}

$PostgresCacheRoot = $env:VETCARE_POSTGRES_CACHE
if ([string]::IsNullOrWhiteSpace($PostgresCacheRoot)) {
  $PostgresCacheRoot = Join-Path $env:TEMP 'vcpg'
}
$PostgresArchive = Join-Path $PostgresCacheRoot 'pg16.zip'
$PostgresExtractRoot = Join-Path $PostgresCacheRoot 'pg16'

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

function Ensure-PostgresPortable {
  New-Item -ItemType Directory -Path $PostgresCacheRoot -Force | Out-Null

  $downloadRequired = $true
  if (Test-Path $PostgresArchive) {
    $archiveInfo = Get-Item $PostgresArchive
    $downloadRequired = $archiveInfo.Length -lt 100MB
  }

  if ($downloadRequired) {
    Write-Host "==> Descargando PostgreSQL portable $PostgresVersion" -ForegroundColor Cyan
    Write-Host "    $PostgresDownloadUrl"
    Invoke-WebRequest -Uri $PostgresDownloadUrl -OutFile $PostgresArchive -UseBasicParsing
  } else {
    Write-Host "==> Usando cache de PostgreSQL portable" -ForegroundColor Cyan
  }

  $postgresExeInCache = Join-Path $PostgresExtractRoot 'pgsql\bin\postgres.exe'
  if (-not (Test-Path $postgresExeInCache)) {
    if (Test-Path $PostgresExtractRoot) {
      Remove-Item -LiteralPath $PostgresExtractRoot -Recurse -Force
    }
    Write-Host '==> Extrayendo PostgreSQL portable' -ForegroundColor Cyan
    [System.IO.Compression.ZipFile]::ExtractToDirectory($PostgresArchive, $PostgresExtractRoot)
  }

  $pgsqlRoot = Join-Path $PostgresExtractRoot 'pgsql'
  if (-not (Test-Path (Join-Path $pgsqlRoot 'bin\postgres.exe'))) {
    $pgsqlRoot = Get-ChildItem -Path $PostgresExtractRoot -Directory -Recurse |
      Where-Object { Test-Path (Join-Path $_.FullName 'bin\postgres.exe') } |
      Select-Object -First 1 -ExpandProperty FullName
  }

  if ([string]::IsNullOrWhiteSpace($pgsqlRoot) -or -not (Test-Path (Join-Path $pgsqlRoot 'bin\postgres.exe'))) {
    throw 'No se encontro postgres.exe dentro del ZIP de PostgreSQL portable.'
  }

  New-Item -ItemType Directory -Path $PostgresRuntime -Force | Out-Null
  foreach ($requiredDir in @('bin', 'lib', 'share')) {
    Copy-Directory (Join-Path $pgsqlRoot $requiredDir) (Join-Path $PostgresRuntime $requiredDir)
  }
  foreach ($licenseFile in @('server_license.txt', 'commandlinetools_3rd_party_licenses.txt')) {
    $sourceLicense = Join-Path $pgsqlRoot $licenseFile
    if (Test-Path $sourceLicense) {
      Copy-Item -Path $sourceLicense -Destination (Join-Path $PostgresRuntime $licenseFile) -Force
    }
  }
  Set-Content -Path (Join-Path (Split-Path $PostgresRuntime -Parent) 'VERSION.txt') -Value "PostgreSQL $PostgresVersion portable from $PostgresDownloadUrl" -Encoding UTF8
}

Write-Host 'Preparando runtime 1.1.0 para instalador Windows...' -ForegroundColor Cyan

if (Test-Path $RuntimeRoot) {
  Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $RuntimeRoot, $ApiRuntime, $NodeRuntime, (Split-Path $PostgresRuntime -Parent) -Force | Out-Null

Copy-Item -Path $NodeExe -Destination (Join-Path $NodeRuntime 'node.exe') -Force
Copy-Directory (Join-Path $RepoRoot 'apps\api\dist') (Join-Path $ApiRuntime 'dist')
Copy-Directory (Join-Path $RepoRoot 'apps\api\prisma') (Join-Path $ApiRuntime 'prisma')
Copy-Directory (Join-Path $RepoRoot 'scripts\runtime') (Join-Path $ApiRuntime 'scripts')
Ensure-PostgresPortable

Copy-Item -Path (Join-Path $RepoRoot '.env.example') -Destination (Join-Path $RuntimeRoot '.env.example') -Force
Copy-Item -Path (Join-Path $RepoRoot 'README.md') -Destination (Join-Path $RuntimeRoot 'README.md') -Force

$apiPackage = @{
  name = '@vetcare/api-runtime'
  version = '1.1.0'
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
