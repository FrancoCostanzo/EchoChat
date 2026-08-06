<div align="center">

<img src="site/public/icon-512.png" alt="EchoChat" width="96" height="96" />

# EchoChat

### 💬 Mensajería empresarial en tiempo real · self-hosted · open source

Plataforma de comunicación interna full-stack — mensajes, canales, llamadas WebRTC,
difusiones, encuestas y archivos. Todo en tiempo real, todo en tu propia infraestructura.

<br/>

[![Estado](https://img.shields.io/badge/estado-alpha-orange?style=for-the-badge)](https://echochat.netlify.app/docs/estado)
[![Licencia](https://img.shields.io/badge/AGPL--3.0-6644e8?style=for-the-badge)](./LICENSE)
[![Docs](https://img.shields.io/badge/📖_Documentación-6644e8?style=for-the-badge)](https://echochat.netlify.app/docs)

<br/>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

<br/>

**[📖 Documentación](https://echochat.netlify.app/docs)** ·
[✨ Características](https://echochat.netlify.app/docs/caracteristicas) ·
[❓ FAQ](https://echochat.netlify.app/faq) ·
[🤝 Contribuir](./CONTRIBUTING.md)

</div>

<br/>

---

## ✨ Qué incluye

|   |   |
|---|---|
| 💬 **Mensajería en tiempo real** | Chats directos y grupales con presencia, typing, lecturas y reacciones |
| 📢 **Canales y difusiones** | Comunicación uno-a-muchos para anuncios y equipos |
| 📞 **Llamadas WebRTC** | Voz y video peer-to-peer, sin plugins ni terceros |
| 📊 **Encuestas** | Decisiones rápidas dentro de cualquier conversación |
| 📎 **Archivos y multimedia** | Almacenamiento S3 propio vía MinIO, con presigned URLs |
| 🔐 **Seguridad** | JWT + 2FA, RBAC granular y mensajes cifrados |
| 🌎 **Multi-idioma** | Interfaz completa en español, inglés y portugués |
| 🏠 **100% self-hosted** | Tus datos en tu servidor — `docker compose up` y listo |

<br/>

> [!NOTE]
> Este README es la **puerta de entrada**. La guía completa — instalación, todos los
> modos de despliegue, arquitectura, API, modelo de datos y uso de cada función — vive en
> el **[sitio de documentación](https://echochat.netlify.app/docs)** (fuente en
> [`site/`](./site)).

---

## 🚀 Inicio rápido

La forma recomendada de correr EchoChat es con Docker. Tres comandos y estás online:

```bash
git clone https://github.com/FrancoCostanzo/EchoChat.git
cd EchoChat
cp .env.example .env    # editar DB_PASSWORD, JWT_SECRET, MESSAGE_ENC_KEY, ADMIN_*, CORS_ORIGIN
docker compose up -d
```

> El backend aplica el esquema, corre las migraciones y crea el primer administrador
> **solo**, al arrancar. Para otros modos (BD/MinIO externos, mixto) y el detalle de cada
> variable, ver la guía de **[Despliegue con Docker](https://echochat.netlify.app/docs/despliegue)**.

<details>
<summary><b>🧑‍💻 ¿Preferís levantarlo para desarrollo?</b></summary>

<br/>

```bash
# Backend — http://localhost:3000
cd backend && npm install && npm run dev

# Frontend — http://localhost:5173 (en otra terminal)
cd frontend && npm install && npm run dev
```

Requiere **Node.js ≥ 18**, **PostgreSQL ≥ 15** y **MinIO**. Guía completa (variables de
entorno, convenciones de código, flujo de ramas) en
**[CONTRIBUTING.md](./CONTRIBUTING.md)** y en
**[Instalación (desarrollo)](https://echochat.netlify.app/docs/instalacion)**.

</details>

<details>
<summary><b>📈 ¿Necesitás más de una instancia del backend?</b></summary>

<br/>

El backend escala horizontalmente, pero necesita **Redis** para que las
instancias se vean entre sí: sin él, dos usuarios atendidos por instancias
distintas no reciben los mensajes del otro.

```bash
# en .env
COMPOSE_PROFILES=postgres,minio,redis
REDIS_URL=redis://redis:6379
BACKEND_REPLICAS=3
```

```bash
docker compose up -d --build
```

Redis se encarga de propagar los eventos de Socket.IO entre instancias, de
compartir el rate limit y la presencia, y de que cada tarea programada la
ejecute una sola instancia. Detalle completo y limitaciones (por ejemplo el
fallback a long-polling, que necesitaría sticky sessions) en
**[docs/SCALING.md](./docs/SCALING.md)**.

</details>

---

## 📚 Documentación

| Sección | Qué vas a encontrar |
|---------|---------------------|
| 🧭 **[Guía de uso](https://echochat.netlify.app/docs/uso/primeros-pasos)** | Mensajería, canales, llamadas, difusiones, encuestas, personalización |
| 🛡️ **[Administración](https://echochat.netlify.app/docs/admin/panel)** | Usuarios, RBAC, auditoría, almacenamiento, monitoreo |
| 🏗️ **[Arquitectura y desarrollo](https://echochat.netlify.app/docs/arquitectura)** | Backend, frontend, API REST, tiempo real, modelo de datos |
| 🐳 **[Despliegue](https://echochat.netlify.app/docs/despliegue)** | Docker, variables de entorno, backups, actualización, troubleshooting |
| 📈 **[Estado del proyecto](https://echochat.netlify.app/docs/estado)** | Qué funciona hoy, qué está en progreso y el roadmap |

---

## 🛠 Stack

<table>
<tr>
<td valign="top"><b>🎨 Frontend</b></td>
<td>React 19 · Vite · Tailwind CSS 4 · HeroUI · Zustand · Socket.IO Client</td>
</tr>
<tr>
<td valign="top"><b>⚙️ Backend</b></td>
<td>Node.js · Express · Socket.IO · PostgreSQL · MinIO (S3) · JWT + 2FA</td>
</tr>
<tr>
<td valign="top"><b>📦 Infra</b></td>
<td>Docker Compose · Nginx</td>
</tr>
</table>

Detalle de responsabilidades por capa en
[Backend](https://echochat.netlify.app/docs/desarrollo/backend) y
[Frontend](https://echochat.netlify.app/docs/desarrollo/frontend).

---

## 🤝 Contribuir

¿Bug o idea? → [**Issues**](https://github.com/FrancoCostanzo/EchoChat/issues) /
[**Discussions**](https://github.com/FrancoCostanzo/EchoChat/discussions)
¿Vulnerabilidad de seguridad? → [**SECURITY.md**](./SECURITY.md) _(no en un Issue público)_

Flujo de ramas, convención de commits y checklist de PR en
**[CONTRIBUTING.md](./CONTRIBUTING.md)**.

---

## 📄 Licencia

[**AGPL-3.0**](./LICENSE) — si ofrecés EchoChat (modificado o no) como servicio accesible
por red, estás obligado a publicar el código fuente correspondiente.

<div align="center">

<br/>

Hecho con ❤️ por [**Franco Costanzo**](https://github.com/FrancoCostanzo)

<sub>⭐ Si te sirve, dejá una estrella — ayuda un montón.</sub>

</div>
