# EchoChat — Instrucciones para Claude Code

La fuente única de convenciones del proyecto es **[AGENTS.md](AGENTS.md)** — leelo entero
antes de trabajar.

@AGENTS.md

---

## ⚠️ Recordatorio crítico: mensajes de commit

Cuando el usuario pida un commit, el mensaje **DEBE** seguir el formato del proyecto:

```
Tipo <emoji>: descripción en español (explica el por qué)
```

Tipos y emojis (tabla completa en [AGENTS.md](AGENTS.md#git--commits)):

| Tipo | Emoji | | Tipo | Emoji |
|------|-------|-|------|-------|
| Feat | 🆕 | | Docs | 🗒️ |
| Fix | 🐛 / 🔧 | | Clean | 🧹 |
| Refactor | ♻️ | | Perf | ⚡ |
| Style | 🎨 | | Test | ✅ |
| Release | 🎉 | | Dependencies | 📦 |

```text
❌ Add feature X
❌ Automatizar instalación de la base
✅ Feat 🆕: minijuegos en chats directos (ta-te-ti, piedra-papel-tijera, ahorcado)
✅ Refactor ♻️: separar seed del schema para converger datos de referencia
```

Otras reglas que se suelen olvidar (detalle en AGENTS.md):

- **No** ejecutar `git commit`/`git push` ni crear PRs sin pedido explícito.
- Ramas desde `develop` (`feat/`, `fix/`, …); nunca commitear directo a `main`.
- Diff mínimo: no refactorizar ni documentar cosas no pedidas.
