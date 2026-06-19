# VetCare Pro - Runtime local Windows

Este documento define el flujo local para desarrollo, pruebas internas y
primer empaquetado de VetCare Pro en Windows.

## Carpetas locales

El sistema usa estas rutas por defecto:

- `C:\VetCarePro\uploads`: imagenes, PDFs y archivos clinicos.
- `C:\VetCarePro\backups`: respaldos SQL/ZIP.
- `C:\VetCarePro\logs`: logs locales futuros.
- `C:\VetCarePro\temp`: archivos temporales.

## Comandos principales

```powershell
npm run local:doctor
npm run local:prepare
npm run local:start
```

`local:doctor` valida Node, npm, Docker, `.env`, carpetas y puertos.

`local:prepare` crea las carpetas, genera `.env`, levanta PostgreSQL con Docker
y aplica migraciones Prisma.

`local:start` ejecuta la preparacion y luego inicia API + Electron.

En el instalador Windows 1.0.0, Electron levanta la API local automaticamente.
Si Docker Desktop esta instalado y activo, tambien ejecuta `docker compose up`
con el proyecto estable `vetcarepro` para PostgreSQL y aplica las migraciones
SQL del runtime embebido.

## Empaquetado

Para validar el paquete sin crear instalador:

```powershell
npm run package:win:dir
```

Para generar instalador Windows NSIS:

```powershell
npm run package:win
```

Los artefactos quedan en:

```text
apps\desktop\dist
```

El instalador incluye:

- Cliente Electron.
- API NestJS compilada.
- Node.js runtime local para ejecutar la API.
- Migraciones SQL.
- `docker-compose.yml` para PostgreSQL local.

## Nota de arquitectura

El instalador empaqueta la aplicacion Electron. La API local, PostgreSQL y
carpetas de datos siguen gestionadas por el runtime local. Esto mantiene la
arquitectura separada y lista para una version LAN futura.
