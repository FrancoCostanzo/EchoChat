---
title: Panel de administración
description: Visión general del panel admin, secciones y acceso por permisos.
---

## Acceder al panel

El panel de administración vive en `/admin` (redirige automáticamente a la primera
sección a la que tengas acceso). Aparece un ícono dedicado en el dock lateral solo si tu
usuario tiene al menos un permiso `admin.*`.

## Permisos requeridos

Cada sección del panel exige un permiso específico (ver [RBAC](/docs/admin/rbac)):

| Sección | Permiso |
|---------|---------|
| Usuarios | `admin.users` |
| Configuración del sistema | `admin.settings` |
| Auditoría | `admin.view_audit` |
| Almacenamiento | `admin.storage` |
| Monitoreo | cualquier permiso `admin.*` (o rol `super_admin`) |

## Secciones disponibles

- [Usuarios](/docs/admin/usuarios) — alta, baja, roles, import LDAP.
- [Configuración del sistema](/docs/admin/sistema) — `system_settings` por categoría.
- [Auditoría](/docs/admin/auditoria) — log de acciones críticas con filtros.
- [Almacenamiento](/docs/admin/almacenamiento) — estadísticas de MinIO.
- [Monitoreo](/docs/admin/monitoreo) — servidor, base de datos, HTTP y jobs en vivo.

## Navegación

El panel usa rutas `/admin/:section`; solo ves en el menú lateral las secciones para las
que tenés permiso. Si perdés el acceso a la sección actual (por ejemplo, te quitan un
rol), sos redirigido a la primera sección disponible.

## Diferencias con la app de chat

El panel de administración es una vista separada del chat: no hay conversaciones ni
composer, solo tablas, filtros y formularios de gestión. Podés volver al chat en
cualquier momento desde el dock lateral.

## Buenas prácticas

- Limitá el rol `super_admin` a la menor cantidad de cuentas posible; usá `admin` con
  permisos específicos para el resto del equipo de soporte/IT.
- Revisá la [auditoría](/docs/admin/auditoria) periódicamente, en especial acciones
  marcadas como `critical` (por ejemplo, eliminación de usuarios).
- Cambiá configuración sensible (como `allow_registration`) con cuidado: afecta a todos
  los usuarios de inmediato.
