#!/usr/bin/env bash
set -euo pipefail

# 🥜 PEANUT-AGENT — 1-command installer (Linux/macOS)
#
# Uso:
#   git clone ... && cd PEANUT-AGENT
#   bash install.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ No encuentro python3. Instala Python 3.10+ y reintenta." >&2
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "[1/3] Creando entorno virtual (.venv)…"
  python3 -m venv .venv
fi

echo "[2/3] Instalando dependencias…"
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt

echo "[3/3] Ejecutando wizard…"
./.venv/bin/python wizard.py
