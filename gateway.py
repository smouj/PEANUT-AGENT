"""🥜 Peanut Gateway (Consola)

Gateway en consola (Rich) para hablar con uno o varios agentes.

Comandos:
  /help              ayuda
  /new <name>        crea sesión
  /switch <name>     cambia sesión
  /list              lista sesiones
  /reset             resetea historial de la sesión actual
  /peanuts           muestra contador
  /model <name>      cambia el modelo de la sesión actual
  /exit              salir

Nota importante (Windows):
  Ejecuta SIEMPRE con el Python del venv:
    .\\.venv\\Scripts\\python.exe gateway.py
"""

from __future__ import annotations

import os
import shlex
import sys
from dataclasses import dataclass
from typing import Dict, Optional

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

from agent import OllamaAgent


ASCII_TITLE = r"""
 ____  _____    _    _   _ _   _ _____ 
|  _ \| ____|  / \  | \ | | | | |_   _|
| |_) |  _|   / _ \ |  \| | | | | | |  
|  __/| |___ / ___ \| |\  | |_| | | |  
|_|   |_____/_/   \_\_| \_|\___/  |_|  

    _    ____ _____ _   _ _____ 
   / \  / ___| ____| \ | |_   _|
  / _ \| |  _|  _| |  \| | | |  
 / ___ \ |_| | |___| |\  | | |  
/_/   \_\____|_____|_| \_| |_|  

            🥜 PEANUT-AGENT • PRO v0.1  |  Gateway Consola
""".rstrip()


@dataclass
class Session:
    name: str
    agent: OllamaAgent


def _in_venv() -> bool:
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def _help(console: Console) -> None:
    console.print(
        Panel(
            "[bold]/help[/bold] ayuda\n"
            "[bold]/new <name>[/bold] crear sesión\n"
            "[bold]/switch <name>[/bold] cambiar sesión\n"
            "[bold]/list[/bold] listar sesiones\n"
            "[bold]/reset[/bold] reset historial sesión actual\n"
            "[bold]/peanuts[/bold] ver contador\n"
            "[bold]/model <name>[/bold] cambiar modelo sesión actual\n"
            "[bold]/exit[/bold] salir\n",
            title="Comandos",
            border_style="yellow",
        )
    )


def _list_sessions(console: Console, sessions: Dict[str, Session], current: str) -> None:
    t = Table(show_header=True, header_style="bold")
    t.add_column("Sesión")
    t.add_column("Modelo")
    t.add_column("Peanuts")
    for name, sess in sorted(sessions.items(), key=lambda kv: kv[0].lower()):
        mark = "✅" if name == current else ""
        t.add_row(f"{name} {mark}", sess.agent.model, str(sess.agent.peanuts))
    console.print(t)


def main() -> None:
    console = Console()

    # Aviso si no estamos en venv (esto evita el fallo típico de "no module named fastapi/rich").
    if os.name == "nt" and not _in_venv():
        console.print(
            Panel(
                "[yellow]Estás ejecutando fuera del entorno virtual (.venv).[/yellow]\n\n"
                "En Windows usa:\n"
                "  [bold].\\.venv\\Scripts\\python.exe gateway.py[/bold]\n",
                title="⚠️ Recomendación",
                border_style="yellow",
            )
        )

    console.print(Panel.fit(ASCII_TITLE, border_style="yellow", padding=(1, 2)))

    sessions: Dict[str, Session] = {}
    current: str = "main"

    def ensure_session(name: str) -> Session:
        nonlocal current
        if name not in sessions:
            sessions[name] = Session(
                name=name,
                agent=OllamaAgent(
                    model=os.getenv("PEANUT_MODEL", "qwen2.5:7b"),
                    temperature=float(os.getenv("PEANUT_TEMP", "0.0")),
                ),
            )
        current = name
        return sessions[name]

    ensure_session(current)
    _help(console)

    while True:
        sess = ensure_session(current)
        prompt = f"[{sess.name}] 👤 Tú"
        try:
            text = Prompt.ask(prompt, default="").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n👋 Cerrando gateway…")
            return

        if not text:
            continue

        if text.startswith("/"):
            parts = shlex.split(text)
            cmd = parts[0].lower()

            if cmd in ("/exit", "/quit"):
                console.print("👋 ¡Hasta luego!")
                return

            if cmd == "/help":
                _help(console)
                continue

            if cmd == "/list":
                _list_sessions(console, sessions, current)
                continue

            if cmd == "/new" and len(parts) >= 2:
                name = parts[1].strip()
                ensure_session(name)
                console.print(f"✅ Sesión creada/activa: [bold]{current}[/bold]")
                continue

            if cmd == "/switch" and len(parts) >= 2:
                name = parts[1].strip()
                if name not in sessions:
                    console.print("[red]Sesión no encontrada.[/red] Usa /new <name>.")
                else:
                    current = name
                    console.print(f"✅ Sesión activa: [bold]{current}[/bold]")
                continue

            if cmd == "/reset":
                sess.agent.reset()
                console.print("✅ Historial reseteado (peanuts/memoria se conservan).")
                continue

            if cmd == "/peanuts":
                console.print(f"🥜 Peanuts: [bold]{sess.agent.peanuts}[/bold]")
                continue

            if cmd == "/model" and len(parts) >= 2:
                new_model = parts[1].strip()
                sess.agent.model = new_model
                console.print(f"✅ Modelo actualizado: [bold]{new_model}[/bold]")
                continue

            console.print("[yellow]Comando no reconocido.[/yellow] Usa /help.")
            continue

        # Chat
        reply = sess.agent.chat(text, verbose=False)
        console.print(Panel(reply, title=f"🤖 {sess.name} • {sess.agent.model} • 🥜 {sess.agent.peanuts}", border_style="green"))


if __name__ == "__main__":
    main()
