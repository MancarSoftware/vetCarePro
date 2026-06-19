param(
  [switch]$SkipDocker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Message,
    [bool]$Required
  )

  $script:results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Message = $Message
    Required = $Required
  }) | Out-Null

  $color = 'Gray'
  if ($Status -eq 'OK') { $color = 'Green' }
  if ($Status -eq 'WARN') { $color = 'Yellow' }
  if ($Status -eq 'FAIL') { $color = 'Red' }
  Write-Host ("[{0}] {1} - {2}" -f $Status, $Name, $Message) -ForegroundColor $color
}

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Convert-ToVersion {
  param([string]$Value)
  if ($Value -match '(\d+)\.(\d+)\.(\d+)') {
    return [version]$Matches[0]
  }
  return $null
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    if (-not $task.Wait(800)) {
      return $false
    }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

Write-Host "VetCare Pro local doctor" -ForegroundColor Cyan
Write-Host ("Repo: {0}" -f $RepoRoot)
Write-Host ''

if (Test-CommandExists 'node') {
  $nodeVersion = Convert-ToVersion (& node --version)
  if ($nodeVersion -and $nodeVersion -ge [version]'22.12.0') {
    Add-Result 'Node.js' 'OK' ("Version {0}" -f $nodeVersion) $true
  } else {
    Add-Result 'Node.js' 'FAIL' 'Se requiere Node.js 22.12 o superior.' $true
  }
} else {
  Add-Result 'Node.js' 'FAIL' 'No se encontro node en PATH.' $true
}

if (Test-CommandExists 'npm') {
  $npmVersion = Convert-ToVersion (& npm --version)
  if ($npmVersion -and $npmVersion -ge [version]'10.0.0') {
    Add-Result 'npm' 'OK' ("Version {0}" -f $npmVersion) $true
  } else {
    Add-Result 'npm' 'FAIL' 'Se requiere npm 10 o superior.' $true
  }
} else {
  Add-Result 'npm' 'FAIL' 'No se encontro npm en PATH.' $true
}

if (-not $SkipDocker) {
  if (Test-CommandExists 'docker') {
    try {
      $dockerServer = & docker version --format '{{.Server.Version}}' 2>$null
      if ($LASTEXITCODE -eq 0 -and $dockerServer) {
        Add-Result 'Docker Desktop' 'OK' ("Motor activo {0}" -f $dockerServer) $true
      } else {
        Add-Result 'Docker Desktop' 'FAIL' 'Docker esta instalado, pero el motor no esta activo.' $true
      }
    } catch {
      Add-Result 'Docker Desktop' 'FAIL' 'Abre Docker Desktop y espera a que inicie.' $true
    }
  } else {
    Add-Result 'Docker Desktop' 'FAIL' 'No se encontro docker en PATH.' $true
  }
} else {
  Add-Result 'Docker Desktop' 'WARN' 'Revision omitida por parametro -SkipDocker.' $false
}

$envPath = Join-Path $RepoRoot '.env'
if (Test-Path $envPath) {
  Add-Result '.env' 'OK' 'Archivo de entorno local presente.' $false
} else {
  Add-Result '.env' 'WARN' 'No existe .env; ejecuta npm run local:prepare.' $false
}

$dataRoot = 'C:\VetCarePro'
foreach ($path in @($dataRoot, "$dataRoot\uploads", "$dataRoot\backups", "$dataRoot\logs")) {
  if (Test-Path $path) {
    Add-Result $path 'OK' 'Carpeta disponible.' $false
  } else {
    Add-Result $path 'WARN' 'Carpeta pendiente de crear.' $false
  }
}

if (Test-TcpPort '127.0.0.1' 4782) {
  Add-Result 'API local 4782' 'OK' 'La API esta escuchando.' $false
} else {
  Add-Result 'API local 4782' 'WARN' 'La API no esta activa ahora mismo.' $false
}

if (Test-TcpPort '127.0.0.1' 54329) {
  Add-Result 'PostgreSQL desarrollo 54329' 'OK' 'PostgreSQL de desarrollo esta escuchando.' $false
} else {
  Add-Result 'PostgreSQL desarrollo 54329' 'WARN' 'PostgreSQL de desarrollo no esta activo ahora mismo.' $false
}

if (Test-TcpPort '127.0.0.1' 54529) {
  Add-Result 'PostgreSQL runtime 54529' 'OK' 'PostgreSQL embebido esta escuchando.' $false
} else {
  Add-Result 'PostgreSQL runtime 54529' 'WARN' 'PostgreSQL embebido no esta activo ahora mismo.' $false
}

$requiredFailures = @($results | Where-Object { $_.Required -and $_.Status -eq 'FAIL' })
if ($requiredFailures.Count -gt 0) {
  Write-Host ''
  Write-Host 'El entorno local no esta listo.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host 'El entorno base esta listo.' -ForegroundColor Green
exit 0
