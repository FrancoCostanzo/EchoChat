---
title: Monitoreo
description: Dashboard de monitoreo de servidor, base de datos, HTTP, cron y tendencias.
---

Requiere cualquier permiso `admin.*` (o el rol `super_admin`).

## Acceder al monitoreo

Desde **Administración → Monitoreo** (`/admin/monitoring`) se ve un dashboard en vivo del
estado técnico de la instancia, organizado en pestañas.

## Estado general

Una barra superior muestra chips de estado global, del servidor y de la base de datos:
**healthy**, **degraded** o **unhealthy**, calculados según umbrales de heap, memoria,
CPU, latencia de base de datos y saturación del pool de conexiones. También se ven
estadísticas rápidas: uptime, ocupación del pool, % de heap y hora de la última
actualización.

## Servidor

Pestaña **Servidor**: modelo y núcleos de CPU, memoria del sistema operativo, load
average, hostname, versión de Node.js y de la app, PID; además heap, memoria RSS y CPU
del propio proceso Node.

## Base de datos

Pestaña **Base de datos**: estado del pool de PostgreSQL (conexiones totales, ocupadas,
libres, en espera), latencia de una consulta de referencia, tamaño de la base en MB,
consultas por segundo y una tabla de conexiones activas (`pg_stat_activity`).

## HTTP y rutas

Pestaña **HTTP**: total de peticiones, peticiones por minuto, tasa de error, errores
5xx; latencia p50/p95/p99 por ruta; ranking de rutas más lentas y lista de errores 5xx
recientes.

## Cron y Socket.IO

Pestaña **Cron**: sockets activos y usuarios únicos conectados por Socket.IO; estado del
worker de cron (`enabled`, `running`, `ready`); y una tabla con la última ejecución y
resultado de cada job (`presence-timeout`, `presigned-cleanup`, `scheduled-broadcasts`,
`monitoring-snapshot`).

## Tendencias históricas

Pestaña **Tendencias**: gráficos históricos (heap %, memoria del sistema %, CPU %,
latencia de base de datos, consultas por segundo, peticiones por minuto, tasa de error)
armados a partir de snapshots guardados cada 5 minutos por el job `monitoring-snapshot`,
con selección de rango (`1h`, `6h`, `24h`, `7d`).

## Intervalo de actualización

El dashboard se puede refrescar manualmente o configurar para actualizarse solo cada
10, 30 o 60 segundos.

## Interpretar alertas

- **healthy**: todos los indicadores dentro de umbral normal.
- **degraded**: algún indicador (heap, CPU, latencia de BD, saturación del pool) está
  elevado pero el sistema sigue funcionando.
- **unhealthy**: al menos un indicador crítico está fuera de rango — revisá primero la
  pestaña de base de datos (latencia/pool) y la de servidor (memoria/CPU), y cruzalo con
  [Troubleshooting](/docs/despliegue/troubleshooting) si corresponde.
