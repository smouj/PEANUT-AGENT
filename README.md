# 🥜 PEANUT-AGENT — PRO v0.1

**Agente autónomo _local-first_** optimizado para modelos pequeños (7B) en **Ollama**, diseñado para que un modelo “pequeño” se comporte como uno grande gracias a **arquitectura**, no magia.

> Filosofía: **Local • Offline‑friendly • Seguro • Modular**.

---

## ✨ Qué trae (PRO)

- ✅ **Tool Calling** (JSON) con **allowlist** + **anti‑path traversal**
- ✅ **Reflection Loop**: auto‑corrección de argumentos de tool calls (hasta **3 reintentos**)
- ✅ **Peanut Memory (RAG local)**: aprende de éxitos pasados (embeddings locales con Ollama)
- ✅ **Gateway UI**
  - **Consola** (Rich) multi‑sesión
  - **Web** (FastAPI + WebSocket) estilo terminal (puerto **18789**)

---

## ✅ Requisitos

- **Python 3.10+**
- **Git**
- (Recomendado) **Ollama** instalado y corriendo (el wizard te ayuda a instalarlo)

> Nota “offline‑friendly”: la primera instalación de dependencias de Python puede requerir internet para `pip`. Después puedes operar local.

---

## 🚀 Instalación (recomendada) — 1 comando después de clonar

### 1) Clona el repositorio

```bash
git clone https://github.com/smouj/PEANUT-AGENT.git
cd PEANUT-AGENT
```

### 2) Ejecuta el instalador (1 comando)

**Linux/macOS:**
```bash
bash install.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Esto:
- crea un entorno virtual local **.venv/** (si no existe),
- instala dependencias,
- lanza el **Wizard 🧙** con una UI bonita,
- te guía para instalar/arrancar **Ollama**,
- ofrece **instalación limpia** (borrar `~/.peanut-agent`).

> Alternativa (sin scripts): `python wizard.py` — el wizard también puede auto‑crear `.venv/`.

---

## 🧙 Wizard

Ejecuta:

```bash
python wizard.py
```

El wizard:
- detecta dependencias y las instala dentro de `.venv/` (por defecto),
- detecta Ollama y te guía a instalarlo si falta,
- valida conectividad a `http://localhost:11434`,
- sugiere modelos (`qwen2.5:7b`, `llama3`, `nomic-embed-text`) y hace `pull` si lo apruebas,
- pregunta si quieres **instalación limpia**.

---

## 🖥️ Gateway UI

### Gateway consola (multi‑sesión)

```bash
python gateway.py
```

### Gateway web (terminal‑like)

```bash
python web_ui.py
```

Luego abre:
- `http://127.0.0.1:18789/`

---

## 🧠 Arquitectura en 90 segundos

### 1) Tool Calling seguro
El ejecutor vive en `tools.py`:
- allowlist de comandos
- bloqueo de patrones destructivos
- prevención de **path traversal**
- timeouts y errores explícitos

### 2) Reflection Loop (auto‑corrección)
Después de cada tool call:
1. se ejecuta la herramienta
2. `reflection.reflect_on_result()` audita el output
3. si falla → sugiere `improved_input` y reintenta (máx 3)

### 3) Peanut Memory (RAG local)
Antes de actuar:
- `memory.retrieve_memory(task)` trae **top‑2** tareas similares
- se inyecta en el prompt:
  - `🥜 CONSEJOS DEL PASADO: [...]`

En éxito:
- `memory.add_memory(task, tool_call)` guarda (tarea + herramienta + args + embedding)

---

## 🥜 Gamificación (Modo Experto)

Estado en `~/.peanut-agent/state.json`:

- `peanuts <= 10` → Modo Normal
- `peanuts > 10` → **MODO EXPERTO** (system prompt más “afilado”)

---

## 📦 Estructura del proyecto

```text
.
├─ agent.py              # Agente principal (tools + reflection + memory)
├─ tools.py              # Ejecutores de herramientas (seguridad)
├─ reflection.py         # Reflection Loop (Pydantic + Ollama)
├─ memory.py             # RAG local (JSONL + embeddings)
├─ wizard.py             # Wizard bonito (auto-venv + checks)
├─ gateway.py            # Gateway consola multi-sesión (Rich)
├─ web_ui.py             # Gateway web (FastAPI + WS) puerto 18789
├─ install.sh            # Instalación 1 comando (Linux/macOS)
├─ install.ps1           # Instalación 1 comando (Windows)
├─ scripts/
│  ├─ install_ollama.sh
│  └─ install_ollama.ps1
├─ web/
│  └─ index.html         # UI terminal web
├─ integrations/
│  └─ picoclaw.py        # Integración opcional (ligera)
└─ docs/
   ├─ ARCHITECTURE.md
   ├─ SECURITY.md
   ├─ REFLECTION_MEMORY.md
   ├─ WIZARD.md
   └─ TROUBLESHOOTING.md
```

---

## 🔒 Seguridad

Lee: `docs/SECURITY.md`

Resumen:
- allowlist estricta para shell
- bloqueos contra comandos destructivos
- prevención de paths fuera de `work_dir`

---

## 🧩 PicoClaw (opcional)

Adaptador mínimo en `integrations/picoclaw.py`.

Por defecto **no descarga nada pesado**. Se integra cuando tengas el binario/CLI disponible.

---

## 🆘 Troubleshooting rápido

- **Ollama no responde** → `ollama serve` (o revisa el servicio)
- **Puerto 18789 ocupado** → cambia el puerto en `web_ui.py` o libera el proceso
- **Modelos** → `ollama list` / `ollama pull qwen2.5:7b`

Más en `docs/TROUBLESHOOTING.md`.

---

## Licencia

MIT — ver `LICENSE`.
