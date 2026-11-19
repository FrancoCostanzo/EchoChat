---
title: Requisitos
description: Requisitos de hardware, software y dimensionamiento para desplegar EchoChat.
---

## Requisitos de software

| Componente | Versión mínima | Notas |
|------------|-----------------|-------|
| **Node.js** | 22 LTS | Requerido para correr backend y frontend en modo desarrollo |
| **PostgreSQL** | 15+ | Usa extensiones `uuid-ossp`, `pg_trgm` y `btree_gin` |
| **SQL Server** (alternativa) | 2019+ | Con `DB_CLIENT=mssql`; ver [Base de datos](/docs/despliegue/base-de-datos#sql-server) |
| **Almacenamiento** | — | MinIO, AWS S3, R2 u otro S3 compatible, o una carpeta del disco (`STORAGE_DRIVER=local`) |
| **Docker + Docker Compose** | Docker ≥ 20, Compose ≥ 2.20 | Solo si desplegás con contenedores (ver [Despliegue con Docker](/docs/despliegue)) |
| **Sistema operativo** | Linux, macOS o Windows | Sin dependencias nativas fuera de las de `npm` |

## Requisitos de hardware

No hay benchmarks oficiales publicados. Como punto de partida razonable para una intranet
de equipo pequeño/mediano (decenas a un par de cientos de usuarios concurrentes):

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4-8 GB |
| Disco | 20 GB | 50+ GB (crece con los adjuntos y el historial de mensajes) |

Ajustá según el número de usuarios, volumen de adjuntos multimedia y retención de mensajes.

## Dimensionamiento recomendado

- **Todo en un servidor** (ver [Modo 1](/docs/despliegue#modo-1-todo-en-uno-un-solo-servidor)):
  válido para equipos chicos o pruebas de concepto.
- **Separar la base de datos y/o el almacenamiento** en servidores propios cuando la organización ya tiene
  infraestructura de base de datos o almacenamiento, o cuando el volumen de datos crece.
- El **pool de conexiones a la base** (`DB_POOL_MIN=2` / `DB_POOL_MAX=20` por defecto) es el
  primer parámetro a ajustar si hay muchos usuarios concurrentes; ver
  [Variables de entorno](/docs/despliegue/variables-entorno).

## Puertos de red

| Puerto | Servicio | Contexto |
|--------|----------|----------|
| `3000` | API backend (Express + Socket.IO) | Interno en Docker; expuesto en desarrollo |
| `5173` | Frontend (Vite dev server) | Solo desarrollo |
| `80` | Frontend (Nginx) | Producción con Docker Compose |
| `5432` | PostgreSQL | Interno, o el de tu servidor externo |
| `1433` | SQL Server | Sólo con `DB_CLIENT=mssql` |
| `9000` | MinIO API (S3) | Interno, o el de tu servidor externo |
| `9001` | Consola web de MinIO | Solo si usás el MinIO integrado |

## Dependencias externas

- **Base de datos**: PostgreSQL (por defecto) o SQL Server. El esquema se crea solo al
  arrancar, con las migraciones de `backend/src/config/db/migrations/`. Ver
  [Base de datos](/docs/despliegue/base-de-datos).
- **Almacenamiento**: S3 compatible (MinIO, AWS S3, R2…) o disco local; guarda avatares,
  imágenes, videos, audio, documentos y grabaciones. Ver [Almacenamiento](/docs/despliegue/almacenamiento).
- **LDAP / Active Directory** (opcional): para importar y autenticar usuarios contra un
  directorio corporativo existente. Deshabilitado por defecto (`LDAP_ENABLED=false`).
- **STUN/TURN** (opcional): recomendado para llamadas WebRTC entre redes con NAT estricto.
  Ver [Red y TURN](/docs/despliegue/red-y-turn).

## Checklist previo al despliegue

- [ ] Definí el modo de despliegue: todo en uno, mixto o solo app (ver [Despliegue con Docker](/docs/despliegue)).
- [ ] Generaste un `JWT_SECRET` aleatorio y seguro.
- [ ] Generaste un `MESSAGE_ENC_KEY` (cifrado de mensajes en reposo) y lo respaldaste en un lugar seguro.
- [ ] Cambiaste las contraseñas por defecto de la base de datos y del almacenamiento.
- [ ] Configuraste `CORS_ORIGIN` con el dominio/IP público real (no `*`).
- [ ] Configuraste el endpoint público del almacenamiento (`S3_PUBLIC_ENDPOINT`, o `STORAGE_PUBLIC_URL` con el driver local) para que los navegadores puedan descargar adjuntos.
- [ ] Tenés un plan de backups (ver [Backups](/docs/despliegue/backups)).
- [ ] Revisaste los [requisitos de software](#requisitos-de-software) en el servidor destino.
