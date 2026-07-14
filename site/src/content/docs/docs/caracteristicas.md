---
title: Características
description: Panorama de todas las funciones de EchoChat con enlaces a cada guía.
---

Panorama de todas las funciones de EchoChat, con enlace a la guía de cada una.

## Mensajería

Mensajes directos y grupales, edición y eliminación con ventana de tiempo (soft delete),
historial de ediciones, reacciones, respuestas en hilo, reenvío, mensajes fijados y
guardados, borradores auto-guardados, búsqueda full-text, recibos de lectura/entrega e
indicadores de escritura en tiempo real. Selector de emojis completo, stickers
personalizados por usuario y GIFs vía Giphy.

Ver [Mensajería](/docs/uso/mensajeria), [Formato enriquecido](/docs/uso/formato) y
[Emojis, stickers y GIFs](/docs/uso/stickers-y-gifs).

## Llamadas

Llamadas de voz y video, 1:1 y grupales, sobre WebRTC punto a punto, con compartir
pantalla, controles de silencio/cámara e historial en el chat.

Ver [Llamadas de voz y video](/docs/llamadas).

## Canales y conversaciones

Conversaciones directas, grupales y canales con categorías (anuncios, departamento,
proyecto, general), canales oficiales y descubribles, modos de acceso (abierto,
solicitud, solo invitación) y roles por miembro.

Ver [Canales](/docs/uso/canales) y [Conceptos](/docs/conceptos).

## Difusiones

Listas de difusión personalizadas con envío masivo sin visibilidad entre destinatarios,
programación, métricas de enviado/recibido/leído y sello de origen en el chat del
destinatario.

Ver [Difusiones](/docs/uso/difusiones).

## Encuestas

Encuestas embebidas en mensajes, con opción única o múltiple, modo anónimo, conteo de
votos en tiempo real y cierre manual por el autor.

Ver [Encuestas](/docs/uso/encuestas).

## Archivos y almacenamiento

Subida de archivos a MinIO (S3-compatible): imágenes, video, audio, documentos y
grabaciones. Descarga mediante URLs prefirmadas con expiración.

:::note[Planificado]
Thumbnails automáticos, deduplicación por SHA256, strip de EXIF y escaneo antivirus
(ver Fase 4 del roadmap).
:::

## Seguridad y autenticación

JWT con access y refresh tokens, autenticación de dos factores (TOTP) con códigos de
respaldo, gestión de sesiones multi-dispositivo, RBAC global y por conversación, Helmet,
rate limiting y CORS configurable.

Ver [Primeros pasos](/docs/uso/primeros-pasos) y [RBAC](/docs/admin/rbac).

## Notificaciones

Bandeja de notificaciones in-app en tiempo real, preferencias por tipo de evento
(mensaje directo, mención, difusión, llamada entrante, solicitudes de canal) y horario
de silencio configurable. Infraestructura de push y email preparada, pendiente de envío
real (ver [Estado del proyecto](/docs/estado)).

Ver [Notificaciones](/docs/uso/notificaciones).

## Usuarios y contactos

Perfiles con departamento, cargo y extensión, presencia en tiempo real, búsqueda de
usuarios, contactos, favoritos y bloqueados.

Ver [Contactos](/docs/uso/contactos).

## Internacionalización y temas

Interfaz en español, inglés y portugués, tema claro/oscuro/sistema, siete colores de
acento y wallpapers personalizables por conversación o por tipo.

Ver [Personalización](/docs/uso/personalizacion).

## Panel de administración

Gestión de usuarios y roles (incluida importación LDAP), configuración del sistema,
auditoría con filtros, estadísticas de almacenamiento y un dashboard de monitoreo del
servidor, base de datos, HTTP y jobs en tiempo real.

Ver [Panel de administración](/docs/admin/panel).

## Plataformas

| Plataforma | Tecnología | Estado |
|------------|-----------|--------|
| **Web** | React 19 + Vite | En desarrollo (`v1.0.0-alpha.4`) |
| **Desktop** (Windows, macOS, Linux) | Electron | Planificado |
| **Mobile** (iOS, Android) | React Native + Expo | Planificado |

Las tres plataformas comparten el mismo backend y la mayor parte de la lógica de negocio
del frontend. Ver [Estado del proyecto](/docs/estado).
