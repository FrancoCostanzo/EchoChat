---
title: Usuarios
description: Alta, baja, suspensión y gestión de roles de usuarios.
---

Requiere el permiso `admin.users`.

## Listar y filtrar usuarios

La tabla de usuarios pagina de 25 en 25 y admite búsqueda por nombre/usuario, filtro por
estado (`active`, `inactive`, `suspended`) y por departamento.

## Crear usuarios

Un admin puede crear usuarios locales manualmente asignándoles usuario, contraseña
inicial, perfil (nombre, departamento, cargo, extensión) y roles. Alternativa: importar
usuarios desde LDAP (ver más abajo) si tu organización usa un directorio corporativo.

## Editar perfil y estado

Desde la tabla podés editar el perfil de cualquier usuario y cambiar su estado
(`active`/`inactive`/`suspended`).

## Suspender y reactivar

**Suspender** a un usuario revoca automáticamente todas sus sesiones activas — se
desconecta de inmediato en todos sus dispositivos. Reactivarlo le permite volver a
iniciar sesión normalmente.

## Asignar roles

Cada usuario puede tener uno o más roles globales (`super_admin`, `admin`, `moderator`,
`user`, `readonly`). Asignar o quitar roles cambia sus permisos efectivos de inmediato
(ver [RBAC](/docs/admin/rbac)).

## Eliminar usuarios

La eliminación es un **soft delete**: el usuario deja de poder iniciar sesión y de
aparecer en búsquedas activas, pero sus mensajes históricos no se borran de las
conversaciones donde participó.

## Protección del super_admin

El sistema impide eliminar o degradar al **último usuario `super_admin`** restante, para
evitar que la instancia quede sin ningún administrador con acceso total.

## Import LDAP

Si `LDAP_ENABLED=true`, el panel muestra el estado de la conexión LDAP y un botón para
**importar usuarios** del directorio. Los usuarios importados quedan con
`auth_provider='ldap'` y su contraseña se valida contra el directorio (bind) en cada
login; los usuarios creados a mano siguen usando su contraseña local.

## Auditoría de cambios

Crear, editar, resetear contraseña y eliminar usuarios queda registrado en el
[log de auditoría](/docs/admin/auditoria) bajo la categoría `admin` (acciones
`admin.user_create`, `admin.user_update`, `admin.user_reset_password`,
`admin.user_delete`).
