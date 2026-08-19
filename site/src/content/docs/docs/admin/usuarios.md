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
usuarios desde un directorio o SSO si tu organización usa identidad corporativa
(ver [Integraciones](/docs/admin/integraciones)).

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

## Origen de la cuenta

Cada usuario muestra un chip de **origen** según su `auth_provider`: `local` (contraseña
propia), `ldap` (directorio), `oidc` (SSO), `saml` o `scim`. Los usuarios externos validan
su identidad contra el proveedor correspondiente y no tienen contraseña local (por eso no
ofrecen la acción de resetear contraseña).

La importación desde LDAP y la configuración de SSO viven ahora en su propia sección:
ver [Integraciones](/docs/admin/integraciones).

## Auditoría de cambios

Crear, editar, resetear contraseña y eliminar usuarios queda registrado en el
[log de auditoría](/docs/admin/auditoria) bajo la categoría `admin` (acciones
`admin.user_create`, `admin.user_update`, `admin.user_reset_password`,
`admin.user_delete`).
