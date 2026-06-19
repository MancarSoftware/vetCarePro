# VetCare Pro - Runtime local Windows

Este documento define el flujo local para desarrollo, pruebas internas y
empaquetado de VetCare Pro en Windows.

## Carpetas locales

El sistema usa estas rutas por defecto:

- `C:\VetCarePro\data\postgres`: datos de PostgreSQL embebido.
- `C:\VetCarePro\uploads`: imagenes, PDFs y archivos clinicos.
- `C:\VetCarePro\backups`: respaldos SQL/ZIP.
- `C:\VetCarePro\logs`: logs locales de Electron, API y PostgreSQL.
- `C:\VetCarePro\temp`: archivos temporales.

## Instalador 1.0.0

El instalador Windows incluye:

- Cliente Electron.
- API NestJS compilada.
- Node.js embebido para ejecutar la API.
- PostgreSQL portable embebido.
- `pg_dump.exe` embebido para backups.
- Migraciones SQL del esquema.
- Logo e iconos del producto.

En una PC cliente no se instala Docker, Node.js ni PostgreSQL por separado. En
el primer arranque, Electron inicializa `C:\VetCarePro\data\postgres`, levanta
PostgreSQL en `127.0.0.1:54529`, aplica migraciones y luego inicia la API local.

## Comandos principales de desarrollo

```powershell
npm run local:doctor
npm run local:prepare
npm run local:start
```

Estos comandos siguen siendo utiles para desarrollo. Pueden usar Docker segun el
flujo local de desarrollo, pero Docker no forma parte del instalador final.

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

`release:runtime` descarga/cachea PostgreSQL portable desde EDB, lo copia a
`release\runtime\postgres\pgsql` y empaqueta ese runtime dentro de Electron.

## Preparacion LAN futura

La arquitectura se mantiene separada:

```text
Electron -> API NestJS -> PostgreSQL -> archivos locales
```

En modo Local, PostgreSQL vive en la misma PC. En modo LAN, se podra configurar
`DATABASE_URL` o `VETCARE_DATABASE_URL` hacia la IP de una PC servidor, por
ejemplo:

```text
postgresql://vetcare:clave@192.168.1.10:54329/vetcare_pro?schema=public
```

Cuando la base configurada no es la local por defecto, Electron omite el
arranque de PostgreSQL embebido y usa la base externa.
