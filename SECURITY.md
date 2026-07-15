# Política de Seguridad

## 📌 Versiones soportadas

EchoChat está actualmente en fase **alpha** (`v1.0.0-alpha.x`). Durante esta etapa solo se da soporte de seguridad a la última versión publicada.

| Versión         | Soportada          |
| --------------- | ------------------ |
| `v1.0.0-alpha.x` (última) | ✅ |
| Versiones anteriores      | ❌ |

Esta tabla se actualizará cuando el proyecto alcance una versión estable `v1.0.0`.

## 🔒 Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en EchoChat, **por favor NO abras un Issue público**. Muchas vulnerabilidades (auth, RBAC, manejo de tokens, subida de archivos) pueden ser explotadas antes de que exista un fix si se divulgan abiertamente.

En su lugar, reportala de forma privada usando una de estas vías:

- **GitHub Security Advisories**: desde la pestaña [Security](https://github.com/FrancoCostanzo/EchoChat/security) del repositorio → "Report a vulnerability". Es el método preferido, ya que permite coordinar el fix y el aviso (CVE si aplica) en privado.
- Si no podés usar Security Advisories, abrí un [Issue en blanco](https://github.com/FrancoCostanzo/EchoChat/issues/new) pidiendo un canal de contacto, **sin incluir detalles técnicos de la vulnerabilidad**, y se coordinará una vía privada de comunicación.

### Qué incluir en el reporte

Para poder evaluar y reproducir el problema más rápido, si es posible incluí:

- Descripción del problema y su impacto potencial (ej: bypass de autenticación, escalado de privilegios via RBAC, IDOR en conversaciones/mensajes, XSS, inyección SQL, etc.).
- Pasos para reproducirlo o un PoC mínimo.
- Versión/commit de EchoChat afectado.
- Configuración relevante (¿Docker? ¿PostgreSQL/MinIO externos o integrados?).

### Qué esperar

- **Confirmación de recepción**: dentro de los primeros días hábiles.
- **Evaluación inicial**: se te informará si el reporte es válido y su severidad estimada.
- **Resolución**: dado que el proyecto se mantiene de forma independiente, los tiempos de fix pueden variar según severidad y complejidad — se prioriza siempre lo que afecte autenticación, datos de mensajes o archivos almacenados.
- **Divulgación**: se coordinará con quien reporta un tiempo razonable antes de publicar detalles, una vez exista un fix disponible.

## 🛡️ Alcance

Se consideran dentro del alcance de esta política vulnerabilidades en:

- El backend (`backend/`): API REST, autenticación JWT, WebSockets (Socket.IO), RBAC, manejo de archivos (MinIO).
- El frontend (`frontend/`): manejo de sesión, XSS, exposición de datos sensibles en el cliente.
- La configuración de despliegue (`docker-compose.yml`, Dockerfiles) si expone servicios o credenciales de forma insegura por defecto.

Quedan **fuera de alcance**: vulnerabilidades en dependencias de terceros ya reportadas públicamente (reportalas directamente al proyecto correspondiente), y problemas que requieran acceso físico o acceso previo de administrador al servidor.

## 🙏 Reconocimiento

Si querés ser mencionado públicamente por un reporte responsable una vez resuelto el problema, avisanos en el reporte y se te dará crédito en el changelog o release notes correspondiente.
