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

## Guia LAN v1.1.0 - configuracion por computadoras

La version LAN esta pensada para una veterinaria que quiere usar VetCare Pro en
2 o mas computadoras dentro de la misma red local. No depende de nube ni de
internet para operar. La primera PC de la veterinaria actua como servidor y las
demas PCs se conectan a esa PC.

### Ejemplo real de instalacion

```text
PC 1 - Recepcion / Servidor
IP: 192.168.1.10
Modo: LAN Servidor
Rol: guarda la base de datos, archivos clinicos, imagenes, backups y ejecuta la API.
API: http://192.168.1.10:4782/api
Salud: http://192.168.1.10:4782/api/health

PC 2 - Veterinario
IP: 192.168.1.15
Modo: LAN Cliente
Se conecta a: http://192.168.1.10:4782/api
Rol: consulta mascotas, historial clinico, citas, vacunas, tratamientos e imagenes.

PC 3 - Caja
IP: 192.168.1.18
Modo: LAN Cliente
Se conecta a: http://192.168.1.10:4782/api
Rol: registra pagos, abonos, productos, reportes y movimientos de caja.
```

En este ejemplo, la IP importante es la del servidor: `192.168.1.10`. Todas las
PCs cliente apuntan al servidor usando el puerto `4782`. Las IPs de los clientes
sirven para identificar cada equipo dentro de la red, pero los clientes no deben
recibir conexiones directas.

### Reglas de conexion LAN

- Todas las PCs deben estar conectadas al mismo router o a la misma red local.
- La PC servidor debe conectarse preferiblemente por cable Ethernet.
- Las PCs cliente pueden conectarse por cable Ethernet o por el mismo WiFi.
- No usar WiFi de invitados para los clientes.
- No activar `AP isolation`, `client isolation` o aislamiento de clientes WiFi.
- No abrir puertos del router hacia internet.
- PostgreSQL se queda interno en la PC servidor; los clientes solo hablan con la API.

La red puede funcionar sin internet, siempre que el router permita comunicacion
local entre las computadoras.

### Como saber la IP del servidor

En la PC servidor, abrir PowerShell o CMD y ejecutar:

```powershell
ipconfig
```

Buscar el adaptador activo, normalmente `Ethernet` o `Wi-Fi`, y leer:

```text
Direccion IPv4 . . . . . . . . . . . . : 192.168.1.10
```

Esa direccion es la que se configura en los clientes LAN.

### IP fija recomendada

Para evitar que la IP del servidor cambie, se recomienda dejar fija la IP de la
PC servidor.

Opcion recomendada:

- Crear una reserva DHCP en el router para la PC servidor.
- Ejemplo: reservar siempre `192.168.1.10` para recepcion/servidor.

Opcion alternativa:

- Configurar una IP fija manualmente en Windows.

La reserva DHCP del router suele ser mejor para clientes no tecnicos, porque
reduce el riesgo de conflictos de IP.

### Puertos LAN

- `4782`: API de VetCare Pro. Debe permitir conexiones entrantes en la PC servidor.
- `54529`: PostgreSQL embebido. Debe quedarse local en la PC servidor.

Si una PC cliente no puede entrar, revisar el firewall de Windows en la PC
servidor y permitir VetCare Pro o el puerto TCP `4782` para redes privadas.

### Backups en LAN

En modo LAN, los backups se ejecutan y se guardan en la PC servidor:

```text
C:\VetCarePro\backups
```

Los clientes LAN no deben guardar backups independientes. El respaldo correcto
incluye la base de datos del servidor y los archivos clinicos ubicados en:

```text
C:\VetCarePro\uploads
```

Recomendacion operativa:

- Backup manual antes de mantenimientos o actualizaciones.
- Backup automatico diario en la PC servidor.
- Copia semanal a disco externo, USB o NAS local si el cliente lo permite.

### Checklist rapido si un cliente no conecta

1. Confirmar que servidor y cliente esten conectados al mismo router.
2. Confirmar que el cliente no este en WiFi de invitados.
3. Confirmar que la IP del servidor sea correcta.
4. Desde la PC cliente, abrir en el navegador:

```text
http://192.168.1.10:4782/api/health
```

5. Si no responde, probar desde la PC cliente:

```powershell
ping 192.168.1.10
```

6. Revisar firewall de Windows en la PC servidor.
7. Confirmar que VetCare Pro servidor este abierto o que el servicio local este corriendo.
8. Si la IP del servidor cambio, actualizar la IP configurada en los clientes.

### Migracion desde VetCare Pro 1.0.0 local

Si una veterinaria ya usaba VetCare Pro `1.0.0` en una sola PC, esa misma PC
puede convertirse en servidor LAN. La informacion local se conserva en:

```text
C:\VetCarePro
```

Luego, las nuevas PCs se instalan como clientes LAN y se conectan a la IP de la
PC servidor.

## Runtime local Windows

Las rutas por defecto son:

- Datos PostgreSQL: `C:\VetCarePro\data\postgres`
- Archivos clinicos: `C:\VetCarePro\uploads`
- Backups: `C:\VetCarePro\backups`
- Logs: `C:\VetCarePro\logs`

La arquitectura mantiene la separacion Electron -> API -> PostgreSQL. Para LAN,
los clientes no deben conectarse directo a PostgreSQL; siempre deben hablar con
la API del servidor.

Mas detalles: `docs/windows-local-runtime.md`.

Plan de prueba en otra maquina: `docs/release-1.0-test-plan.md`.
