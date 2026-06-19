# VetCare Pro 1.0.0

Aplicacion veterinaria desktop local para Windows.

La version instalable 1.0.0 incluye Electron, la API local compilada, Node.js
embebido, PostgreSQL portable embebido, migraciones SQL y el logo final del
producto. En una PC cliente no requiere Docker, Node.js, PostgreSQL ni internet.

## Requisitos para instalar en cliente

- Windows 10/11 x64.
- Puerto `4782` libre para la API local.
- Puerto `54529` libre para PostgreSQL embebido.

## Requisitos de desarrollo

- Node.js 22.12 o superior.
- npm 10 o superior.
- Docker Desktop solo para el flujo de desarrollo local con `local:*`.

## Inicio rapido de desarrollo

```powershell
npm install
npm run local:prepare
npm run local:start
```

`npm run local:prepare` crea `C:\VetCarePro`, prepara `.env`, inicia PostgreSQL
local de desarrollo y aplica migraciones.

`npm run local:start` levanta la API local y abre la aplicacion Electron.

## Comandos utiles

```powershell
npm run local:doctor
npm run local:prepare
npm run local:start
npm run package:win:dir
npm run package:win
```

- `local:doctor`: valida Node, npm, entorno local, `.env`, carpetas y puertos.
- `local:prepare`: prepara runtime local de desarrollo y base de datos.
- `local:start`: inicia API + Electron.
- `brand:assets`: regenera logo e iconos del producto.
- `release:runtime`: prepara API, Node.js, PostgreSQL portable y migraciones para el instalador.
- `package:win:dir`: genera paquete Electron sin instalador.
- `package:win`: genera instalador Windows NSIS final.

## Servicios locales

- API: `http://127.0.0.1:4782/api`
- Salud: `http://127.0.0.1:4782/api/health`
- PostgreSQL embebido del instalador: `127.0.0.1:54529`
- PostgreSQL de desarrollo con Docker: `127.0.0.1:54329`

## Runtime local Windows

Las rutas por defecto son:

- Datos PostgreSQL: `C:\VetCarePro\data\postgres`
- Archivos clinicos: `C:\VetCarePro\uploads`
- Backups: `C:\VetCarePro\backups`
- Logs: `C:\VetCarePro\logs`

Para futura version LAN, la aplicacion mantiene la separacion Electron -> API ->
PostgreSQL. Cambiando `DATABASE_URL` / `VETCARE_DATABASE_URL` a una IP de
servidor, el runtime embebido puede omitirse y conectarse a PostgreSQL remoto.

Mas detalles: `docs/windows-local-runtime.md`.

Plan de prueba en otra maquina: `docs/release-1.0-test-plan.md`.
