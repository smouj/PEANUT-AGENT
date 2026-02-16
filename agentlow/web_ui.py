"""agentlow.web_ui

Gateway Web mínimo (FastAPI) para interactuar con el agente.

Entry point (setup.py): ``agentlow-web=agentlow.web_ui:main``.

Nota: esta implementación es deliberadamente ligera para CI.
En el proyecto completo puedes reemplazarla por tu UI terminal vía WebSocket.
"""

from __future__ import annotations

import argparse
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

from .agent import OllamaAgent


def build_app(agent: OllamaAgent) -> FastAPI:
    app = FastAPI(title="🥜 AgentLow Web")

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return """<!doctype html>
<html lang=\"es\"><head><meta charset=\"utf-8\"/>
<title>🥜 AgentLow Web</title>
<style>body{font-family:system-ui;margin:24px}textarea{width:100%;height:120px}pre{background:#111;color:#eee;padding:12px;border-radius:8px;white-space:pre-wrap}</style>
</head><body>
<h1>🥜 AgentLow Web</h1>
<p>UI mínima. POST /chat con JSON: {"message": "..."}</p>
</body></html>"""

    @app.post("/chat")
    def chat(payload: Dict[str, Any]) -> JSONResponse:
        msg = str(payload.get("message", "")).strip()
        if not msg:
            return JSONResponse({"error": "message vacío"}, status_code=400)
        reply = agent.chat(msg, verbose=False)
        return JSONResponse({"reply": reply})

    return app


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentlow-web", description="🥜 AgentLow Web UI")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18789)
    parser.add_argument("--model", default="qwen2.5:7b")
    parser.add_argument("--ollama-url", default="http://localhost:11434")
    parser.add_argument("--work-dir", default=None)
    args = parser.parse_args()

    agent = OllamaAgent(model=args.model, ollama_url=args.ollama_url, work_dir=args.work_dir)
    app = build_app(agent)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
