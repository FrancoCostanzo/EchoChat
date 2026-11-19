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

`messages.edit` y el borrado propio (`messages.delete_own`) están acotados por la
[ventana de tiempo del sistema](/docs/admin/sistema#ventana-de-edición-y-eliminación)
(default 15 minutos). `messages.delete_any` permite eliminar mensajes **sin** ese límite
(moderación).

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

Roles, permisos y el mapeo `role_permissions` viven en `backend/src/config/db/seed.ts`,
que el backend aplica en **cada** arranque y sólo inserta lo que falta. Por eso:

- Un permiso nuevo llega a las instalaciones existentes con sólo actualizar y reiniciar;
  se asigna solo a `super_admin` y `admin`.
- Si una base quedó con `role_permissions` vacía (síntoma: todos los usuarios reciben
  `403`), basta con **reiniciar el backend** (o correr `npm run migrate` desde
  `backend/`).

Ver [Base de datos](/docs/despliegue/base-de-datos#seed-datos-de-referencia).

## Buenas prácticas

- Reservá `super_admin` para el mínimo de cuentas necesario.
- Usá `moderator` para quienes necesitan moderar contenido sin acceso al panel de
  administración.
- Revisá periódicamente qué usuarios tienen roles con permisos `admin.*` desde
  [Usuarios](/docs/admin/usuarios).
