# 📈 EchoChat — Plan de escalado horizontal

> Objetivo: pasar de **una instancia** del backend a **N instancias** detrás de un
> balanceador, sin cambiar de tecnología. El stack (Node + Express + Socket.IO +
> PostgreSQL) aguanta escala empresarial; lo que hoy lo impide es el **estado en
> memoria del proceso**, no el runtime.
>
> Esfuerzo total aprox: **9-14 días-dev** (Fases 1-4). La Fase 5 (TypeScript) es
> independiente y no aporta capacidad.

## Estado de avance

| Fase | Tema | Esfuerzo | Estado |
|------|------|----------|--------|
| 1 | Redis + adapter de Socket.IO | M (2-3d) | ✅ Hecho |
| 2 | Estado compartido (presencia, rate limit, métricas) | M (2-3d) | ✅ Hecho |
| 3 | Jobs y migraciones seguras en cluster | S (1-2d) | ✅ Hecho |
| 4 | Despliegue horizontal (compose + nginx) | M (2-3d) | ✅ Hecho |
| 5 | TypeScript incremental (opcional) | XL (semanas) | ⬜ Pendiente |

Orden obligatorio: **1 → 2 → 3 → 4**. Escalar a N instancias antes de cerrar la
Fase 3 provoca **difusiones programadas enviadas N veces**.

---

## Diagnóstico — por qué hoy no escala

Todos los bloqueantes son estado que vive en el proceso y que una segunda
instancia no ve.

| # | Dónde | Problema | Fase |
|---|---|---|---|
| 1 | `src/socket.js` | Sin adapter: `io.emit()` / `io.to(room)` solo alcanzan sockets del mismo proceso. Dos usuarios en instancias distintas **no se ven los mensajes**. | 1 |
| 2 | `src/socket.js` (`call:accept`) | `io.sockets.adapter.rooms.get()` + `io.sockets.sockets.get()` son API **local-only**: no funcionan ni con el adapter Redis puesto. | 1 |
| 3 | `src/socket.js` (`scheduleOffline`) | Chequea sockets locales → marca `offline` a un usuario conectado en otra instancia. | 1 |
| 4 | `src/config/presenceStore.js` | `autoAwayUsers` en memoria: el job corre en la instancia A y el heartbeat llega a la B → el usuario queda `away` permanentemente. | 2 |
| 5 | `src/app.js` (rate limit) | `express-rate-limit` con `MemoryStore` → el límite efectivo se multiplica por N. | 2 |
| 6 | `src/config/socketStore.js`, `src/utils/metricsRegistry.js`, `src/utils/cronJobStatus.js` | Métricas en memoria: el panel de monitoreo muestra los datos de **una** instancia al azar. | 2 |
| 7 | `src/jobs/index.js` | Los 5 cron corren en cada instancia. `scheduledBroadcasts` duplicado = difusiones enviadas N veces. | 3 |
| 8 | `src/server.js` (`setup()`) | Las migraciones corren en cada arranque → race si N instancias arrancan a la vez. | 3 |
| 9 | `docker-compose.yml` | Sin Redis; `container_name` fijo impide `--scale`; nginx hace round-robin sin sticky sessions. | 4 |
| 10 | `src/socket.js` (`messages:delivered`) | `appendFileSync` a `delivery-debug.log` en el hot path: resto de debug que bloquea el event loop. | 2 |

---

## FASE 1 — Redis + adapter de Socket.IO

El desbloqueo real: hace que las salas (`user:*`, `conv:*`, `call:*`) sean
visibles entre instancias.

| # | Tarea | Archivos | Estado |
|---|---|---|---|
| 1.1 | Dependencias `redis` + `@socket.io/redis-adapter`. | `backend/package.json` | ✅ |
| 1.2 | Cliente Redis compartido con reconexión y logging. | `src/config/redis.js` (nuevo) | ✅ |
| 1.3 | `REDIS_URL` en config y `.env.example`. | `src/config/index.js` | ✅ |
| 1.4 | Montar el adapter en `initSocket()` antes de aceptar conexiones. | `src/socket.js` | ✅ |
| 1.5 | `call:accept`: reemplazar la API local por `await io.in(room).fetchSockets()`. | `src/socket.js` | ✅ |
| 1.6 | `scheduleOffline`: el `fetchSockets()` ya pasa a ser cluster-aware con el adapter. | `src/socket.js` | ✅ (sin cambios) |
| 1.7 | Servicio `redis` en compose (perfil `redis`, como postgres/minio). | `docker-compose.yml` | ✅ |

**`socket.data` en vez de props sueltas:** `fetchSockets()` sólo serializa
`socket.data` al consultar sockets de otras instancias; un `socket.userId`
asignado directo no viaja. Por eso el middleware de auth ahora escribe también
`socket.data.userId`.

**Corte de reintentos al arrancar:** `client.connect()` de node-redis **no
rechaza** si Redis no responde — reintenta indefinidamente y el proceso se
quedaría colgado sin llegar a `server.listen()`. `createRedisClient()` corta a
los 5 intentos (~3 s) *sólo durante la conexión inicial*; una vez conectado,
reintenta para siempre para sobrevivir a caídas pasajeras.

**Degradado sin Redis:** si `REDIS_URL` no está definido, el backend arranca sin
adapter y funciona igual que hoy (una sola instancia). Redis no es obligatorio
para desarrollo local.

> Se adelantó de la Fase 2 la tarea 2.5 (quitar el logging a `delivery-debug.log`):
> el bloque hacía un `fetchSockets()` por cada acuse de recibo, que con el adapter
> pasa a ser una ida y vuelta por red entre instancias en el hot path.

**Redis en desarrollo local:** el servicio `redis` del compose usa `expose`, así
que sólo es visible dentro de la red de compose. Si corre el backend nativo
(`npm run dev`), levante un Redis suelto con el puerto publicado:

```bash
docker run -d --name echochat-redis-dev --restart unless-stopped -p 6379:6379 redis:7-alpine
```

y ponga `REDIS_URL=redis://localhost:6379` en `backend/.env`. Ojo: con esa
variable definida el backend **no arranca** si Redis no responde; para trabajar
sin Redis, deje la variable vacía o coméntela.

**Verificación (hecha):** dos servidores Socket.IO en puertos distintos contra el
mismo Redis —

- una emisión a `conv:*` desde la instancia A llega al cliente conectado a la B;
- `fetchSockets()` desde B lista también el socket de A con su `data.userId`
  (lo que necesita `call:accept`).

---

## FASE 2 — Estado compartido

| # | Tarea | Archivos | Estado |
|---|---|---|---|
| 2.1 | `autoAwayUsers` → claves en Redis con TTL (fallback en memoria si no hay Redis). | `src/config/presenceStore.js` | ✅ |
| 2.2 | Rate limit con `rate-limit-redis`. | `src/config/rateLimitStore.js` (nuevo), `src/app.js`, `src/routes/scim.routes.js` | ✅ |
| 2.3 | Métricas de sockets vía `fetchSockets()` del adapter en vez del `Map` local. | `src/config/socketStore.js`, `src/services/monitoring.service.js` | ✅ |
| 2.4 | Métricas HTTP y historial de cron agregados entre instancias. | `src/utils/clusterMetrics.js` (nuevo), `src/utils/metricsRegistry.js`, `src/services/monitoring.service.js`, `src/socket.js` | ✅ |
| 2.5 | ~~Quitar el logging de debug a `delivery-debug.log`.~~ Adelantado a la Fase 1. | `src/socket.js` | ✅ |

**Cliente de comandos aparte:** los clientes de pub/sub quedan en modo suscriptor
y no pueden ejecutar otros comandos, así que `getRedisClient()` mantiene un
tercer cliente (perezoso y cacheado) para presencia y rate limit.

**La marca de auto-away ahora sobrevive al reinicio.** Antes vivía en memoria y
un reinicio la olvidaba (el usuario quedaba como si hubiera elegido *away* a
mano). El TTL de 24 h evita que las claves se acumulen.

**Métricas del cluster (2.4).** `metricsRegistry` y `cronJobStatus` viven en
memoria de cada proceso. Con la Fase 3 eso pasó de impreciso a **incorrecto**:
como cada corrida de cron la ejecuta una sola instancia, consultar el panel
contra cualquier otra mostraba el historial de jobs **vacío**.

`utils/clusterMetrics.js` lo resuelve con `serverSideEmitWithAck` del adapter:
al pedir el panel, la instancia consultada les pregunta a las demás y combina
las respuestas. No hace falta ni claves extra en Redis ni un job que publique
snapshots, y los datos son del momento de la consulta.

- **Contadores** (requests, 4xx/5xx, queries) → se suman.
- **Percentiles** → se recalculan sobre la **unión de las muestras**; promediar
  el p95 de cada instancia daría un número que no corresponde a ninguna petición
  real.
- **Historial de cron** → unión, y ante el mismo job gana la corrida más reciente.
- **`server`/`process`/`system`** (memoria, CPU, uptime) siguen siendo de la
  instancia consultada, que es lo correcto: son datos de ese proceso.

`serverSideEmitWithAck` está en el `Server`, no en el `BroadcastOperator` que
devuelve `io.timeout()`, y no acepta timeout propio: lleva una guarda de 1,5 s
para que una instancia que no contesta no cuelgue el panel. Si no hay otras
instancias (o no responden), devuelve las métricas locales — el comportamiento
de siempre.

La respuesta suma el campo `instancias`. Es aditivo: el frontend actual sigue
funcionando igual, aunque todavía no lo muestra en pantalla.

**Verificación (hecha):**

- **Presencia:** dos procesos distintos — A hace `markAutoAway()`, B lee
  `isAutoAway() → true` y tras `clearAutoAway()` → `false`. TTL confirmado en
  Redis (86398 s).
- **Rate limit:** 3 requests a `/api/health` dejan `rl:global:::/56 = 3` en
  Redis, es decir un contador compartido en vez de uno por instancia.
- **Métricas:** una instancia real (backend con `initSocket`) sin sockets
  propios reporta `{activeSockets: 3, uniqueUsers: 2}` de los 3 sockets (2
  usuarios) conectados a otra instancia.

---

## FASE 3 — Jobs y migraciones seguras en cluster

| # | Tarea | Archivos | Estado |
|---|---|---|---|
| 3.1 | Lock Redis con TTL por corrida: sólo una instancia ejecuta cada tick. | `src/jobs/index.js` | ✅ |
| 3.2 | Flag `RUN_JOBS=false` para instancias que sólo sirven tráfico. | `src/config/index.js`, `src/jobs/index.js` | ✅ |
| 3.3 | `pg_advisory_lock` alrededor de `setup()` para serializar migraciones. | `src/config/migrate.js` | ✅ |
| 3.4 | Registrar qué instancia ejecutó cada corrida. | `src/utils/cronJobStatus.js` | ✅ |

**Lock por corrida, no líder permanente.** No hay una instancia "líder" fija: en
cada tick gana la primera que consigue `SET jobs:lock:{job} NX EX 30`. Es más
simple que un líder con renovación de lease y el relevo es automático — si la
instancia que venía ejecutando se cae, la siguiente corrida la toma otra sin
esperar a que expire ningún lease.

**El lock no se libera al terminar,** a propósito: soltarlo apenas termina el job
dejaría que otra instancia tomara el mismo tick. Expira solo a los 30 s, mucho
antes del siguiente tick del job más frecuente (1 minuto).

**Si Redis falla, no se ejecuta.** `claimRun()` devuelve `false` ante un error:
saltear un tick se recupera en el siguiente, pero una difusión duplicada le
llega dos veces al usuario y eso no se deshace.

**Verificación (hecha):**

- **Lock:** 3 instancias compitiendo por el mismo tick → gana 1; segundo intento
  dentro de la ventana → 0; con el lock expirado → vuelve a ganar 1.
- **Migraciones:** `pg_try_advisory_lock` desde otra sesión devuelve `false`
  mientras la primera lo tiene; dos `setup()` concurrentes terminan sin errores
  y no dejan locks colgados.
- **`RUN_JOBS=false`:** la instancia arranca y sirve tráfico sin programar ningún job.
- **Dos backends reales** (puertos 3000 y 3001, mismo Redis y misma BD): al
  disparar el tick del minuto, la instancia A se quedó con los locks de
  `presence-timeout` y `scheduled-broadcasts`, y la B registró las dos corridas
  como "tomada por otra instancia". Antes de la Fase 3, ambas las habrían
  ejecutado.

---

## FASE 4 — Despliegue horizontal

| # | Tarea | Archivos | Estado |
|---|---|---|---|
| 4.1 | Quitar `container_name` del backend y agregar `deploy.replicas`. | `docker-compose.yml`, `.env.example` | ✅ |
| 4.2 | Que nginx reparta entre réplicas (re-resolución DNS). | `frontend/nginx/default.conf.template` | ✅ |
| 4.3 | Apagado ordenado: cerrar `io` y drenar antes de Redis y `pool.end()`. | `src/server.js`, `src/socket.js` | ✅ |
| 4.4 | Healthcheck que informe el estado de Redis. | `src/app.js` | ✅ |
| 4.5 | Documentar el despliegue multi-instancia. | `README.md` | ✅ |

### Por qué NO hay `ip_hash`

El plan original decía "upstream con `ip_hash`", pero no se puede expresar con
réplicas dinámicas: `upstream` exige una lista fija de servidores y con
`deploy.replicas` no se conocen los hostnames de antemano. El problema real era
otro y más grave: `proxy_pass http://backend:3000` resuelve el DNS **una sola
vez al arrancar**, así que nginx se queda pegado a una réplica y las demás no
reciben nada. Se resolvió pasando el destino por una variable (`set
$echochat_backend`) más un `resolver`, que fuerza a re-resolver y repartir.

Eso deja el reparto sin sticky sessions, y está bien porque **el cliente pide
WebSocket primero**: una vez establecida, la conexión es una sola y persistente,
y no importa qué réplica la atienda. El fallback a long-polling sí necesitaría
sticky (son muchos requests HTTP que deben caer siempre en la misma instancia).
Si su red bloquea WebSocket y necesita ese fallback, hace falta un balanceador
con sesiones pegajosas (HAProxy, Traefik, nginx Plus o el ingress de Kubernetes)
en lugar de este nginx.

### El healthcheck no falla por Redis

`/api/health` informa `redis: ok | unavailable | disabled`, pero sólo la BD
decide el código HTTP. Si un parpadeo de Redis marcara "unhealthy", **todas** las
instancias caerían a la vez y el orquestador las reiniciaría en cascada.

**Verificación (hecha):**

- **nginx:** el template renderizado en el contenedor real da
  `set $echochat_backend "backend:3000"` y `proxy_pass http://$echochat_backend`
  en `/api` y `/socket.io`; `nginx -t` pasa.
- **Compose:** con `BACKEND_REPLICAS=3` resuelve `replicas: 3`, el backend es el
  único servicio sin `container_name` y `REDIS_URL` llega como `redis://redis:6379`.
- **Apagado:** `closeSocket()` libera el puerto en 3 ms (deja de aceptar
  conexiones) y es idempotente si se llama dos veces.
- **Health:** con Redis → `{"status":"ok","db":"ok","redis":"ok"}`; sin
  `REDIS_URL` → `redis: "disabled"` y sigue respondiendo 200.

### Prueba de humo con 3 réplicas (hecha)

Stack completo levantado con `BACKEND_REPLICAS=3` (`docker compose up -d --build`),
entrando por nginx como lo haría un navegador:

- **Migraciones:** `backend-2` aplicó el schema base y creó el admin; `backend-1`
  y `backend-3` esperaron el advisory lock y encontraron todo hecho. Sin errores
  de objetos duplicados ni admin doble.
- **Reparto de nginx:** 21 requests → 11 / 5 / 6 entre las tres réplicas.
- **Mensaje entre instancias:** ana conectada a `backend-1`, beto a `backend-3`,
  y el `POST /api/messages` hecho contra `backend-2` → beto lo recibió.
- **Presencia entre instancias:** ana cambia a `busy` en `backend-1` → beto lo ve
  desde `backend-3`.
- **Cron:** los locks de `presence-timeout` y `scheduled-broadcasts` quedaron los
  dos en `backend-2`; las otras dos réplicas no ejecutaron nada.
- **Panel agregado:** `instancias: 3`, `http.totalRequests: 40` sumando las tres,
  y el historial de cron mostrando corridas de **dos** instancias distintas
  (justo el caso que antes de la tarea 2.4 aparecía vacío).

> El fallback a long-polling sigue sin probarse: haría falta un balanceador con
> sticky sessions, que es la limitación ya documentada más arriba.

---

## FASE 5 — TypeScript incremental (opcional)

No aporta capacidad de escala: aporta mantenibilidad en un backend de ~11.500
líneas. Se puede hacer en cualquier momento, después de las fases 1-4.

Estrategia sugerida (sin big-bang): `allowJs: true` + `checkJs` progresivo.

1. `dtos/` + `models/` + `config/` — superficie chica, tipos que se reutilizan.
2. `services/` — donde los tipos más rinden.
3. `repositories/` — al final: mucho SQL, poco tipo real que ganar.

---

## Referencias

- `AGENTS.md` — convenciones del proyecto
- `docs/ROADMAP.md` — funcionalidades planificadas
- `README.md` — setup y despliegue Docker
