"""agentlow.tools

Herramientas (tools) del agente con controles de seguridad:
- Allowlist de comandos
- Bloqueo de patrones destructivos
- Protección contra path traversal
- Timeouts defensivos

Este módulo está diseñado para ejecutarse localmente.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


class ToolExecutor:
    """Ejecuta herramientas con validación de seguridad."""

    def __init__(self, work_dir: Optional[str] = None) -> None:
        self.work_dir = Path(work_dir or os.getcwd())

        # ALLOWLIST DE COMANDOS SHELL (seguridad)
        self.allowed_commands = {
            # Lectura
            "ls",
            "cat",
            "head",
            "tail",
            "grep",
            "find",
            "pwd",
            "whoami",
            "df",
            "du",
            "wc",
            "file",
            "stat",
            "tree",
            "less",
            "more",
            # Navegación
            "cd",
            # Python/Node
            "python3",
            "python",
            "pip",
            "node",
            "npm",
            "npx",
            # Git (se valida aparte)
            "git",
            # Docker (se valida aparte)
            "docker",
            "docker-compose",
            # Otros seguros
            "curl",
            "wget",
            "ping",
            "which",
            "echo",
            "env",
            "printenv",
        }

        # COMANDOS PROHIBIDOS (nunca permitir)
        # Nota: incluimos tokens típicos de redirección/escalado.
        self.forbidden_tokens = {
            "rm",
            "rmdir",
            "dd",
            "mkfs",
            "fdisk",
            "format",
            "kill",
            "killall",
            "shutdown",
            "reboot",
            "halt",
            ">",
            ">>",
            "sudo",
            "su",
            "chmod",
            "chown",
        }

    def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta y devuelve el resultado."""
        if tool_name == "shell":
            return self._shell(arguments)
        if tool_name == "read_file":
            return self._read_file(arguments)
        if tool_name == "write_file":
            return self._write_file(arguments)
        if tool_name == "list_directory":
            return self._list_directory(arguments)
        if tool_name == "http_request":
            return self._http_request(arguments)
        if tool_name == "git":
            return self._git(arguments)
        if tool_name == "docker":
            return self._docker(arguments)
        return {"error": f"Herramienta desconocida: {tool_name}"}

    def _shell(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta comandos shell con allowlist."""
        cmd = str(args.get("cmd", "")).strip()
        if not cmd:
            return {"error": "Comando vacío"}

        lowered = cmd.lower()
        if any(tok in lowered for tok in self.forbidden_tokens):
            return {"error": f"Comando prohibido detectado en: {cmd}"}

        # Extraer el comando base (antes de pipes)
        base_cmd = cmd.split()[0].split("|")[0].strip()
        if base_cmd not in self.allowed_commands:
            allowed = ", ".join(sorted(self.allowed_commands))
            return {"error": f"Comando no permitido: {base_cmd}. Usa solo: {allowed}"}

        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {"error": "Comando excedió 30 segundos"}
        except OSError as e:
            return {"error": f"Error del sistema ejecutando comando: {e}"}

    def _safe_resolve_under_workdir(self, rel_path: str) -> Optional[Path]:
        """Resuelve una ruta relativa y bloquea traversal fuera del work_dir."""
        if not rel_path:
            return None
        full_path = (self.work_dir / rel_path)
        try:
            full_path.resolve().relative_to(self.work_dir.resolve())
        except ValueError:
            return None
        return full_path

    def _read_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Lee el contenido de un archivo de texto."""
        filepath = str(args.get("path", ""))
        full_path = self._safe_resolve_under_workdir(filepath)
        if full_path is None:
            return {"error": f"Path fuera del directorio de trabajo: {filepath}"}
        if not full_path.exists():
            return {"error": f"Archivo no encontrado: {filepath}"}
        if not full_path.is_file():
            return {"error": f"No es un archivo: {filepath}"}

        try:
            content = full_path.read_text(encoding="utf-8")
            return {"content": content, "size": len(content), "lines": len(content.splitlines())}
        except UnicodeDecodeError:
            return {"error": "Archivo no es texto UTF-8 (¿es binario?)"}
        except OSError as e:
            return {"error": f"Error leyendo archivo: {e}"}

    def _write_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Escribe contenido en un archivo (crea o sobreescribe)."""
        filepath = str(args.get("path", ""))
        content = str(args.get("content", ""))

        full_path = self._safe_resolve_under_workdir(filepath)
        if full_path is None:
            return {"error": f"Path fuera del directorio de trabajo: {filepath}"}

        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            return {"success": True, "path": filepath, "bytes_written": len(content.encode("utf-8"))}
        except OSError as e:
            return {"error": f"Error escribiendo archivo: {e}"}

    def _list_directory(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Lista archivos y directorios en una ruta."""
        dirpath = str(args.get("path", "."))
        full_path = self._safe_resolve_under_workdir(dirpath)
        if full_path is None:
            return {"error": f"Path fuera del directorio de trabajo: {dirpath}"}
        if not full_path.exists():
            return {"error": f"Directorio no encontrado: {dirpath}"}
        if not full_path.is_dir():
            return {"error": f"No es un directorio: {dirpath}"}

        try:
            items: List[Dict[str, Any]] = []
            for item in sorted(full_path.iterdir()):
                items.append(
                    {
                        "name": item.name,
                        "type": "dir" if item.is_dir() else "file",
                        "size": item.stat().st_size if item.is_file() else None,
                    }
                )
            return {"path": dirpath, "items": items, "count": len(items)}
        except OSError as e:
            return {"error": f"Error listando directorio: {e}"}

    def _http_request(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Hace peticiones HTTP."""
        method = str(args.get("method", "GET")).upper()
        url = str(args.get("url", ""))
        headers = args.get("headers") or {}
        body = args.get("body")

        if not url:
            return {"error": "URL no especificada"}
        if method not in {"GET", "POST", "PUT", "DELETE", "PATCH"}:
            return {"error": f"Método no soportado: {method}"}

        try:
            resp = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=body if isinstance(body, dict) else None,
                data=body if isinstance(body, str) else None,
                timeout=30,
            )
            try:
                resp_body: Any = resp.json()
            except ValueError:
                resp_body = resp.text
            return {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp_body,
                "success": 200 <= resp.status_code < 300,
            }
        except requests.Timeout:
            return {"error": "Request timeout (30s)"}
        except requests.RequestException as e:
            return {"error": f"Error HTTP: {e}"}

    def _git(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta comandos git permitidos."""
        action = str(args.get("action", ""))
        message = str(args.get("message", ""))
        branch = str(args.get("branch", ""))

        allowed_actions = {"status", "log", "diff", "branch", "add", "commit", "push", "pull", "checkout"}
        if action not in allowed_actions:
            return {"error": f"Acción git no permitida: {action}. Usa: {', '.join(sorted(allowed_actions))}"}

        if action == "status":
            cmd = "git status"
        elif action == "log":
            cmd = "git log --oneline -10"
        elif action == "diff":
            cmd = "git diff"
        elif action == "branch":
            cmd = "git branch"
        elif action == "add":
            files = str(args.get("files", "."))
            cmd = f"git add {files}"
        elif action == "commit":
            if not message:
                return {"error": "commit requiere 'message'"}
            cmd = f'git commit -m "{message}"'
        elif action == "push":
            cmd = f"git push{(' ' + branch) if branch else ''}"
        elif action == "pull":
            cmd = f"git pull{(' ' + branch) if branch else ''}"
        else:  # checkout
            if not branch:
                return {"error": "checkout requiere 'branch'"}
            cmd = f"git checkout {branch}"

        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return {"output": (result.stdout + result.stderr), "returncode": result.returncode, "success": result.returncode == 0}
        except subprocess.TimeoutExpired:
            return {"error": "git excedió 30 segundos"}
        except OSError as e:
            return {"error": f"Error git: {e}"}

    def _docker(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta comandos docker/docker-compose permitidos."""
        action = str(args.get("action", ""))
        service = str(args.get("service", ""))

        allowed_actions = {"ps", "logs", "compose_up", "compose_down", "compose_ps", "compose_logs"}
        if action not in allowed_actions:
            return {"error": f"Acción docker no permitida: {action}. Usa: {', '.join(sorted(allowed_actions))}"}

        if action == "ps":
            cmd = "docker ps"
        elif action == "logs":
            if not service:
                return {"error": "logs requiere 'service'"}
            cmd = f"docker logs {service} --tail 100"
        elif action == "compose_up":
            detach = bool(args.get("detach", True))
            cmd = f"docker-compose up{(' -d' if detach else '')}"
        elif action == "compose_down":
            cmd = "docker-compose down"
        elif action == "compose_ps":
            cmd = "docker-compose ps"
        else:  # compose_logs
            cmd = f"docker-compose logs{(' ' + service) if service else ''} --tail 100"

        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=60,
            )
            return {"output": (result.stdout + result.stderr), "returncode": result.returncode, "success": result.returncode == 0}
        except subprocess.TimeoutExpired:
            return {"error": "docker excedió 60 segundos"}
        except OSError as e:
            return {"error": f"Error docker: {e}"}


# Definición de herramientas para Ollama (JSON Schema)
TOOLS_SCHEMA: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "shell",
            "description": "Ejecuta comandos shell seguros (ls, cat, grep, find, python, npm, etc). NO permite rm, sudo, ni comandos destructivos.",
            "parameters": {
                "type": "object",
                "required": ["cmd"],
                "properties": {
                    "cmd": {"type": "string", "description": "El comando a ejecutar (ej: 'ls -la', 'cat file.txt')"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Lee el contenido de un archivo de texto.",
            "parameters": {
                "type": "object",
                "required": ["path"],
                "properties": {"path": {"type": "string", "description": "Ruta relativa del archivo a leer"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Escribe contenido en un archivo (crea o sobreescribe).",
            "parameters": {
                "type": "object",
                "required": ["path", "content"],
                "properties": {
                    "path": {"type": "string", "description": "Ruta relativa del archivo a escribir"},
                    "content": {"type": "string", "description": "Contenido a escribir en el archivo"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "Lista archivos y directorios en una ruta.",
            "parameters": {
                "type": "object",
                "required": ["path"],
                "properties": {"path": {"type": "string", "description": "Ruta del directorio a listar (usa '.' para el actual)"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "http_request",
            "description": "Realiza peticiones HTTP (GET, POST, etc).",
            "parameters": {
                "type": "object",
                "required": ["method", "url"],
                "properties": {
                    "method": {
                        "type": "string",
                        "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                        "description": "Método HTTP",
                    },
                    "url": {"type": "string", "description": "URL completa (https://...)"},
                    "headers": {"type": "object", "description": "Headers HTTP opcionales"},
                    "body": {"description": "Body de la petición (objeto JSON o string)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git",
            "description": "Ejecuta operaciones git (status, log, diff, add, commit, push, pull, checkout, branch).",
            "parameters": {
                "type": "object",
                "required": ["action"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["status", "log", "diff", "branch", "add", "commit", "push", "pull", "checkout"],
                        "description": "Operación git a realizar",
                    },
                    "message": {"type": "string", "description": "Mensaje de commit (requerido para action='commit')"},
                    "branch": {"type": "string", "description": "Nombre de rama (para push, pull, checkout)"},
                    "files": {"type": "string", "description": "Archivos a agregar (para action='add', default='.')"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "docker",
            "description": "Ejecuta operaciones docker y docker-compose (ps, logs, compose_up, compose_down, etc).",
            "parameters": {
                "type": "object",
                "required": ["action"],
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["ps", "logs", "compose_up", "compose_down", "compose_ps", "compose_logs"],
                        "description": "Operación docker a realizar",
                    },
                    "service": {"type": "string", "description": "Nombre del servicio/contenedor (para logs)"},
                    "detach": {"type": "boolean", "description": "Ejecutar en background (para compose_up, default=true)"},
                },
            },
        },
    },
]
