"""
Secure tool executor for Peanut Agent.

Key security properties:
- NO shell=True anywhere - all subprocess calls use argument lists
- Path traversal prevention on every file operation
- Allowlist-based command validation
- Forbidden pattern detection
- Timeouts on all external calls
"""

import json
import logging
import shlex
import subprocess
from pathlib import Path
from typing import Any

import requests

from peanut_agent.config import AgentConfig

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes agent tools with security validation."""

    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.work_dir = Path(config.work_dir).resolve()
        self.work_dir.mkdir(parents=True, exist_ok=True)

    # -- Public dispatch --

    def execute(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Dispatch a tool call and return the result dict."""
        handler = {
            "shell": self._shell,
            "read_file": self._read_file,
            "write_file": self._write_file,
            "list_directory": self._list_directory,
            "http_request": self._http_request,
            "git": self._git,
            "docker": self._docker,
        }.get(tool_name)

        if handler is None:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return handler(arguments)
        except Exception as exc:
            logger.exception("Tool %s failed", tool_name)
            return {"error": f"{tool_name} failed: {exc}"}

    # -- Path safety --

    def _safe_path(self, relative: str) -> Path:
        """Resolve a relative path and verify it stays inside work_dir.

        Raises ValueError on traversal attempts.
        """
        if not relative:
            raise ValueError("Path must not be empty")

        resolved = (self.work_dir / relative).resolve()
        # Ensure the resolved path is inside work_dir
        try:
            resolved.relative_to(self.work_dir)
        except ValueError as err:
            raise ValueError(
                f"Path traversal blocked: '{relative}' resolves outside workspace"
            ) from err
        return resolved

    # -- Shell --

    def _validate_command(self, cmd_string: str) -> list[str]:
        """Parse and validate a shell command string.

        Returns the argument list for subprocess.run.
        Raises ValueError if the command is not allowed.
        """
        if not cmd_string.strip():
            raise ValueError("Empty command")

        # Check forbidden patterns BEFORE parsing
        cmd_lower = cmd_string.lower()
        for pattern in self.config.forbidden_patterns:
            if pattern in cmd_lower:
                raise ValueError(f"Forbidden pattern detected: '{pattern}'")

        # Parse into tokens safely
        try:
            tokens = shlex.split(cmd_string)
        except ValueError as exc:
            raise ValueError(f"Malformed command: {exc}") from exc

        if not tokens:
            raise ValueError("Empty command after parsing")

        base_cmd = Path(tokens[0]).name  # strip any path prefix
        if base_cmd not in self.config.allowed_commands:
            allowed = ", ".join(sorted(self.config.allowed_commands))
            raise ValueError(
                f"Command '{base_cmd}' not in allowlist. Allowed: {allowed}"
            )

        return tokens

    def _shell(self, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a shell command WITHOUT shell=True."""
        cmd_string = args.get("cmd", "")
        try:
            tokens = self._validate_command(cmd_string)
        except ValueError as exc:
            return {"error": str(exc)}

        try:
            result = subprocess.run(
                tokens,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=self.config.shell_timeout,
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {"error": f"Command timed out after {self.config.shell_timeout}s"}
        except FileNotFoundError:
            return {"error": f"Command not found: {tokens[0]}"}

    # -- File operations --

    def _read_file(self, args: dict[str, Any]) -> dict[str, Any]:
        """Read a text file within the workspace."""
        try:
            full_path = self._safe_path(args.get("path", ""))
        except ValueError as exc:
            return {"error": str(exc)}

        if not full_path.exists():
            return {"error": f"File not found: {args.get('path')}"}
        if not full_path.is_file():
            return {"error": f"Not a file: {args.get('path')}"}
        if full_path.stat().st_size > self.config.max_file_size:
            return {"error": f"File exceeds {self.config.max_file_size} byte limit"}

        try:
            content = full_path.read_text(encoding="utf-8")
            return {
                "content": content,
                "size": len(content),
                "lines": content.count("\n") + (1 if content and not content.endswith("\n") else 0),
            }
        except UnicodeDecodeError:
            return {"error": "File is not valid UTF-8 text (binary file?)"}

    def _write_file(self, args: dict[str, Any]) -> dict[str, Any]:
        """Write content to a file within the workspace."""
        try:
            full_path = self._safe_path(args.get("path", ""))
        except ValueError as exc:
            return {"error": str(exc)}

        content = args.get("content", "")

        full_path.parent.mkdir(parents=True, exist_ok=True)
        encoded = content.encode("utf-8")

        if len(encoded) > self.config.max_file_size:
            return {"error": f"Content exceeds {self.config.max_file_size} byte limit"}

        full_path.write_text(content, encoding="utf-8")
        return {
            "success": True,
            "path": str(args.get("path")),
            "bytes_written": len(encoded),
        }

    def _list_directory(self, args: dict[str, Any]) -> dict[str, Any]:
        """List files and directories within the workspace."""
        try:
            full_path = self._safe_path(args.get("path", "."))
        except ValueError as exc:
            return {"error": str(exc)}

        if not full_path.exists():
            return {"error": f"Directory not found: {args.get('path')}"}
        if not full_path.is_dir():
            return {"error": f"Not a directory: {args.get('path')}"}

        items = []
        for item in sorted(full_path.iterdir()):
            entry = {
                "name": item.name,
                "type": "dir" if item.is_dir() else "file",
            }
            if item.is_file():
                entry["size"] = item.stat().st_size
            items.append(entry)

        return {
            "path": str(args.get("path", ".")),
            "items": items,
            "count": len(items),
        }

    # -- HTTP --

    def _http_request(self, args: dict[str, Any]) -> dict[str, Any]:
        """Make an HTTP request."""
        method = args.get("method", "GET").upper()
        url = args.get("url", "")
        headers = args.get("headers", {})
        body = args.get("body")

        if not url:
            return {"error": "URL is required"}

        valid_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"}
        if method not in valid_methods:
            allowed = ", ".join(sorted(valid_methods))
            return {"error": f"Unsupported method: {method}. Use: {allowed}"}

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=body if isinstance(body, dict) else None,
                data=body if isinstance(body, str) else None,
                timeout=self.config.http_timeout,
            )

            try:
                response_body = response.json()
            except (json.JSONDecodeError, ValueError):
                response_body = response.text[:5000]  # truncate large responses

            return {
                "status_code": response.status_code,
                "body": response_body,
                "success": 200 <= response.status_code < 300,
            }
        except requests.Timeout:
            return {"error": f"Request timed out after {self.config.http_timeout}s"}
        except requests.ConnectionError:
            return {"error": f"Connection failed: {url}"}
        except requests.RequestException as exc:
            return {"error": f"HTTP error: {exc}"}

    # -- Git (safe, no shell=True) --

    _GIT_ALLOWED_ACTIONS = frozenset({
        "status", "log", "diff", "branch", "add",
        "commit", "push", "pull", "checkout", "stash",
        "fetch", "remote", "tag",
    })

    def _git(self, args: dict[str, Any]) -> dict[str, Any]:
        """Execute git operations using argument lists (no shell)."""
        action = args.get("action", "")
        if action not in self._GIT_ALLOWED_ACTIONS:
            return {
                "error": f"Git action not allowed: {action}. "
                f"Allowed: {', '.join(sorted(self._GIT_ALLOWED_ACTIONS))}"
            }

        cmd = self._build_git_command(action, args)
        if isinstance(cmd, dict):
            return cmd  # error dict

        try:
            result = subprocess.run(
                cmd,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=self.config.git_timeout,
            )
            return {
                "output": (result.stdout + result.stderr).strip(),
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {"error": f"Git command timed out after {self.config.git_timeout}s"}
        except FileNotFoundError:
            return {"error": "git is not installed or not in PATH"}

    def _build_git_command(
        self, action: str, args: dict[str, Any]
    ) -> list[str] | dict[str, Any]:
        """Build a safe git argument list. Returns error dict on validation failure."""
        message = args.get("message", "")
        branch = args.get("branch", "")
        files = args.get("files", ".")

        if action == "status":
            return ["git", "status", "--short"]
        elif action == "log":
            return ["git", "log", "--oneline", "-10"]
        elif action == "diff":
            return ["git", "diff"]
        elif action == "branch":
            return ["git", "branch"]
        elif action == "add":
            return ["git", "add", files]
        elif action == "commit":
            if not message:
                return {"error": "commit requires a 'message' argument"}
            return ["git", "commit", "-m", message]
        elif action == "push":
            cmd = ["git", "push"]
            if branch:
                cmd.extend(["origin", branch])
            return cmd
        elif action == "pull":
            cmd = ["git", "pull"]
            if branch:
                cmd.extend(["origin", branch])
            return cmd
        elif action == "checkout":
            if not branch:
                return {"error": "checkout requires a 'branch' argument"}
            return ["git", "checkout", branch]
        elif action == "stash":
            return ["git", "stash"]
        elif action == "fetch":
            cmd = ["git", "fetch"]
            if branch:
                cmd.extend(["origin", branch])
            return cmd
        elif action == "remote":
            return ["git", "remote", "-v"]
        elif action == "tag":
            return ["git", "tag"]

        return {"error": f"Unhandled git action: {action}"}

    # -- Docker (safe, no shell=True) --

    _DOCKER_ALLOWED_ACTIONS = frozenset({
        "ps", "logs", "images",
        "compose_up", "compose_down", "compose_ps", "compose_logs",
    })

    def _docker(self, args: dict[str, Any]) -> dict[str, Any]:
        """Execute docker operations using argument lists (no shell)."""
        action = args.get("action", "")
        if action not in self._DOCKER_ALLOWED_ACTIONS:
            return {
                "error": f"Docker action not allowed: {action}. "
                f"Allowed: {', '.join(sorted(self._DOCKER_ALLOWED_ACTIONS))}"
            }

        cmd = self._build_docker_command(action, args)
        if isinstance(cmd, dict):
            return cmd

        try:
            result = subprocess.run(
                cmd,
                cwd=self.work_dir,
                capture_output=True,
                text=True,
                timeout=self.config.docker_timeout,
            )
            return {
                "output": (result.stdout + result.stderr).strip(),
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {"error": f"Docker command timed out after {self.config.docker_timeout}s"}
        except FileNotFoundError:
            return {"error": "docker is not installed or not in PATH"}

    def _build_docker_command(
        self, action: str, args: dict[str, Any]
    ) -> list[str] | dict[str, Any]:
        """Build a safe docker argument list."""
        service = args.get("service", "")

        if action == "ps":
            return ["docker", "ps"]
        elif action == "images":
            return ["docker", "images"]
        elif action == "logs":
            if not service:
                return {"error": "logs requires a 'service' argument"}
            return ["docker", "logs", service, "--tail", "100"]
        elif action == "compose_up":
            detach = args.get("detach", True)
            cmd = ["docker-compose", "up"]
            if detach:
                cmd.append("-d")
            return cmd
        elif action == "compose_down":
            return ["docker-compose", "down"]
        elif action == "compose_ps":
            return ["docker-compose", "ps"]
        elif action == "compose_logs":
            cmd = ["docker-compose", "logs", "--tail", "100"]
            if service:
                cmd.append(service)
            return cmd

        return {"error": f"Unhandled docker action: {action}"}
