# 🔷 EchoChat — Plan de migración a TypeScript

> Alcance: **backend** (`backend/src`). El frontend se trata al final, como
> decisión aparte.
>
> Esfuerzo total estimado: **22-31 días-dev**. No aporta capacidad de escala
> (eso lo cubre `docs/SCALING.md`); aporta que los errores de forma de datos
> aparezcan al escribir en vez de en producción.

## Punto de partida (medido, no estimado)

| Capa | Archivos | Líneas | Dificultad de tipar |
|------|---------:|-------:|---------------------|
| `services/` | 20 | 3.965 | 🔴 Alta — lógica de negocio, muchos objetos anónimos |
| `repositories/` | 22 | 2.974 | 🟡 Media — mecánica, pero necesita los tipos de fila |
| `controllers/` | 18 | 1.125 | 🟢 Baja — `req`/`res` tipados por `@types/express` |
| `config/` | 9 | 827 | 🟡 Media — `config` es un objeto grande sin forma declarada |
| `utils/` | 8 | 642 | 🟢 Baja |
| raíz (`app`, `server`, `socket`) | 3 | 581 | 🔴 Alta — `socket.js` concentra los ciclos |
| `dtos/` | 15 | 472 | 🟡 Media — Joi no infiere tipos solo |
| `routes/` | 18 | 468 | 🟢 Baja |
| `models/` | 11 | 464 | 🟢 Baja — y es la capa de mayor retorno |
| `jobs/` | 6 | 210 | 🟢 Baja |
| `middlewares/` | 7 | 207 | 🟡 Media — extienden `Request` con `req.user` |
| `games/` | 3 | 109 | 🟢 Trivial — funciones puras |
| `errors/` | 2 | 60 | 🟢 Trivial |
| `cli/` | 1 | 27 | 🟢 Trivial |
| **Total** | **143** | **12.131** | |

Otros datos que condicionan el plan:

- **0 tests.** `npm test` es `exit 1`.
- **0 anotaciones de tipo.** Ni un `@param {}` de JSDoc en todo el backend.
- **0 herramientas.** No hay ESLint, Prettier, `tsconfig` ni `jsconfig`.
- **110 `require()` perezosos dentro de funciones**, repartidos en 11 archivos:
  son dependencias circulares disfrazadas.
- **55 singletons** del tipo `module.exports = new XService()`.
- **39 tablas** en el schema base + 13 migraciones.
- Node 22, Express 4, `pg` 8, Joi 18, CommonJS en todo el proyecto.

---

## La restricción que manda: no hay tests

Sin una sola prueba automatizada, **cualquier reescritura es a ciegas**. Eso
descarta el enfoque habitual de "renombrar todo a `.ts` y arreglar hasta que
compile": el compilador confirma que los tipos cierran, no que el programa
siga haciendo lo mismo.

De ahí sale la decisión central del plan: **separar el chequeo de la
transformación**.

1. Primero se **chequea el JavaScript actual sin tocarlo** (`checkJs` +
   `noEmit`). El código que corre en producción sigue siendo byte por byte el
   mismo, y sin embargo ya empiezan a aparecer errores reales.
2. Recién después se **renombran archivos a `.ts`**, capa por capa, cada una
   verificable a mano en un rato.

Si en algún momento hay que abandonar, la etapa 1 se sostiene sola.

---

## FASE 0 — Herramientas y red de seguridad (1 día)

| # | Tarea |
|---|-------|
| 0.1 | `npm i -D typescript @types/node @types/express@4 @types/pg @types/jsonwebtoken @types/bcrypt @types/cors @types/qrcode tsx` |
| 0.2 | `tsconfig.json` con `allowJs`, `checkJs: false`, `noEmit: true` (ver abajo) |
| 0.3 | Script `"typecheck": "tsc --noEmit"` en `package.json` |
| 0.4 | Correr `npm run typecheck` y **anotar el número de errores como línea base** |

```jsonc
// backend/tsconfig.json — punto de partida deliberadamente flojo
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",        // el proyecto entero es CommonJS
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "allowJs": true,             // deja convivir .js y .ts
    "checkJs": false,            // se activa archivo por archivo con // @ts-check
    "noEmit": true,              // etapa 1: sólo chequear, no compilar
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": false,             // se endurece al final (Fase 8)
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

> `strict: false` al principio es a propósito. Arrancar en `strict` sobre 12.000
> líneas sin anotar genera miles de errores que no se pueden priorizar.

---

## FASE 1 — Romper los `require()` circulares (2-3 días) ⚠️

**Esta fase es la más riesgosa y la única verdaderamente bloqueante.**

Hoy hay 110 `require()` dentro de funciones. No son un capricho de estilo: son
la forma de esquivar un ciclo. El propio `socket.js` lo documenta:

```js
// NOTE: services & repositories are lazy-loaded inside functions to avoid
// a circular dependency (message.service → socket → services → message.service).
```

En JavaScript esto funciona por accidente del orden de ejecución. En TypeScript
cada `require()` dentro de una función devuelve `any` salvo que se lo tipe a
mano, con lo que **el ciclo se convierte en un agujero de tipos que atraviesa
justo la capa de negocio** — los servicios, que son la mitad del código.

Archivos afectados: `app.js`, `socket.js`, `config/socketStore.js`,
`controllers/auth.controller.js`, `jobs/index.js`, `jobs/presenceTimeout.job.js`,
`services/admin.service.js`, `services/message.service.js`,
`services/monitoring.service.js`, `services/scim.service.js`,
`utils/clusterMetrics.js`.

El ciclo real es siempre el mismo: **los servicios necesitan emitir por
Socket.IO, y Socket.IO necesita a los servicios**. Dos salidas:

| Opción | Cómo | Costo | Riesgo |
|---|---|---|---|
| **A. Inyectar el emisor** | Los servicios reciben un `emitter` con la interfaz mínima (`toRoom`, `toUser`) en vez de importar `socket.js`. | Alto | Toca los 20 servicios |
| **B. Bus de eventos** | Los servicios publican en un `EventEmitter` de `config/`; `socket.js` se suscribe. Nadie importa a nadie. | Medio | Contenido en un módulo nuevo |

**Recomiendo B.** Invierte la dependencia sin reescribir los servicios: donde
hoy dice `getIO().to(...).emit(...)` pasa a decir `bus.emit(...)`, que es un
cambio mecánico y revisable línea por línea. Y `socket.js` queda como el único
lugar que conoce Socket.IO, que es lo que siempre debió ser.

> Esta fase **conviene hacerla aunque nunca se migre a TypeScript**. Los ciclos
> son una fuente latente de bugs de orden de carga, y ya obligaron a poner
> `require()` perezosos en 11 archivos.

Verificación: como no hay tests, la red es la prueba de humo de
`docs/SCALING.md` (login, mensaje entre instancias, presencia, jobs) más un
arranque limpio del backend.

---

## FASE 2 — Tipos del dominio generados desde el schema (1-2 días)

39 tablas escritas a mano son 39 oportunidades de que el tipo y la columna se
desincronicen. Se generan desde la base real:

```bash
npm i -D kysely kysely-codegen
npx kysely-codegen --dialect postgres --url "$DATABASE_URL" --out-file src/types/db.d.ts
```

Sale un `db.d.ts` con las columnas **en `snake_case`, que es como vienen las
filas de `pg`** — sin inventar un mapeo a `camelCase` que hoy no existe.

Se regenera como parte del flujo de migraciones: cambiar una columna y no
regenerar rompe el `typecheck`, que es justo lo que se quiere.

> **Corrección a lo que decía `docs/SCALING.md`:** ahí sugerí dejar
> `repositories/` para el final "porque hay mucho SQL y poco tipo que ganar".
> Con los tipos generados es al revés: los tipos de fila son el **cimiento** del
> que dependen servicios, modelos y controladores. Van temprano.

---

## FASES 3-7 — Migración por capas

Orden de abajo hacia arriba: cada capa se migra cuando sus dependencias ya
están tipadas, para no tener que inventar tipos provisorios.

### Fase 3 — Base: `errors` + `config` + `utils` + `models` (2-3 días · ~2.000 líneas)

- `errors/` (60 líneas) primero: las clases de error aparecen en todas las capas.
- `config/index.js` → `config.ts` con una `interface AppConfig` explícita. Es un
  objeto de ~150 líneas leído desde `process.env`; declararlo documenta de una
  vez qué configuración existe.
- `models/` es **la capa de mayor retorno de todo el plan**: los
  `toXxxResponse()` definen el contrato de la API. Tiparlos produce los tipos
  que después puede consumir el frontend.

### Fase 4 — `dtos` + `repositories` (4-5 días · ~3.450 líneas)

Joi 18 no infiere tipos. En vez de sumar un generador, se declara el tipo y se
ata el esquema con el genérico de Joi, que verifica que no se desfasen:

```ts
export interface LoginRequest {
  username: string;
  password: string;
  device_name?: string | null;
  device_type?: 'web' | 'desktop' | 'mobile' | 'api';
}

export const loginDto = Joi.object<LoginRequest>({ /* ... */ });
```

Son 15 archivos y 472 líneas: barato, y deja el DTO como fuente única de verdad.

Con eso más los tipos de la Fase 2, los repositorios se anotan casi mecánicamente:

```ts
async findByUsername(username: string): Promise<Users | null> {
  const { rows } = await this.query<Users>(/* ... */);
  return rows[0] ?? null;
}
```

`base.repository` se migra primero: es del que heredan los 21 restantes.

### Fase 5 — `services` (5-7 días · 3.965 líneas) 🔴

La fase más larga y la de mayor valor. Requisito previo: **Fase 1 terminada**;
si quedan `require()` circulares, acá todo degrada a `any`.

Los 55 singletons `module.exports = new XService()` se convierten sin drama a
`export default new XService()`, con `esModuleInterop` cubriendo el interop
mientras queden archivos `.js` importándolos.

Recomendación: un servicio por commit. Son 20 unidades independientes y así cada
una se puede probar y revertir sola.

### Fase 6 — `controllers` + `routes` + `middlewares` (3-4 días · ~1.800 líneas)

La pieza no obvia es `req.user`, que hoy inyecta el middleware de auth. Se
declara una vez:

```ts
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      file?: Express.Multer.File;
    }
  }
}
```

Con eso los 18 controladores quedan casi gratis.

### Fase 7 — `jobs` + raíz (`app`, `server`, `socket`) (2-3 días · ~790 líneas)

Se deja para el final porque `socket.js` es el nudo de todo. Si la Fase 1 se
hizo bien, para acá ya es un archivo normal.

Los eventos de Socket.IO se tipan con los genéricos del `Server`, que convierten
en error de compilación un `emit` con el payload equivocado:

```ts
interface ServerToClient {
  'message:new': (msg: MessageResponse) => void;
  'presence:changed': (p: { userId: string; presence: Presence }) => void;
}
interface SocketData { userId: string; }   // el que ya usa fetchSockets()
```

---

## FASE 8 — Endurecer (2-3 días)

Con todo en `.ts`, subir el listón de a un flag por vez, arreglando entre uno y
otro. En este orden, del más barato al más caro:

1. `strictNullChecks` — el de mayor retorno: `rows[0]` puede ser `undefined`.
2. `strictFunctionTypes`, `strictBindCallApply`
3. `noImplicitThis` — barato, con 58 clases en juego
4. `noImplicitAny` — el más caro, se deja último
5. `strict: true` como estado final

Sumar `typescript-eslint` recién acá: antes sólo aporta ruido.

---

## Build y despliegue

| Entorno | Hoy | Después |
|---|---|---|
| Desarrollo | `nodemon src/server.js` | `tsx watch src/server.ts` |
| Producción | `node src/server.js` | `tsc` → `node dist/server.js` |
| Docker | copia `src/` | build multi-etapa: compila y copia `dist/` |

En la Fase 7 se cambia `noEmit: true` por la compilación real y el `Dockerfile`
pasa a dos etapas (compilar con devDependencies, correr con `--omit=dev`).

> **Node 22 puede ejecutar `.ts` directamente** (type stripping). Tentador, pero
> **no** para producción: no chequea tipos y no admite `enum` ni `namespace`.
> Sirve para probar rápido; el despliegue va con `tsc`.

### ⚠️ Trampa concreta: la profundidad de carpetas

Cuatro rutas se resuelven con `__dirname` relativo:

```
src/config/migrate.js       → '../../docs/messaging_intranet_schema.sql'
src/config/migrate.js       → '../../docs/seed.sql'
src/config/migrate.js       → '../../docs/migrations'
src/services/monitoring...  → '../../package.json'
src/config/index.js         → '../../.env'
```

`dist/` **tiene que replicar la estructura de `src/`** para que sigan
resolviendo (`dist/config/../../docs` = `backend/docs`, igual que hoy). Con
`rootDir: "src"` y `outDir: "dist"` se cumple, pero **si `tsc` recibe un solo
archivo o `rootDir` queda mal, colapsa la estructura y esas cinco rutas se
rompen en runtime, no al compilar**. Es el tipo de fallo que aparece recién en
el contenedor.

Verificación mínima tras el primer build: `node dist/server.js` levanta, aplica
migraciones y `/api/health` responde `200`.

---

## Trampas propias de este código

| # | Qué | Dónde |
|---|---|---|
| 1 | **`require()` en funciones → `any`.** El motivo de que la Fase 1 sea bloqueante. | 110 casos, 11 archivos |
| 2 | **Filas `snake_case`.** Los tipos generados deben respetarlo; no "arreglar" a `camelCase` en la migración: sería un cambio de comportamiento encubierto. | `repositories/` |
| 3 | **`config` leído de `process.env`.** Todo llega como `string \| undefined`; los parseos a número/booleano hay que declararlos. | `config/index.js` |
| 4 | **Joi no infiere.** Sin el genérico, `req.body` queda `any` y se pierde el chequeo justo en el borde. | `dtos/` |
| 5 | **`socket.data` vs props sueltas.** Ya documentado en `SCALING.md`; tipar `SocketData` lo vuelve error de compilación. | `socket.js` |
| 6 | **Sin tests, el compilador no valida comportamiento.** Migrar de a poco y verificar a mano cada capa. | Todo |

---

## Esfuerzo y orden

| Fase | Tema | Esfuerzo |
|------|------|----------|
| 0 | Herramientas y línea base | 1 d |
| 1 | Romper ciclos ⚠️ | 2-3 d |
| 2 | Tipos generados del schema | 1-2 d |
| 3 | errors + config + utils + models | 2-3 d |
| 4 | dtos + repositories | 4-5 d |
| 5 | services | 5-7 d |
| 6 | controllers + routes + middlewares | 3-4 d |
| 7 | jobs + raíz + build de producción | 2-3 d |
| 8 | Endurecer a `strict` | 2-3 d |
| | **Total** | **22-31 días-dev** |

Las fases 0-2 dan valor por sí solas y se pueden hacer sin comprometerse al
resto. **Las fases 3 a 7 no conviene dejarlas a medias**: un backend mitad `.ts`
mitad `.js` durante meses tiene lo peor de los dos mundos.

---

## Qué no migrar

- `games/` (109 líneas de funciones puras) y `cli/` (27 líneas): migrarlos no
  cambia nada. Que entren si el barrido pasa por ahí, sin gastarles tiempo.
- Los `.sql` de `backend/docs/`: son la fuente de los tipos, no un destino.

---

## Antes de arrancar: ¿conviene?

Honestamente, el mayor retorno concreto para **este** proyecto no es tipar el
backend: es **compartir los tipos de respuesta de la API con el frontend**, para
que un cambio en `toMessageResponse()` rompa la compilación en el componente que
lo consume.

Y eso **sólo se materializa si el frontend también se migra** — hoy son 83
archivos `.js`/`.jsx` sin una línea de TypeScript. Migrar sólo el backend deja
seguridad interna (real, pero acotada) y el borde HTTP sigue sin verificarse.

Tres caminos, en orden de lo que yo recomendaría:

1. **Fases 0-2 y parar.** ~4-6 días. Se rompen los ciclos, aparecen los tipos
   del dominio y el `typecheck` empieza a atajar errores sobre el JS existente,
   sin comprometerse a nada.
2. **Backend completo (0-8).** 22-31 días. Tiene sentido si el equipo va a
   crecer o si aparecen bugs de forma de datos con frecuencia.
3. **Backend + frontend.** Sumale otro tanto por el frontend. Es el único camino
   que da el beneficio grande, y el único que justifica del todo el costo.

Lo que **no** recomiendo es arrancar por la Fase 5 (`services`) porque "es donde
está la lógica": sin la Fase 1 hecha, ahí todo termina en `any` y el esfuerzo se
tira.

---

## Referencias

- `docs/SCALING.md` — escalado horizontal (fases 1-4, hechas)
- `docs/STYLE_GUIDE.md` — convenciones del proyecto
- `AGENTS.md` — flujo de trabajo y commits
