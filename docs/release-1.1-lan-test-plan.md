# VetCare Pro 1.1.0 LAN - plan de prueba

Este plan valida que el instalador LAN funcione en una veterinaria con una PC
servidor y una o mas PCs cliente dentro de la misma red local.

## 1. Preparar instalador

Ejecutar en desarrollo:

```powershell
npm run typecheck
npm run build
npm run package:win
```

El instalador esperado queda en:

```text
apps/desktop/dist/VetCare-Pro-Setup-1.1.0-x64.exe
```

## 2. PC 1 - Servidor LAN

1. Instalar VetCare Pro.
2. Abrir la aplicacion.
3. Elegir `Servidor LAN`.
4. Mantener puerto `4782`.
5. Copiar la IP recomendada marcada como red fisica.
6. Guardar y continuar.
7. Crear usuario administrador.
8. Confirmar que el indicador del topbar muestre `Servidor LAN` y `Conectado`.
9. Entrar a Backups y crear un backup manual.
10. Confirmar que se cree en `C:\VetCarePro\backups`.

Si los clientes no conectan, permitir el puerto TCP `4782` en Windows Firewall
para redes privadas.

## 3. PC 2 - Cliente LAN

1. Instalar VetCare Pro.
2. Abrir la aplicacion.
3. Elegir `Cliente LAN`.
4. En `IP de la PC servidor`, escribir solo la IP del servidor, por ejemplo:

```text
192.168.1.10
```

5. Mantener puerto `4782`.
6. Pulsar `Probar conexion`.
7. Si conecta, guardar y continuar.
8. Iniciar sesion con un usuario creado en el servidor.
9. Confirmar que dashboard, mascotas, citas, historial, pagos e inventario carguen.
10. Confirmar que el indicador del topbar muestre `Cliente LAN` y `Conectado`.

## 4. Validaciones clave

- Crear una mascota en Cliente LAN y verla inmediatamente en Servidor LAN.
- Crear una cita en Servidor LAN y verla en Cliente LAN.
- Subir un archivo clinico desde Cliente LAN y verificar que quede disponible.
- Registrar un pago desde Cliente LAN y verificar reporte/ingresos.
- En Cliente LAN, confirmar que Backups no permita crear, descargar ni eliminar.
- En Servidor LAN, confirmar que Backups si permita operar.
- Cambiar configuracion LAN desde el indicador del topbar y volver al modo correcto.

## 5. Fallos esperados y diagnostico

Si Cliente LAN no conecta:

1. Confirmar que ambas PCs esten en el mismo router o red local.
2. Confirmar que no sea WiFi de invitados.
3. Confirmar que se escribio la IP real del servidor, no `vEthernet`, `WSL`,
   `Docker`, `Hyper-V` ni otra red virtual.
4. Probar desde el navegador del cliente:

```text
http://IP_DEL_SERVIDOR:4782/api/health
```

5. Probar ping:

```powershell
ping IP_DEL_SERVIDOR
```

6. Revisar firewall en la PC servidor.

## 6. Criterio de version lista

La version LAN 1.1.0 queda lista cuando:

- El instalador no requiere Docker, Node.js ni PostgreSQL instalados aparte.
- Servidor LAN puede iniciar API, PostgreSQL, archivos y backups localmente.
- Cliente LAN no inicia servicios locales innecesarios y se conecta al servidor.
- El topbar muestra el modo y estado de conexion.
- La pantalla inicial permite corregir una IP mala.
- Backups quedan protegidos para ejecutarse solo desde Servidor LAN.
- `npm run typecheck` y `npm run build` pasan correctamente.
