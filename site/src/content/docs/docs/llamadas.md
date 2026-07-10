---
title: Llamadas de voz y video
description: Cómo funcionan las llamadas WebRTC 1:1 y grupales en EchoChat.
---

EchoChat soporta llamadas de **voz y video, 1:1 y grupales**, directamente entre
navegadores vía **WebRTC**. El backend solo transporta la señalización (quién llama,
ofertas/respuestas SDP, candidatos ICE); el audio y el video viajan **peer-to-peer**,
sin pasar por el servidor.

## Cómo funciona

- **Malla P2P (mesh)**: cada participante abre una conexión `RTCPeerConnection` directa
  con cada uno de los demás. Con _N_ participantes, cada cliente mantiene _N-1_
  conexiones. Funciona muy bien para grupos pequeños (equipos, reuniones de pocas
  personas); no está pensado para conferencias grandes.
- **Señalización por Socket.IO**: el servidor arma una sala `call:{callId}` por llamada
  y reenvía las ofertas/respuestas SDP y los candidatos ICE entre los participantes
  (eventos `call:start`, `call:accept`, `call:reject`, `call:signal`, `call:leave`,
  `call:media`). Nunca ve ni decodifica el contenido de audio/video.
- **Perfect negotiation**: la renegociación (por ejemplo, encender la cámara a mitad de
  una llamada de voz) se dispara sola sin intervención manual, evitando condiciones de
  carrera cuando ambos lados intentan ofrecer al mismo tiempo.
- **Historial persistente**: cada llamada se guarda en la tabla `calls` con
  `initiated_at`, `answered_at`, `ended_at` y `duration_seconds` (calculado por trigger
  al finalizar). Al colgar se publica un evento en el chat (mensaje de sistema) con el
  resultado — completada, perdida o rechazada — visible tanto en el timeline de la
  conversación como en el historial global.

## Funciones disponibles

- Llamadas de voz y video, 1:1 y grupales.
- Compartir pantalla (reemplaza la pista de video sobre la misma conexión).
- Silenciar micrófono / apagar cámara, con aviso en tiempo real al resto de participantes.
- Aviso de llamada entrante con aceptar/rechazar.
- Registro en el timeline del chat (voz/video, duración, perdida o rechazada) y preview
  en la lista de conversaciones.
- Historial de llamadas por conversación y una vista global (`/calls`) con filtro de
  perdidas y opción de volver a llamar.

## Limitaciones actuales

:::note
Grabación de llamadas y estadísticas de calidad (RTT, jitter, packet loss) están
modeladas en el esquema de base de datos pero **todavía no implementadas** en el
cliente. Ver `docs/ROADMAP.md` en el repositorio.
:::

:::caution
La configuración ICE por defecto solo incluye servidores **STUN públicos**, sin
**TURN**. Esto es suficiente dentro de una intranet o cuando ambos extremos están
detrás de NATs simples, pero **puede fallar** si alguno está detrás de un NAT
simétrico/estricto (típico de redes corporativas restrictivas o llamadas fuera de la
red local). Para ese caso hace falta desplegar un servidor TURN (por ejemplo
[coturn](https://github.com/coturn/coturn)) y agregarlo a la configuración ICE del
frontend.
:::

Por tratarse de una malla P2P, el consumo de ancho de banda y CPU del cliente crece con
el número de participantes — para grupos grandes conviene migrar a un modelo con SFU
(mediasoup, LiveKit, Janus), tal como está previsto en el roadmap.
