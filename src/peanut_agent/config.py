"""
Configuration for Peanut Agent.

Uses Pydantic for validation and environment variable support.
All settings can be overridden via constructor arguments or env vars
prefixed with PEANUT_.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class AgentConfig:
    """Immutable configuration for a Peanut Agent instance."""

    # -- Model --
    model: str = "qwen2.5:7b"
    ollama_url: str = "http://localhost:11434"
    temperature: float = 0.0
    max_iterations: int = 10
    request_timeout: int = 120

    # -- Workspace --
    work_dir: str = ""

    # -- Cache --
    cache_enabled: bool = True
    cache_dir: str = ""
    cache_ttl_seconds: int = 3600

    # -- Timeouts --
    shell_timeout: int = 30
    http_timeout: int = 30
    git_timeout: int = 30
    docker_timeout: int = 60

    # -- Security --
    allowed_commands: frozenset[str] = field(default_factory=lambda: frozenset({
        "ls", "cat", "head", "tail", "grep", "find", "pwd", "whoami",
        "df", "du", "wc", "file", "stat", "tree",
        "python3", "python", "pip", "node", "npm", "npx",
        "git", "docker", "docker-compose",
        "curl", "wget", "ping", "which", "echo", "env", "printenv",
        "date", "uname", "hostname", "sort", "uniq", "cut", "tr",
        "mkdir", "touch", "cp", "mv",
    }))

    forbidden_patterns: frozenset[str] = field(default_factory=lambda: frozenset({
        "rm -rf", "rm -r", "rmdir", "dd ", "mkfs", "fdisk", "format",
        "kill", "killall", "shutdown", "reboot", "halt", "poweroff",
        "sudo", "su ", "chmod", "chown",
        ">/dev/", "| bash", "| sh", "eval ", "exec ",
    }))

    max_file_size: int = 10 * 1024 * 1024  # 10 MB

    # -- Logging --
    verbose: bool = True
    log_level: str = "INFO"

    def __post_init__(self) -> None:
        # Resolve work_dir
        if not self.work_dir:
            object.__setattr__(self, "work_dir", os.getcwd())
        # Resolve cache_dir
        if not self.cache_dir:
            object.__setattr__(
                self, "cache_dir",
                str(Path(self.work_dir) / ".peanut_cache"),
            )

    @classmethod
    def from_env(cls, **overrides) -> "AgentConfig":
        """Create config merging environment variables with explicit overrides.

        Env vars are prefixed with PEANUT_, e.g. PEANUT_MODEL=mistral:7b
        """
        env_map = {
            "model": os.getenv("PEANUT_MODEL"),
            "ollama_url": os.getenv("PEANUT_OLLAMA_URL") or os.getenv("OLLAMA_URL"),
            "temperature": os.getenv("PEANUT_TEMPERATURE"),
            "max_iterations": os.getenv("PEANUT_MAX_ITERATIONS"),
            "work_dir": os.getenv("PEANUT_WORK_DIR") or os.getenv("WORK_DIR"),
            "cache_enabled": os.getenv("PEANUT_CACHE_ENABLED"),
            "verbose": os.getenv("PEANUT_VERBOSE"),
            "log_level": os.getenv("PEANUT_LOG_LEVEL"),
        }

        kwargs = {}
        for key, val in env_map.items():
            if val is not None:
                # Cast to correct type
                field_type = cls.__dataclass_fields__[key].type
                if field_type == "bool":
                    kwargs[key] = val.lower() in ("1", "true", "yes")
                elif field_type == "float":
                    kwargs[key] = float(val)
                elif field_type == "int":
                    kwargs[key] = int(val)
                else:
                    kwargs[key] = val

        # Explicit overrides take priority
        kwargs.update({k: v for k, v in overrides.items() if v is not None})
        return cls(**kwargs)


# Recommended models for reference
RECOMMENDED_MODELS = {
    "excellent": [
        "qwen2.5:7b",
        "qwen2.5:14b",
        "mistral:7b-instruct",
    ],
    "good": [
        "llama3.2:3b",
        "phi3:mini",
        "gemma2:9b",
    ],
    "experimental": [
        "llama3.1:8b",
        "codellama:7b",
    ],
}

TEMPERATURE_PRESETS = {
    "operational": 0.0,
    "creative": 0.3,
    "exploratory": 0.7,
}
