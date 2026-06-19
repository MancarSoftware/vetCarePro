# VetCare Pro 1.0.0

Aplicacion veterinaria desktop local para Windows.

La version instalable 1.0.0 incluye Electron, la API local compilada, un
runtime Node.js embebido para la API, migraciones SQL y configuracion Docker
para PostgreSQL local.

## Requisitos de desarrollo

- Node.js 22.12 o superior
- npm 10 o superior
- Docker Desktop

## Inicio rapido

```powershell
npm install
npm run local:prepare
npm run local:start
```

`npm run local:prepare` crea `C:\VetCarePro`, prepara `.env`, inicia PostgreSQL
local y aplica migraciones.

`npm run local:start` levanta la API local y abre la aplicacion Electron.

## Comandos utiles

```powershell
npm run local:doctor
npm run local:prepare
npm run local:start
npm run package:win:dir
npm run package:win
```

- `local:doctor`: valida Node, npm, Docker, `.env`, carpetas y puertos.
- `local:prepare`: prepara runtime local y base de datos.
- `local:start`: inicia API + Electron.
- `package:win:dir`: genera paquete Electron sin instalador.
- `package:win`: genera instalador Windows NSIS.
- `release:runtime`: prepara API, Node.js y migraciones para el instalador.

## Servicios locales

- API: `http://127.0.0.1:4782/api`
- Salud: `http://127.0.0.1:4782/api/health`
- PostgreSQL: `127.0.0.1:54329`

## Runtime local Windows

Las rutas por defecto son:

- Archivos clinicos: `C:\VetCarePro\uploads`
- Backups: `C:\VetCarePro\backups`
- Logs: `C:\VetCarePro\logs`

Mas detalles: `docs/windows-local-runtime.md`.

Plan de prueba en otra maquina: `docs/release-1.0-test-plan.md`.
