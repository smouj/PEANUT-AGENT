"""🥜 Peanut Gateway (Web)

FastAPI + WebSocket UI para hablar con múltiples agentes (estilo terminal).

Ejecutar (recomendado):
  - Windows: .\\.venv\\Scripts\\python.exe web_ui.py
  - Linux/Mac: ./.venv/bin/python web_ui.py

Luego abre:
  http://127.0.0.1:18889/

Notas:
- Puerto por defecto: 18889 (evita conflicto con OpenClaw 18789)
- Puedes cambiarlo con:
    python web_ui.py --port 19999
  o
    set PEANUT_WEB_PORT=19999
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from agent import OllamaAgent


DEFAULT_PORT = int(os.getenv("PEANUT_WEB_PORT", "18889"))
DEFAULT_HOST = os.getenv("PEANUT_WEB_HOST", "127.0.0.1")
STATIC_INDEX = Path(__file__).parent / "web" / "index.html"


class NewSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)


class ResetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)


def _sanitize_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r"[^a-zA-Z0-9_\-\.]", "-", name)
    return name[:40] or "main"


@dataclass
class Session:
    name: str
    agent: OllamaAgent


app = FastAPI(title="Peanut Gateway PRO", version="0.1")

sessions: Dict[str, Session] = {}
current_session: str = "main"


def get_or_create(name: str) -> Session:
    global current_session
    name = _sanitize_name(name)
    if name not in sessions:
        sessions[name] = Session(
            name=name,
            agent=OllamaAgent(
                model=os.getenv("PEANUT_MODEL", "qwen2.5:7b"),
                temperature=float(os.getenv("PEANUT_TEMP", "0.0")),
            ),
        )
    current_session = name
    return sessions[name]


@app.get("/")
async def index() -> HTMLResponse:
    if STATIC_INDEX.exists():
        html = STATIC_INDEX.read_text(encoding="utf-8")
    else:
        html = "<h1>Peanut Gateway</h1><p>Falta web/index.html</p>"
    return HTMLResponse(html)


@app.get("/api/sessions")
async def list_sessions() -> dict:
    return {"sessions": sorted(sessions.keys()), "current": current_session}


@app.post("/api/new")
async def new_session(req: NewSessionRequest) -> dict:
    s = get_or_create(req.name)
    return {"ok": True, "name": s.name}


@app.post("/api/reset")
async def reset_session(req: ResetRequest) -> dict:
    name = _sanitize_name(req.name)
    if name in sessions:
        sessions[name].agent.reset()
        return {"ok": True}
    return {"ok": False, "error": "Sesión no encontrada"}


@app.websocket("/ws/{session_name}")
async def ws_chat(websocket: WebSocket, session_name: str) -> None:
    await websocket.accept()
    sess = get_or_create(session_name)

    await websocket.send_text(json.dumps({"type": "sys", "message": f"Sesión activa: {sess.name}"}, ensure_ascii=False))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                msg = str(data.get("message", "")).strip()
            except Exception:
                msg = raw.strip()

            if not msg:
                continue

            reply = sess.agent.chat(msg, verbose=False)
            await websocket.send_text(
                json.dumps(
                    {"type": "reply", "reply": reply, "peanuts": sess.agent.peanuts},
                    ensure_ascii=False,
                )
            )

    except WebSocketDisconnect:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="🥜 Peanut Gateway Web")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host a bindear (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Puerto (default: 18889)")
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(app, host=str(args.host), port=int(args.port), reload=False, log_level="info")


if __name__ == "__main__":
    main()
