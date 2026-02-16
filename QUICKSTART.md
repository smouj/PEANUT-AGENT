# 🚀 QUICKSTART — PEANUT-AGENT PRO v0.1

## Requisitos
- Python 3.10+
- Git
- (Recomendado) Ollama

## Instalación (1 comando)

### Linux/macOS

```bash
git clone https://github.com/smouj/PEANUT-AGENT.git
cd PEANUT-AGENT
bash install.sh
```

### Windows (PowerShell)

```powershell
git clone https://github.com/smouj/PEANUT-AGENT.git
cd PEANUT-AGENT
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

## Abrir Gateway

### Consola (multi‑sesión)

Windows:
```powershell
.\run_gateway.ps1
```

Linux/macOS:
```bash
./.venv/bin/python gateway.py
```

### Web (terminal‑like)

Windows:
```powershell
.\run_web.ps1
```

Linux/macOS:
```bash
./.venv/bin/python web_ui.py
```

Abre:
- `http://127.0.0.1:18889/`

Cambiar puerto:
```bash
python web_ui.py --port 19999
```
