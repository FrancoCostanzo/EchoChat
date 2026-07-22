---
title: Integraciones
description: Identidad y acceso empresarial — directorio LDAP/AD, SSO por OpenID Connect y aprovisionamiento.
---

Requiere el permiso `admin.users`. Estas integraciones conectan EchoChat con la
infraestructura de identidad de tu organización y se configuran por **variables de
entorno** en el backend (ver [Variables de entorno](/docs/despliegue/variables-entorno)).
El panel **Administración → Integraciones** muestra el estado de cada una en vivo.

Cada usuario recuerda su **proveedor de autenticación** (`auth_provider`): `local`
(contraseña propia), `ldap`, `oidc`, `saml` o `scim`. El origen se ve como un chip en la
tabla de [Usuarios](/docs/admin/usuarios).

## LDAP / Active Directory

Autenticación y sincronización contra un directorio corporativo (Active Directory,
OpenLDAP, etc.).

- **Login por bind**: los usuarios con `auth_provider='ldap'` validan su contraseña
  contra el directorio en cada login; no se guarda un hash local.
- **Sincronización**: alta y actualización de usuarios, departamento, cargo y —
  opcionalmente — roles a partir de grupos del directorio. Puede correr **manualmente**
  (botón *Sincronizar ahora* en el panel) o **automáticamente** por un job programado.
- **Desaprovisionamiento**: al sincronizar, los usuarios que ya no aparecen en el
  directorio (o que Active Directory marca como deshabilitados) se deshabilitan en
  EchoChat y se les revocan las sesiones al instante. Incluye una guarda anti-apagón: si
  el directorio no devuelve usuarios, no se deshabilita a nadie.
- **Roles desde grupos**: con `LDAP_SYNC_ROLES=true`, los grupos (`memberOf`) del usuario
  se traducen a roles de EchoChat según `LDAP_GROUP_ROLE_MAP`.

Variables principales:

| Variable | Descripción |
| --- | --- |
| `LDAP_ENABLED` | Activa la integración |
| `LDAP_URL` | URL del servidor (usar `ldaps://` en producción) |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | Cuenta de servicio (solo lectura) |
| `LDAP_BASE_DN` | Base de búsqueda de usuarios |
| `LDAP_USER_FILTER` | Filtro; `{{username}}` se reemplaza en el login |
| `LDAP_SYNC_ENABLED` / `LDAP_SYNC_CRON` | Sincronización automática y su frecuencia |
| `LDAP_DEPROVISION` | Deshabilitar usuarios ausentes del directorio |
| `LDAP_SYNC_ROLES` / `LDAP_GROUP_ROLE_MAP` | Mapeo de grupos del directorio a roles |

## SSO / OpenID Connect

Inicio de sesión federado con proveedores OIDC como **Azure AD / Microsoft Entra ID**,
**Google Workspace** y **Okta**. EchoChat nunca ve la contraseña del usuario: el proveedor
lo autentica y devuelve una identidad firmada.

- **Flujo seguro**: usa PKCE (`S256`), `state` y `nonce`. El material de la transacción
  viaja en una cookie firmada de corta vida, y el token vuelve al frontend por el
  **fragmento** de la URL (nunca en query string, para no dejarlo en logs).
- **Aprovisionamiento JIT** (*Just-In-Time*): en el primer login por SSO el usuario se crea
  automáticamente con `auth_provider='oidc'` y el rol por defecto (`OIDC_DEFAULT_ROLE`).
- **Estado de cuenta respetado**: si un admin deshabilita a un usuario, queda bloqueado
  aunque el proveedor lo siga autenticando.
- **Multi-proveedor**: en la pantalla de login aparece un botón por cada proveedor
  configurado.

Variables principales:

| Variable | Descripción |
| --- | --- |
| `OIDC_ENABLED` | Activa el SSO |
| `OIDC_PROVIDERS` | Lista de proveedores (ej: `azure,google`) |
| `OIDC_<NOMBRE>_ISSUER` | URL del *issuer* (discovery OIDC) |
| `OIDC_<NOMBRE>_CLIENT_ID` / `_CLIENT_SECRET` | Credenciales de la app en el IdP |
| `OIDC_<NOMBRE>_LABEL` | Texto del botón en el login |
| `OIDC_REDIRECT_BASE` | Base pública del backend para el `redirect_uri` |
| `OIDC_DEFAULT_ROLE` | Rol asignado a los usuarios creados por SSO |

El `redirect_uri` a registrar en el IdP es
`<OIDC_REDIRECT_BASE>/api/auth/sso/<proveedor>/callback`.

## SCIM 2.0

Aprovisionamiento y desaprovisionamiento **automático** que empujan Okta / Azure: dan de
alta, actualizan y dan de baja usuarios antes incluso de que inicien sesión. Cuando RR.HH.
desactiva a un empleado en el IdP, este llama al endpoint SCIM y el acceso se corta al
instante (se le revocan las sesiones).

- **Endpoint base** a registrar en el IdP: `<URL_DEL_BACKEND>/scim/v2`
- **Autenticación**: bearer token estático (`SCIM_TOKEN`), independiente del login de los
  usuarios.
- Los usuarios creados por SCIM quedan con `auth_provider='scim'`.
- La **baja** (`active: false` vía PATCH, o DELETE) suspende la cuenta y revoca sus sesiones.

Operaciones soportadas sobre `/scim/v2/Users`: `GET` (con filtro `userName eq "..."` y
paginación), `POST`, `PUT`, `PATCH` y `DELETE`, más `GET /ServiceProviderConfig`.

Variables:

| Variable | Descripción |
| --- | --- |
| `SCIM_ENABLED` | Activa el endpoint SCIM |
| `SCIM_TOKEN` | Bearer token que presenta el IdP (largo y secreto) |
| `SCIM_DEFAULT_ROLE` | Rol de los usuarios aprovisionados |

## Auditoría

Las sincronizaciones LDAP, los aprovisionamientos por SSO y los cambios de estado quedan
registrados en el [log de auditoría](/docs/admin/auditoria) bajo la categoría `auth`/`admin`
(acciones `admin.ldap_sync`, `user.sso_provision`, entre otras).
