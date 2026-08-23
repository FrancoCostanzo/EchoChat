---
title: Introducción
description: Qué es EchoChat y cómo está organizado el proyecto.
---

**EchoChat** es una plataforma de comunicación interna empresarial completa y moderna,
construida con un stack full-stack JavaScript. Soporta mensajería directa, conversaciones
grupales, canales, videollamadas, compartición de archivos, difusiones (broadcasts) y
mucho más — todo en tiempo real.

Es **open source** bajo licencia [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0) y está
pensado para **autohospedarse**.

## Funciones principales

- **Mensajería**: directos y grupales, edición con historial, reacciones, threads, reenvío,
  búsqueda full-text, mensajes fijados, guardados y borradores auto-guardados.
- **Llamadas**: voz y video (1:1 y grupal) sobre WebRTC, compartir pantalla, historial y
  aviso en el chat. Ver [Llamadas de voz y video](/docs/llamadas).
- **Canales**: categorías, canales oficiales y descubribles, modos de acceso y roles por miembro.
- **Difusiones**: listas de difusión, envío masivo sin visibilidad cruzada, programadas y con
  seguimiento de entrega/lectura.
- **Encuestas**: embebidas en mensajes, anónimas, multi-opción y con conteo en tiempo real.
- **Seguridad**: JWT (access + refresh), 2FA TOTP, RBAC global y por conversación, Helmet,
  rate limiting y CORS.
- **Archivos**: almacenamiento en MinIO (S3) con URLs prefirmadas.
- **i18n y temas**: español, inglés y portugués; claro/oscuro/sistema; 6 colores de acento.

## Plataformas

| Plataforma | Tecnología | Estado |
|------------|-----------|--------|
| **Web** | React 19 + Vite | ✅ En desarrollo (`v1.0.0-alpha.5`) |
| **Desktop** (Windows, macOS, Linux) | Electron | 🔧 Planificado |
| **Mobile** (iOS, Android) | React Native + Expo | 🔧 Planificado |

Las tres plataformas comparten el mismo backend y reutilizan la mayor parte de la lógica de
negocio del frontend.

## Por dónde seguir

- [Instalación (desarrollo)](/docs/instalacion) — levantarlo localmente sin Docker.
- [Despliegue con Docker](/docs/despliegue) — poner EchoChat en producción.
- [Arquitectura](/docs/arquitectura) — cómo se conectan las piezas.
- [Llamadas de voz y video](/docs/llamadas) — cómo funciona la señalización WebRTC.
