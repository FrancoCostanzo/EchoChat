---
title: Arquitectura
description: Cómo se conectan el frontend, el backend y los servicios de infraestructura.
---

EchoChat sigue una arquitectura cliente-servidor clásica con comunicación en tiempo real
vía **Socket.IO**, sobre un stack full-stack JavaScript.

## Vista general

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                        │
│   Pages · Stores (Zustand) · Components · API Client (Axios)      │
│                          ↕ Socket.IO                              │
└───────────────────────────────┬───────────────────────────────────┘
                                │  (dev) Vite proxy: /api → :3000
┌───────────────────────────────┴───────────────────────────────────┐
│                   BACKEND (Express + Socket.IO)                    │
│   Middlewares: Auth · Validate · Rate Limit · Errors · Logging     │
│   Routes → Controllers → Services → Repositories                   │
│   DTOs (Joi) · Models (transform)                                  │
└──────────────┬───────────────────────────────┬────────────────────┘
               │                               │
        ┌──────┴──────┐                 ┌──────┴───────┐
        │ PostgreSQL  │                 │ S3 (MinIO…)  │
        │ o SQL Server│                 │  o disco     │
        └─────────────┘                 └──────────────┘
```

## Backend por capas

El backend está organizado en capas con responsabilidades claras:

- **Routes** — definen los endpoints HTTP y los eventos de socket.
- **Controllers** — orquestan la petición/respuesta y delegan en servicios.
- **Services** — contienen la lógica de negocio.
- **Repositories** — acceso a datos (consultas con Kysely, a PostgreSQL o SQL Server).
- **DTOs (Joi)** — validación de entrada.
- **Models** — transformación de datos hacia el cliente.

Middlewares transversales: autenticación (JWT), validación, rate limiting, manejo de
errores y logging (Pino, con redacción de headers sensibles).

## Tiempo real

La mensajería, presencia, indicadores de escritura, recibos de lectura, señalización de
llamadas y actualizaciones de encuestas viajan por **Socket.IO** sobre el mismo servidor
que expone la API HTTP.

Las llamadas de voz/video son la excepción a "todo pasa por el servidor": Socket.IO solo
relé la señalización (ofertas/respuestas SDP, candidatos ICE) por una sala `call:{id}`;
el audio y el video viajan **peer-to-peer** entre navegadores vía WebRTC. Más detalle en
[Llamadas de voz y video](/docs/llamadas).

## Almacenamiento

- **PostgreSQL 15+** (o **SQL Server 2019+**, con `DB_CLIENT=mssql`) para todos los
  datos relacionales. Ver [Base de datos](/docs/despliegue/base-de-datos).
- **Cualquier S3 compatible** (MinIO, AWS S3, R2…) o una **carpeta del disco** para
  archivos, avatares y grabaciones, servidos mediante **URLs firmadas** con TTL. Ver
  [Almacenamiento](/docs/despliegue/almacenamiento).

## Despliegue

En producción, un contenedor **Nginx** sirve el frontend estático y hace de proxy de
`/api` y `/socket.io` hacia el backend Node.js. PostgreSQL y MinIO pueden correr como
contenedores (perfiles de Docker Compose) o ser servicios externos. Ver
[Despliegue con Docker](/docs/despliegue).
