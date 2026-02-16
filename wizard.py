"""🥜 Peanut Wizard (PRO)

Wizard interactivo para preparar el entorno de PEANUT-AGENT.

Objetivo:
- Instalación en 1 comando (después de clonar el repo).
- Aislado por defecto: crea/usa un entorno virtual local .venv/
- Seguridad: NO ejecuta comandos destructivos; solo instala dependencias del proyecto,
  guía instalación/arranque de Ollama y ofrece limpieza de estado.

Ejecutar:
  python wizard.py

Atajos:
  python wizard.py --yes        # Aceptar defaults
  python wizard.py --clean      # Forzar instalación limpia (borrar ~/.peanut-agent)
  python wizard.py --no-pull    # No hacer "ollama pull" de modelos
  python wizard.py --no-venv    # No crear .venv (no recomendado)
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple


DEFAULT_OLLAMA_URL = "http://localhost:11434"
STATE_DIR = Path.home() / ".peanut-agent"
DEFAULT_WEB_PORT = 18889  # evita conflicto con OpenClaw (18789)

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

            🥜 PEANUT-AGENT • PRO v0.1  |  Wizard
""".rstrip()


def _force_utf8_console() -> None:
    """Evita mojibake (Windows) y mejora salida en consola."""
    if os.name != "nt":
        return
    try:
        # Cambia codepage a UTF-8 (mejor para emojis y acentos)
        os.system("chcp 65001 >NUL")
    except Exception:
        pass
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass


def _run(cmd: List[str], *, cwd: Optional[Path] = None) -> Tuple[int, str]:
    """Ejecuta un comando y devuelve (returncode, stdout+stderr)."""
    p = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (p.stdout or "") + (p.stderr or "")
    return p.returncode, out.strip()


def _is_venv() -> bool:
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def _venv_python(venv_dir: Path) -> Path:
    if platform.system().lower().startswith("win"):
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def _create_or_update_venv(project_root: Path, venv_dir: Path, requirements_path: Path) -> None:
    if not requirements_path.exists():
        raise SystemExit(f"No encuentro requirements.txt en: {requirements_path}")

    if not venv_dir.exists():
        print("\n🧪 Creando entorno virtual (.venv)…")
        rc, out = _run([sys.executable, "-m", "venv", str(venv_dir)], cwd=project_root)
        if rc != 0:
            raise SystemExit(f"Falló crear venv:\n{out}")

    vpy = _venv_python(venv_dir)
    if not vpy.exists():
        raise SystemExit(f"No encuentro el Python del venv: {vpy}")

    print("\n📦 Instalando dependencias… (pip)")
    rc, out = _run([str(vpy), "-m", "pip", "install", "--upgrade", "pip"], cwd=project_root)
    if rc != 0:
        raise SystemExit(f"Falló actualizar pip:\n{out}")

    rc, out = _run([str(vpy), "-m", "pip", "install", "-r", str(requirements_path)], cwd=project_root)
    if rc != 0:
        raise SystemExit(f"Falló instalar dependencias:\n{out}")


def _reexec_in_venv(project_root: Path, venv_dir: Path, argv: List[str]) -> None:
    vpy = _venv_python(venv_dir)
    if not vpy.exists():
        raise SystemExit(f"No encuentro el Python del venv: {vpy}")

    new_argv = [str(vpy), str(project_root / "wizard.py"), "--_in-venv"] + argv
    rc = subprocess.call(new_argv)
    raise SystemExit(rc)


def _ollama_reachable(requests_mod, url: str) -> bool:
    try:
        r = requests_mod.get(f"{url}/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def _try_start_ollama_server() -> Tuple[bool, str]:
    """Intenta arrancar `ollama serve` en segundo plano (best-effort)."""
    if shutil.which("ollama") is None:
        return False, "No encuentro `ollama` en PATH."

    try:
        kwargs = {
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }

        if os.name == "nt":
            DETACHED_PROCESS = 0x00000008
            CREATE_NEW_PROCESS_GROUP = 0x00000200
            kwargs["creationflags"] = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP

        subprocess.Popen(["ollama", "serve"], **kwargs)  # noqa: S603,S607
        return True, "Intento de arranque lanzado (ollama serve)."
    except FileNotFoundError:
        return False, "No encuentro el binario `ollama`."
    except Exception as e:
        return False, f"No pude iniciar Ollama: {e}"


def main() -> None:
    _force_utf8_console()

    parser = argparse.ArgumentParser(description="🥜 Peanut Wizard (PRO)")
    parser.add_argument("--yes", action="store_true", help="Aceptar defaults")
    parser.add_argument("--clean", action="store_true", help="Instalación limpia (borra ~/.peanut-agent)")
    parser.add_argument("--no-pull", action="store_true", help="No descargar modelos")
    parser.add_argument("--no-venv", action="store_true", help="No crear .venv (no recomendado)")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="URL de Ollama (default: http://localhost:11434)")
    parser.add_argument("--_in-venv", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent
    venv_dir = project_root / ".venv"
    requirements_path = project_root / "requirements.txt"

    # Bootstrap: crear venv y re-ejecutar dentro
    if not args._in_venv and not args.no_venv and not _is_venv():
        if args.yes:
            create = True
        else:
            ans = input("¿Crear/usar entorno virtual local .venv y auto-instalar dependencias? [Y/n]: ").strip().lower()
            create = (ans in ("", "y", "yes", "s", "si"))

        if create:
            _create_or_update_venv(project_root, venv_dir, requirements_path)
            passthrough = [a for a in sys.argv[1:] if a != "--_in-venv"]
            _reexec_in_venv(project_root, venv_dir, passthrough)

    # UI completa (requiere deps)
    try:
        import requests  # type: ignore
        from rich import box  # type: ignore
        from rich.console import Console  # type: ignore
        from rich.panel import Panel  # type: ignore
        from rich.prompt import Confirm  # type: ignore
        from rich.table import Table  # type: ignore
    except Exception as e:
        print("\n❌ Dependencias faltantes para UI completa:")
        print(f"{e}")
        print("\nSolución:")
        print("  python -m pip install -r requirements.txt")
        raise SystemExit(1)

    console = Console()
    console.print(Panel.fit(ASCII_TITLE, border_style="yellow", padding=(1, 2)))
    console.print("[bold]Wizard de instalación y gateway — listo para producción local.[/bold]\n")

    info = Table(box=box.SIMPLE, show_header=False)
    info.add_row("OS", f"{platform.system()} {platform.release()}")
    info.add_row("Python", sys.version.split()[0])
    info.add_row("Root", str(project_root))
    info.add_row("Venv", "✅ .venv" if _is_venv() else "⚠️ sistema")
    info.add_row("State", str(STATE_DIR))
    info.add_row("Web Port", str(DEFAULT_WEB_PORT))
    console.print(info)

    # Limpieza
    console.print("\n[bold]🧼 Instalación limpia[/bold]")
    do_clean = bool(args.clean)
    if not do_clean and STATE_DIR.exists() and not args.yes:
        console.print(f"[yellow]Detectado estado previo en:[/yellow] {STATE_DIR}")
        do_clean = Confirm.ask("¿Borrar datos existentes antes de continuar?", default=False)

    if do_clean and STATE_DIR.exists():
        confirm = "BORRAR" if args.yes else input("Escribe BORRAR para confirmar: ").strip()
        if confirm.upper() == "BORRAR":
            shutil.rmtree(STATE_DIR, ignore_errors=True)
            console.print("[green]✅ Datos borrados.[/green]")
        else:
            console.print("[red]Cancelado. No se borró nada.[/red]")
    elif not STATE_DIR.exists():
        console.print("[green]✅ No hay datos previos.[/green]")

    # Ollama
    console.print("\n[bold]🧠 Ollama[/bold]")
    ollama_url = str(args.ollama_url).strip()
    has_bin = shutil.which("ollama") is not None
    reachable = _ollama_reachable(requests, ollama_url) if has_bin else False

    t = Table(box=box.SIMPLE, show_header=True, header_style="bold")
    t.add_column("Chequeo")
    t.add_column("Estado")
    t.add_row("Binario `ollama`", "✅" if has_bin else "❌")
    t.add_row(f"Servidor ({ollama_url})", "✅" if reachable else "❌")
    console.print(t)

    if not has_bin:
        console.print("[yellow]ℹ️ No encuentro `ollama` en PATH.[/yellow]")
        if platform.system().lower().startswith("win"):
            console.print("Instala Ollama desde: https://ollama.com/download (Windows)")
            console.print("Luego abre la app 'Ollama' o ejecuta: [bold]ollama serve[/bold]")
        else:
            console.print("En Linux/Mac puedes usar: scripts/install_ollama.sh")
        console.print("\n[red]Sin Ollama corriendo, el agente NO podrá responder.[/red]")
    else:
        if not reachable:
            console.print("[yellow]⚠️ No puedo conectar con el servidor de Ollama.[/yellow]")
            if not args.yes:
                try_start = Confirm.ask("¿Intentar arrancar `ollama serve` ahora?", default=True)
            else:
                try_start = True

            if try_start:
                ok, msg = _try_start_ollama_server()
                console.print(f"[cyan]{msg}[/cyan]")
                time.sleep(1.2)
                reachable = _ollama_reachable(requests, ollama_url)

            if not reachable:
                console.print("\nSugerencias:")
                console.print("- Ejecuta: [bold]ollama serve[/bold] (y deja esa consola abierta)")
                console.print("- O abre la app 'Ollama' desde el menú Inicio")
                console.print("- Verifica el puerto 11434 (firewall/antivirus)")

        # Pull modelos solo si el server responde
        models = ["qwen2.5:7b", "llama3", "nomic-embed-text"]
        if reachable and not args.no_pull:
            console.print("\n[bold]📦 Modelos recomendados[/bold]")
            console.print(f"Lista: {', '.join(models)}")
            do_pull = True if args.yes else Confirm.ask("¿Hacer `ollama pull` ahora?", default=False)
            if do_pull:
                for m in models:
                    console.print(f"\n⬇️  [bold]ollama pull {m}[/bold]")
                    rc, out = _run(["ollama", "pull", m], cwd=project_root)
                    if rc == 0:
                        console.print("[green]✅ OK[/green]")
                    else:
                        console.print("[red]❌ Falló pull[/red]")
                        if out:
                            console.print(out)

    # Siguiente pasos
    console.print("\n[bold green]✅ Wizard completado.[/bold green]")

    if platform.system().lower().startswith("win"):
        py_cmd = r".\.venv\Scripts\python.exe"
        console.print("\nSiguiente (Windows):")
        console.print(f"- Gateway consola: [bold]{py_cmd} gateway.py[/bold]")
        console.print(f"- Gateway web:    [bold]{py_cmd} web_ui.py[/bold]")
    else:
        py_cmd = "./.venv/bin/python" if (project_root / ".venv" / "bin" / "python").exists() else "python"
        console.print("\nSiguiente:")
        console.print(f"- Gateway consola: [bold]{py_cmd} gateway.py[/bold]")
        console.print(f"- Gateway web:    [bold]{py_cmd} web_ui.py[/bold]")

    console.print(f"\nWeb UI por defecto: [bold]http://127.0.0.1:{DEFAULT_WEB_PORT}/[/bold]")
    console.print("Tip: Cambia el puerto con `--port` o `PEANUT_WEB_PORT`.")


if __name__ == "__main__":
    main()
