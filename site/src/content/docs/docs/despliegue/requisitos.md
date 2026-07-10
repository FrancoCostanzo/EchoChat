---
title: Requisitos
description: Requisitos de hardware, software y dimensionamiento para desplegar EchoChat.
---

## Requisitos de software

| Componente | Versión mínima | Notas |
|------------|-----------------|-------|
| **Node.js** | 18 LTS | Requerido para correr backend y frontend en modo desarrollo |
| **PostgreSQL** | 15+ | Usa extensiones `uuid-ossp`, `pg_trgm` y `btree_gin` |
| **MinIO** | Cualquier versión reciente | O cualquier almacenamiento compatible con S3 |
| **Docker + Docker Compose** | Docker ≥ 20, Compose ≥ 2.20 | Solo si desplegás con contenedores (ver [Despliegue con Docker](/docs/despliegue)) |
| **Sistema operativo** | Linux, macOS o Windows | Sin dependencias nativas fuera de las de `npm` |

## Requisitos de hardware

No hay benchmarks oficiales publicados. Como punto de partida razonable para una intranet
de equipo pequeño/mediano (decenas a un par de cientos de usuarios concurrentes):

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4-8 GB |
| Disco | 20 GB | 50+ GB (crece con adjuntos en MinIO y el historial de mensajes) |

Ajustá según el número de usuarios, volumen de adjuntos multimedia y retención de mensajes.

## Dimensionamiento recomendado

- **Todo en un servidor** (ver [Modo 1](/docs/despliegue#modo-1-todo-en-uno-un-solo-servidor)):
  válido para equipos chicos o pruebas de concepto.
- **Separar PostgreSQL y/o MinIO** en servidores propios cuando la organización ya tiene
  infraestructura de base de datos o almacenamiento, o cuando el volumen de datos crece.
- El **pool de conexiones a PostgreSQL** (`DB_POOL_MIN=2` / `DB_POOL_MAX=20` por defecto) es el
  primer parámetro a ajustar si hay muchos usuarios concurrentes; ver
  [Variables de entorno](/docs/despliegue/variables-entorno).

## Puertos de red

| Puerto | Servicio | Contexto |
|--------|----------|----------|
| `3000` | API backend (Express + Socket.IO) | Interno en Docker; expuesto en desarrollo |
| `5173` | Frontend (Vite dev server) | Solo desarrollo |
| `80` | Frontend (Nginx) | Producción con Docker Compose |
| `5432` | PostgreSQL | Interno, o el de tu servidor externo |
| `9000` | MinIO API (S3) | Interno, o el de tu servidor externo |
| `9001` | Consola web de MinIO | Solo si usás el MinIO integrado |

## Dependencias externas

- **PostgreSQL**: única base de datos soportada. El esquema completo vive en
  `backend/docs/messaging_intranet_schema.sql`.
- **MinIO** (o S3-compatible): almacena avatares, imágenes, videos, audio, documentos y
  grabaciones. Ver [Almacenamiento](/docs/despliegue/almacenamiento).
- **LDAP / Active Directory** (opcional): para importar y autenticar usuarios contra un
  directorio corporativo existente. Deshabilitado por defecto (`LDAP_ENABLED=false`).
- **STUN/TURN** (opcional): recomendado para llamadas WebRTC entre redes con NAT estricto.
  Ver [Red y TURN](/docs/despliegue/red-y-turn).

## Checklist previo al despliegue

- [ ] Definí el modo de despliegue: todo en uno, mixto o solo app (ver [Despliegue con Docker](/docs/despliegue)).
- [ ] Generaste un `JWT_SECRET` aleatorio y seguro.
- [ ] Generaste un `MESSAGE_ENC_KEY` (cifrado de mensajes en reposo) y lo respaldaste en un lugar seguro.
- [ ] Cambiaste las contraseñas por defecto de PostgreSQL y MinIO.
- [ ] Configuraste `CORS_ORIGIN` con el dominio/IP público real (no `*`).
- [ ] Configuraste `MINIO_PUBLIC_ENDPOINT` para que los navegadores puedan descargar adjuntos.
- [ ] Tenés un plan de backups (ver [Backups](/docs/despliegue/backups)).
- [ ] Revisaste los [requisitos de software](#requisitos-de-software) en el servidor destino.
