# Tests

Suite de integración del backend. No hay unitarios: lo que se verifica es el
comportamiento observable de la API, que es lo que se rompe al refactorizar.

Corren con el runner de Node (`node:test`) sobre `tsx`, sin framework: cero
dependencias nuevas más allá de `socket.io-client`, que hace falta para probar
el tiempo real.

## Correrlos

Necesitan **una base PostgreSQL vacía**. La suite la migra sola con el propio
migrador del proyecto, así que no hay que preparar nada más.

```bash
docker run -d --name echochat-pg-test -p 5438:5432 \
  -e POSTGRES_USER=echochat -e POSTGRES_PASSWORD=test -e POSTGRES_DB=echochat_test \
  postgres:16-alpine
```

```bash
cd backend && DB_HOST=localhost DB_PORT=5438 DB_USER=echochat DB_PASSWORD=test npm test
```

`DB_NAME` no se pasa: lo fija el preload en `echochat_test` (o en `TEST_DB_NAME`
si se define). Es a propósito — ver la guarda de más abajo.

Para chequear los tipos de la suite, que `npm test` no valida porque `tsx` borra
los tipos sin comprobarlos:

```bash
cd backend && npm run typecheck:tests
```

## Cómo está armado

| Archivo | Qué cubre |
|---|---|
| `auth.test.ts` | Registro, login, bloqueo por intentos, sesiones, cambio de clave, 2FA |
| `codigosRespaldo.test.ts` | Recuperación con códigos de respaldo y 2FA de usuarios sin credenciales locales |
| `api.test.ts` | La superficie HTTP: al menos un endpoint por controller |
| `admin.test.ts` | Panel de administración, monitoreo y control de acceso |
| `scim.test.ts` | Aprovisionamiento SCIM como lo ejercita un IdP (Azure y Okta) |
| `tiempoReal.test.ts` | El bus de eventos: que lo que publican los servicios llegue por socket |

`helpers/servidor.ts` levanta la app **dentro del proceso de test**, en un puerto
que asigna el sistema. No hace falta arrancar el backend aparte.

`entorno.ts` es un preload (`--require`) y no un import de los helpers: `config`
lee `process.env` al cargarse, así que el entorno tiene que estar fijado antes de
que se cargue nada de la app. Node propaga el preload a los procesos hijos que
abre el runner.

## Dos cosas a tener en cuenta al agregar tests

**Corren en serie a propósito** (`--test-concurrency=1`). Todos los archivos
comparten una base, y varias aserciones miran estado global —que haya un solo
`super_admin`, lo que devuelve el filtro de auditoría—. En paralelo tardan un
tercio pero fallan cada tantas corridas, y una suite intermitente enseña a
ignorar los fallos.

**Los nombres se generan con `sufijo()`**, que combina pid, contador y bytes
aleatorios. La base no se limpia entre corridas: un test que dependa de "no hay
ningún X" va a fallar la segunda vez. Hay que afirmar sobre lo que el test creó,
no sobre el contenido global de una tabla.

## La guarda de la base

`helpers/servidor.ts` se niega a arrancar si `config.db.database` no es la base
de tests. La suite crea usuarios, manda mensajes y suspende cuentas: contra la
base de desarrollo la ensuciaría sin aviso.
