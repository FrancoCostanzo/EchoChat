---
title: Primeros pasos
description: Inicio de sesión, registro, 2FA y gestión de sesiones en EchoChat.
---

## Acceder a EchoChat

Abrí la URL de tu instancia (por ejemplo `http://localhost:5173` en desarrollo, o la
URL/IP configurada en `CORS_ORIGIN` en producción) y vas a ver la pantalla de inicio de
sesión.

## Registro e inicio de sesión

- Si el **auto-registro** está habilitado (`allow_registration` en configuración del
  sistema), vas a ver un enlace "Crear cuenta" en la pantalla de login.
- Si está deshabilitado, un administrador debe crear tu usuario desde
  [Usuarios](/docs/admin/usuarios) (o importarlo desde LDAP si está configurado).
- El login pide usuario y contraseña; si tu cuenta tiene 2FA activo, se te pide el
  segundo paso antes de entrar.

## Autenticación de dos factores (2FA)

EchoChat soporta 2FA por **TOTP** (apps como Google Authenticator, Authy, 1Password):

1. Activalo desde **Configuración → Seguridad**: escaneás un código QR y confirmás con
   un código de 6 dígitos.
2. Al activarlo se generan **códigos de respaldo** de un solo uso, para entrar si perdés
   el dispositivo con la app de 2FA. Guardalos en un lugar seguro; podés regenerarlos
   desde el mismo panel.
3. En cada login posterior, después de usuario/contraseña se te pide el código TOTP (o
   un código de respaldo como alternativa).

## Sesiones multi-dispositivo

Podés estar conectado desde varios dispositivos a la vez. Desde **Configuración →
Seguridad** podés ver la lista de sesiones activas (con su navegador/dispositivo) y
cerrar cualquiera de ellas de forma remota, o cerrar todas las demás sesiones al cambiar
tu contraseña.

## Recuperación de contraseña

Actualmente EchoChat **no tiene un flujo de autoservicio** para usuarios que olvidaron
su contraseña estando deslogueados. Si perdiste tu contraseña, un administrador puede
restablecerla desde [Usuarios](/docs/admin/usuarios). Estando logueado, podés cambiarla
en cualquier momento desde **Configuración → Seguridad**.

## Navegación principal

La interfaz sigue el diseño **Lienzo Espacial** (ver [Spatial Canvas](/docs/desarrollo/spatial-canvas)):

- **Dock lateral** (izquierda): accesos directos a chat, contactos, llamadas, canales,
  difusiones, guardados, notificaciones, administración (si tenés permisos) y ajustes.
- **Barra lateral de conversaciones**: lista de chats, grupos y canales, con búsqueda.
- **Panel de chat**: la conversación activa, con composer flotante en la parte inferior.

## Atajos útiles

| Atajo | Acción |
|-------|--------|
| `Ctrl` / `Cmd` + `K` | Abrir la paleta de comandos (buscar y navegar rápido) |
| `Ctrl` / `Cmd` + `\` | Mostrar/ocultar la barra lateral de conversaciones |
| `Ctrl` / `Cmd` + `B` | Negrita en el mensaje que estás escribiendo |
| `Ctrl` / `Cmd` + `I` | Cursiva |
| `Ctrl` / `Cmd` + `E` | Código inline |
| `Enter` | Enviar mensaje |
| `Shift` + `Enter` | Nueva línea sin enviar |
