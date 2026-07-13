---
title: RBAC
description: Roles, permisos globales y por conversación en EchoChat.
---

## Modelo de autorización

EchoChat combina dos niveles de control de acceso: **RBAC global** (roles → permisos,
aplicado por endpoint) y **roles por conversación** (owner/admin/moderador/miembro/viewer
dentro de un grupo o canal específico). Son independientes entre sí.

## Roles globales

| Rol | Prioridad | Descripción |
|-----|-----------|--------------|
| `super_admin` | 100 | Acceso total, sin restricciones |
| `admin` | 80 | Gestión de usuarios y contenido |
| `moderator` | 50 | Moderar mensajes y grupos |
| `user` | 10 | Rol estándar de un empleado |
| `readonly` | 5 | Solo lectura, sin permisos de escritura asignados |

## Permisos por endpoint

Los permisos son códigos atómicos por categoría, verificados en el middleware
`requirePermission(...)` de cada ruta:

| Categoría | Ejemplos |
|-----------|----------|
| `messages` | `messages.send`, `messages.delete_own`, `messages.delete_any`, `messages.edit` |
| `calls` | `calls.make_voice`, `calls.make_video`, `calls.make_conference`, `calls.record` |
| `groups` | `groups.create`, `groups.manage_own`, `groups.manage_any`, `groups.invite` |
| `broadcast` | `broadcast.create`, `broadcast.send` |
| `media` | `media.upload`, `media.delete_own`, `media.delete_any` |
| `admin` | `admin.users`, `admin.settings`, `admin.view_audit`, `admin.storage` |

`user` tiene los permisos estándar de un empleado; `moderator` agrega
`messages.delete_any`, `groups.manage_any` y `calls.record`; `admin`/`super_admin` tienen
todos los permisos; `readonly` no tiene ninguno asignado.

## Roles por conversación

Independiente del rol global, cada miembro de un grupo o canal tiene un rol propio de esa
conversación: **owner**, **admin**, **moderador**, **miembro** o **viewer** — controla
quién puede cambiar la configuración del canal, resolver solicitudes de ingreso o
gestionar otros miembros dentro de esa conversación puntual.

## super_admin

El rol `super_admin` **bypasea todas las verificaciones de permisos** — no importa qué
`requirePermission` tenga una ruta, siempre pasa. El sistema protege al último
`super_admin` restante contra eliminación o degradación (ver [Usuarios](/docs/admin/usuarios#protección-del-super_admin)).

## Seed de permisos

El esquema base (`messaging_intranet_schema.sql`) siembra roles, permisos y el mapeo
`role_permissions` en una instancia nueva. Si una instalación existente quedó con
`role_permissions` vacía (síntoma: todos los usuarios reciben `403`), hay dos migraciones
idempotentes para corregirlo:

- `backend/docs/migrations/001_seed_role_permissions.sql` — solo el mapeo rol→permisos.
- `backend/docs/migrations/002_bootstrap_rbac.sql` — bootstrap completo (roles,
  permisos, mapeo y backfill de rol `user` para usuarios sin ningún rol asignado).

## Aplicar permisos en despliegues existentes

```bash
psql -U echochat -d echochat -f backend/docs/migrations/001_seed_role_permissions.sql
```

Es seguro correrla más de una vez (`ON CONFLICT DO NOTHING`).

## Buenas prácticas

- Reservá `super_admin` para el mínimo de cuentas necesario.
- Usá `moderator` para quienes necesitan moderar contenido sin acceso al panel de
  administración.
- Revisá periódicamente qué usuarios tienen roles con permisos `admin.*` desde
  [Usuarios](/docs/admin/usuarios).
