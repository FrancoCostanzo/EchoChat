---
title: Despliegue con Docker
description: Desplegar EchoChat en producción con Docker Compose.
---

EchoChat se despliega con **Docker Compose** en 3 modos según la infraestructura disponible:

| Modo | ¿Qué levanta Docker? | ¿Qué ya tiene la empresa? |
|------|----------------------|--------------------------|
| **Todo en uno** | Backend + Frontend + PostgreSQL + MinIO | Nada, todo en un servidor |
| **Mixto** | Backend + Frontend + lo que falte | PostgreSQL y/o MinIO existente |
| **Solo app** | Backend + Frontend | PostgreSQL + MinIO propios |

## Prerrequisitos

- **Docker** >= 20
- **Docker Compose** >= 2.20

## Modo 1: Todo en uno (un solo servidor)

Ideal para empezar rápido. Levanta todo en un mismo servidor:

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat

# Copiar y editar la configuración
cp .env.example .env
```

Editá `.env` con estos valores:

```ini
# Activar PostgreSQL y MinIO integrados
COMPOSE_PROFILES=postgres,minio

# Passwords seguras (cambiar obligatoriamente)
DB_PASSWORD=mi_password_segura_postgres
MINIO_SECRET_KEY=mi_password_segura_minio

# Secreto JWT (generar uno aleatorio)
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=...

# URL pública: poner la IP o dominio del servidor
CORS_ORIGIN=http://192.168.1.100
MINIO_PUBLIC_ENDPOINT=192.168.1.100
```

```bash
docker compose up -d
```

La app estará en **http://192.168.1.100** (o la IP/dominio configurado).

:::note
El esquema SQL se aplica automáticamente en el primer inicio desde
`backend/docs/messaging_intranet_schema.sql`. Los buckets de MinIO se crean
automáticamente al iniciar el backend.
:::

## Modo 2: PostgreSQL y/o MinIO existentes

Si ya existen servidores de base de datos o almacenamiento, apuntá a ellos:

```ini
# No activar ningún perfil (o solo el que necesite)
COMPOSE_PROFILES=

# PostgreSQL externo
DB_HOST=10.0.1.50
DB_PORT=5432
DB_NAME=echochat
DB_USER=echochat
DB_PASSWORD=password_del_postgres_existente

# MinIO/S3 externo
MINIO_ENDPOINT=10.0.1.51
MINIO_PORT=9000
MINIO_ACCESS_KEY=access_key_existente
MINIO_SECRET_KEY=secret_key_existente
MINIO_PUBLIC_ENDPOINT=10.0.1.51
```

:::caution
Con PostgreSQL externo debés ejecutar el esquema SQL manualmente:

```bash
psql -h 10.0.1.50 -U echochat -d echochat -f backend/docs/messaging_intranet_schema.sql
```
:::

## Modo 3: Mixto

Por ejemplo, base de datos externa y MinIO local:

```ini
COMPOSE_PROFILES=minio
DB_HOST=10.0.1.50
DB_PASSWORD=password_del_postgres_existente
MINIO_ENDPOINT=minio
MINIO_PUBLIC_ENDPOINT=192.168.1.100
```

## Comandos útiles

```bash
# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar solo el backend
docker compose restart backend

# Reconstruir imágenes tras cambios de código
docker compose build --no-cache
docker compose up -d

# Detener todo
docker compose down

# Detener y eliminar volúmenes (⚠️ borra datos de BD y archivos)
docker compose down -v
```

## Consola de MinIO

Con el MinIO integrado, la consola web está en `http://IP_DEL_SERVIDOR:9001` con las
credenciales configuradas en `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`.
