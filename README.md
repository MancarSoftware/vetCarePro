# VetCare Pro

Aplicacion veterinaria desktop local para Windows.

## Requisitos de desarrollo

- Node.js 22.12 o superior
- npm 10 o superior
- Docker Desktop

## Inicio rapido

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`npm run dev` inicia PostgreSQL, aplica las migraciones, levanta la API local y
abre la aplicacion Electron.

## Servicios locales

- API: `http://127.0.0.1:4782/api`
- Salud: `http://127.0.0.1:4782/api/health`
- PostgreSQL: `127.0.0.1:54329`

