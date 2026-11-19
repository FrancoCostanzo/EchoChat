---
title: Troubleshooting
description: Errores comunes y diagnóstico al desplegar o operar EchoChat.
---

## La app no carga

- Verificá que el backend esté arriba: `GET /api/health/live` debería responder
  `status: alive`.
- Confirmá que el frontend apunta al backend correcto — en desarrollo, el proxy de Vite
  reenvía `/api` y `/socket.io` a `:3000` automáticamente; en producción, revisá la
  configuración de Nginx del contenedor `frontend`.
- Revisá `CORS_ORIGIN`: si no coincide exactamente con el origen desde el que accedés
  (protocolo + host + puerto), el navegador bloquea las peticiones.

## Errores de conexión a la base de datos

- Revisá `DB_CLIENT` (`postgres` o `mssql`) y
  `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` en tu `.env`.
- Con SQL Server y un certificado autofirmado, la conexión falla hasta poner
  `DB_TRUST_SERVER_CERT=true` (ver [Base de datos](/docs/despliegue/base-de-datos#sql-server)).
- En Docker todo-en-uno, `DB_HOST` debe ser `postgres` (el nombre del servicio), no
  `localhost`.
- `GET /api/health/ready` responde `503` si la base de datos no está accesible, con el
  detalle en `reasons`.
- Si el login funciona pero las acciones fallan con `403 Missing required permission`,
  ver [Permisos y RBAC](#permisos-y-rbac) más abajo — no es un problema de conexión.

## Errores de almacenamiento y archivos

- Con `STORAGE_DRIVER=s3`, confirmá que `S3_ENDPOINT`/`MINIO_ENDPOINT` (conexión
  interna del backend) y `S3_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_ENDPOINT` (lo que usa el
  navegador para descargar) estén bien configurados — son conceptualmente distintos. Ver
  [Almacenamiento](/docs/despliegue/almacenamiento#endpoint-público).
- Si las imágenes/archivos no cargan pero el resto de la app funciona, es casi siempre
  el endpoint público mal configurado (el navegador no puede alcanzar esa dirección).
- En AWS S3, un error de firma o de bucket inexistente suele ser `S3_REGION` faltante o
  `S3_PATH_STYLE` sin poner en `false`.
- Con `STORAGE_DRIVER=local`, si los archivos no cargan desde la app de escritorio o
  desde otro dominio, falta `STORAGE_PUBLIC_URL`. Si se pierden al recrear el contenedor,
  falta el volumen en `STORAGE_LOCAL_DIR`.
- Los buckets se crean automáticamente al iniciar el backend; si faltan, revisá los logs
  de arranque del backend por errores de conexión al almacenamiento.

## WebSocket / Socket.IO

- El socket se autentica con el mismo JWT que la sesión HTTP
  (`socket.handshake.auth.token`). Si ves `Authentication required` o `Invalid token` en
  los logs del backend, el cliente no está enviando o está enviando un token expirado.
- El typing indicator, la presencia en tiempo real y los mensajes nuevos dependen del
  socket conectado — si no llegan, revisá la consola del navegador por errores de
  conexión y que `CORS_ORIGIN` coincida (Socket.IO reutiliza esa configuración).

## Llamadas WebRTC

- Si las llamadas fallan solo entre ciertas redes (por ejemplo, fuera de la intranet),
  es probablemente un problema de NAT — ver [Red y TURN](/docs/despliegue/red-y-turn).
- La señalización (quién llama, aceptar/rechazar) va por Socket.IO: si el socket no
  conecta, las llamadas tampoco van a iniciar.

## Permisos y RBAC

- `403 Missing required permission: <código>` significa que el rol del usuario no tiene
  ese permiso asignado. Si le pasa a **todos** los usuarios recién después de instalar,
  probablemente falta el seed de RBAC — reiniciar el backend lo repone (ver
  [Base de datos](/docs/despliegue/base-de-datos#seed-datos-de-referencia)).
- Verificá roles y permisos efectivos desde [RBAC](/docs/admin/rbac) en el panel de
  administración.

## Logs y diagnóstico

- **Backend**: logs estructurados con Pino. En desarrollo (`npm run dev`) se ven
  formateados con `pino-pretty`; ajustá el nivel con `LOG_LEVEL`.
- **Docker**: `docker compose logs -f backend` / `docker compose logs -f frontend`.
- **Dashboard de monitoreo**: `/admin/monitoring` (o `GET /api/monitoring/health`) muestra
  el estado agregado del servidor, base de datos, HTTP y jobs cron — es el primer lugar
  para diagnosticar un problema en producción. Ver [Monitoreo](/docs/admin/monitoreo).

## Recursos útiles

- [Variables de entorno](/docs/despliegue/variables-entorno) — referencia completa
- [Base de datos](/docs/despliegue/base-de-datos) — esquema y migraciones
- [Monitoreo](/docs/admin/monitoreo) — diagnóstico en vivo
- Repositorio: [github.com/FrancoCostanzo/EchoChat](https://github.com/FrancoCostanzo/EchoChat)
