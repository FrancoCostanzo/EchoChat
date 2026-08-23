---
title: Red y TURN
description: Configuración de red, STUN y TURN para llamadas WebRTC fuera de la intranet.
---

Las llamadas de EchoChat son **WebRTC peer-to-peer**: el backend solo hace de servidor de
señalización por Socket.IO, el audio/video viaja directo entre navegadores. Esta página
cubre qué necesitás en la red para que esas conexiones directas se establezcan. Ver
también [Llamadas de voz y video](/docs/llamadas).

## Arquitectura de red en producción

```
Navegador A ⇄ (ICE / STUN / TURN) ⇄ Navegador B
     ↕ Socket.IO (señalización SDP/ICE)      ↕
                    Backend
```

El servidor de EchoChat nunca ve el contenido de audio/video — solo coordina cómo los
dos navegadores se encuentran.

## STUN por defecto

La configuración ICE por defecto usa **servidores STUN públicos**, suficiente cuando
ambos extremos están detrás de NATs simples o dentro de la misma intranet.

## Cuándo necesitás TURN

Un NAT simétrico o estricto (común en redes corporativas restrictivas, o llamadas entre
una red interna y usuarios externos) puede impedir que STUN por sí solo establezca la
conexión directa. En ese caso hace falta un servidor **TURN**, que retransmite el
tráfico de medios cuando la conexión P2P directa no es posible.

:::caution
Sin TURN configurado, las llamadas que fallan por NAT estricto simplemente no conectan
(se quedan "conectando" o se cortan) — no hay un mensaje de error específico en la UI
hoy.
:::

## Desplegar coturn

[coturn](https://github.com/coturn/coturn) es la implementación TURN/STUN open source más
usada. Un despliegue mínimo:

```bash
docker run -d --network=host coturn/coturn \
  -n --log-file=stdout \
  --realm=echochat.miempresa.com \
  --user=echochat:password_segura \
  --external-ip=IP_PUBLICA_DEL_SERVIDOR
```

Necesita una IP pública alcanzable y, típicamente, el puerto `3478` (STUN/TURN) y un
rango de puertos UDP para el relay de medios.

## Configuración ICE en el frontend

El listado de servidores ICE (STUN/TURN) se pasa a `RTCPeerConnection` al crear la
conexión. Para agregar un servidor TURN propio, hay que sumarlo a esa configuración en
el código del cliente (`frontend/src/stores/callStore.ts`) — hoy es un cambio de código,
no una variable de entorno.

## Firewall y NAT

- Abrí el puerto TURN (`3478/udp` y `/tcp` típicamente, más el rango de relay) en el
  firewall del servidor donde corra coturn.
- Si EchoChat corre detrás de un proxy/NAT, asegurate de que el servidor TURN tenga una
  IP pública real (`--external-ip`), no una IP privada.

## Verificación

Para confirmar si el problema es de red antes de desplegar TURN, probá una llamada entre
dos redes distintas (por ejemplo, tu intranet y una conexión móvil externa). Si conecta
dentro de la misma red pero falla entre redes distintas, es una señal clara de que
necesitás TURN.
