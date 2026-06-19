# VetCare Pro 1.0.0 - Prueba en otra maquina

## Requisitos de la maquina de prueba

- Windows 10/11 x64.
- Docker Desktop instalado y abierto.
- Puerto `4782` libre para la API.
- Puerto `54329` libre para PostgreSQL local.

## Instalacion

1. Copiar `apps\desktop\dist\VetCare-Pro-Setup-1.0.0-x64.exe`.
2. Ejecutar el instalador.
3. Abrir VetCare Pro desde el acceso directo.
4. Esperar el primer arranque; puede tardar mientras inicia PostgreSQL y aplica
   migraciones.

## Validacion inicial

1. Debe abrir la pantalla de configuracion inicial si no hay usuarios.
2. Crear usuario administrador.
3. Entrar al dashboard.
4. Crear un dueno.
5. Crear una mascota asociada.
6. Crear una cita.
7. Crear una entrada de historial clinico.
8. Subir una imagen o PDF.
9. Crear un backup manual.
10. Cerrar y abrir de nuevo VetCare Pro.

## Rutas a revisar

- Archivos clinicos: `C:\VetCarePro\uploads`
- Backups: `C:\VetCarePro\backups`
- Logs de API: `C:\VetCarePro\logs\api.log`
- Errores de API: `C:\VetCarePro\logs\api-error.log`

## Resultado esperado

La app debe abrir desde el icono de Windows, levantar la API local por si sola,
usar PostgreSQL local en Docker y conservar los datos entre reinicios.
