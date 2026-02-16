# 🥜 PEANUT-AGENT — PRO v0.1

**Agente autónomo _local-first_** optimizado para modelos pequeños (7B) en **Ollama**.

> Filosofía: **Local • Offline‑friendly • Seguro • Modular**.

---

## ✨ Qué incluye (PRO)

- ✅ **Tool Calling** (JSON) con **allowlist** + **anti‑path traversal**
- ✅ **Reflection Loop**: auto‑corrección de argumentos de tool calls (hasta **3 reintentos**)
- ✅ **Peanut Memory (RAG local)**: aprende de éxitos pasados (embeddings locales con Ollama)
- ✅ **Gateway UI**
  - **Consola** (Rich) multi‑sesión
  - **Web** (FastAPI + WebSocket) estilo terminal (**por defecto en el puerto 18889**)

> Nota: el puerto 18889 está elegido para evitar colisión con OpenClaw (18789).

---

## ✅ Requisitos

- **Python 3.10+** (Windows: recomendable 3.11/3.12)
- **Git**
- (Recomendado) **Ollama** instalado y corriendo (el wizard te guía)

> “Offline‑friendly”: la primera instalación de dependencias puede requerir internet para `pip`. Después, todo funciona local.

---

## 🚀 Instalación (recomendada) — 1 comando

### 1) Clona el repositorio

```bash
git clone https://github.com/smouj/PEANUT-AGENT.git
cd PEANUT-AGENT
```

### 2) Ejecuta el instalador (1 comando)

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Linux/macOS:**

```bash
bash install.sh
```

El instalador:
- crea/usa un entorno virtual local **.venv/**,
- instala dependencias desde `requirements.txt`,
- lanza el **wizard** (UI en consola),
- detecta Ollama, propone arrancarlo y (si está listo) sugiere modelos.

---

## 🧙 Wizard

También puedes ejecutar el wizard directamente (si quieres controlar flags):

```bash
python wizard.py
```

Flags útiles:

```bash
python wizard.py --yes      # aceptar defaults
python wizard.py --clean    # instalación limpia (borra ~/.peanut-agent)
python wizard.py --no-pull  # no descargar modelos
```

---

## 🖥️ Gateway UI

### Opción A: Gateway consola (multi‑sesión)

**Windows (recomendado):**

```powershell
.\run_gateway.ps1
```

**Manual (Windows):**

```powershell
.\.venv\Scripts\python.exe gateway.py
```

### Opción B: Gateway web (terminal‑like)

**Windows (recomendado):**

```powershell
.\run_web.ps1
```

**Manual (Windows):**

```powershell
.\.venv\Scripts\python.exe web_ui.py
```

Abre:
- `http://127.0.0.1:18889/`

Cambiar puerto:

```powershell
.\.venv\Scripts\python.exe web_ui.py --port 19999
# o
set PEANUT_WEB_PORT=19999
```

---

## 🧠 Arquitectura en 90 segundos

### 1) Tool Calling seguro
En `tools.py`:
- allowlist de comandos
- bloqueo de patrones destructivos
- prevención de **path traversal**
- timeouts + errores explícitos

### 2) Reflection Loop (auto‑corrección)
Después de cada tool call:
1. se ejecuta la herramienta
2. `reflection.reflect_on_result()` audita el output
3. si falla → sugiere `improved_input` y reintenta (máx 3)

### 3) Peanut Memory (RAG local)
Antes de actuar:
- `memory.retrieve_memory(task)` trae **top‑2** tareas similares
- se inyecta en el prompt: `🥜 CONSEJOS DEL PASADO: [...]`

En éxito:
- `memory.add_memory(task, tool_call)` guarda (tarea + herramienta + args + embedding)

### 4) Gamificación (Modo Experto)
Se guarda en `~/.peanut-agent/state.json`:
- `peanuts <= 10`: Modo Normal
- `peanuts > 10`: **MODO EXPERTO** (system prompt más agresivo)

---

## 🔒 Seguridad

Lee `docs/SECURITY.md`.

Resumen:
- allowlist estricta
- prevención de rutas fuera de `work_dir`
- sin `sudo`, sin `rm -rf`, sin comandos destructivos por defecto

---

## 🧩 PicoClaw (opcional)

Adaptador mínimo en `integrations/picoclaw.py`.

Por defecto **no descarga nada pesado**. Se activa cuando tengas PicoClaw disponible en tu entorno.

---

## 🆘 Troubleshooting rápido

- **Windows: “python no se encontró”**
  - Usa el launcher: `py --version`
  - Ejecuta el instalador: `powershell -ExecutionPolicy Bypass -File .\install.ps1`

- **Ollama: “connection refused” (11434)**
  - Abre la app **Ollama** (Windows) o ejecuta: `ollama serve`
  - Verifica: `ollama list`

- **Puerto ocupado**
  - Web UI por defecto: 18889
  - Cambia con `--port` o `PEANUT_WEB_PORT`

Más en `docs/TROUBLESHOOTING.md`.

---

## Licencia

MIT — ver `LICENSE`.
