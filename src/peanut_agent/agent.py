"""
Core agent implementation for Peanut Agent.

Orchestrates the tool-calling loop: sends messages to Ollama,
parses tool calls, executes them via ToolExecutor, and feeds
results back until the model produces a final answer.
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any

import requests

from peanut_agent.cache.store import CacheStore
from peanut_agent.config import AgentConfig
from peanut_agent.tools.executor import ToolExecutor
from peanut_agent.tools.schemas import TOOLS_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are Peanut Agent, a capable local AI assistant that helps users with \
software engineering, system administration, and automation tasks.

You have access to tools for: shell commands, file I/O, HTTP requests, \
git operations, and docker management. Use them to accomplish the user's \
request step by step.

Guidelines:
- Always use tools when you need to interact with the system.
- Be concise and precise in your responses.
- If a tool call fails, read the error and try an alternative approach.
- Never guess file contents — read them with read_file.
- Prefer list_directory over shell 'ls' for directory listings.
- For git and docker, use the dedicated tools instead of shell commands.
- Only report results you have verified through tool execution.
"""


class PeanutAgent:
    """Agent that uses Ollama with tool calling, validation, and caching."""

    def __init__(
        self,
        model: str | None = None,
        ollama_url: str | None = None,
        work_dir: str | None = None,
        temperature: float | None = None,
        max_iterations: int | None = None,
        cache_enabled: bool | None = None,
        config: AgentConfig | None = None,
    ) -> None:
        # Build config: explicit args > env vars > defaults
        if config is not None:
            self.config = config
        else:
            self.config = AgentConfig.from_env(
                model=model,
                ollama_url=ollama_url,
                work_dir=work_dir,
                temperature=temperature,
                max_iterations=max_iterations,
                cache_enabled=cache_enabled,
            )

        self.executor = ToolExecutor(self.config)

        # Cache
        self._cache: CacheStore | None = None
        if self.config.cache_enabled:
            self._cache = CacheStore(
                cache_dir=self.config.cache_dir,
                ttl_seconds=self.config.cache_ttl_seconds,
            )

        # Conversation history
        self.messages: list[dict[str, Any]] = []

    # -- Public API --

    @property
    def model(self) -> str:
        return self.config.model

    def preflight_check(self) -> dict[str, Any]:
        """Verify Ollama is reachable and the model is available."""
        try:
            resp = requests.get(
                f"{self.config.ollama_url}/api/tags",
                timeout=10,
            )
            resp.raise_for_status()
            tags = resp.json()
            models = [m["name"] for m in tags.get("models", [])]
            model_found = any(
                self.config.model in m for m in models
            )
            return {
                "ollama_reachable": True,
                "model_available": model_found,
                "available_models": models,
            }
        except requests.RequestException as exc:
            return {
                "ollama_reachable": False,
                "model_available": False,
                "error": str(exc),
            }

    def run(self, user_input: str, verbose: bool | None = None) -> str:
        """Execute the agent loop for a user request.

        Returns the model's final text response.
        """
        if verbose is None:
            verbose = self.config.verbose

        # Enrich user message with workspace context
        context = self._get_context()
        enhanced = f"{context}\n\n{user_input}" if context else user_input

        self.messages.append({"role": "user", "content": enhanced})

        for iteration in range(1, self.config.max_iterations + 1):
            if verbose:
                logger.info("Iteration %d/%d", iteration, self.config.max_iterations)

            response = self._call_ollama(self.messages, TOOLS_SCHEMA)

            if "error" in response:
                return f"Error: {response['error']}"

            message = response.get("message", {})

            # No tool calls → final answer
            if not message.get("tool_calls"):
                content = message.get("content", "")
                self.messages.append({"role": "assistant", "content": content})
                return content

            # Process tool calls
            tool_calls = message["tool_calls"]
            if verbose:
                logger.info(
                    "Model requested %d tool(s): %s",
                    len(tool_calls),
                    ", ".join(tc["function"]["name"] for tc in tool_calls),
                )

            self.messages.append({
                "role": "assistant",
                "content": message.get("content", ""),
                "tool_calls": tool_calls,
            })

            for tc in tool_calls:
                result = self._execute_tool_call(tc, verbose)
                self.messages.append({
                    "role": "tool",
                    "content": json.dumps(result, ensure_ascii=False),
                })

        return (
            f"Reached iteration limit ({self.config.max_iterations}) "
            "without a final answer."
        )

    def chat(self, user_input: str, verbose: bool | None = None) -> str:
        """Alias for run() — maintains conversation history."""
        return self.run(user_input, verbose)

    def reset(self) -> None:
        """Clear conversation history."""
        self.messages.clear()

    def get_history(self) -> list[dict[str, Any]]:
        """Return a copy of the message history."""
        return list(self.messages)

    def get_cache_stats(self) -> dict[str, Any]:
        """Return cache statistics, or empty dict if cache is disabled."""
        if self._cache:
            return self._cache.stats()
        return {}

    # -- Internal --

    def _call_ollama(
        self, messages: list[dict], tools: list[dict] | None = None
    ) -> dict[str, Any]:
        """Call the Ollama chat API."""
        # Prepend system message
        all_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ]

        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": all_messages,
            "stream": False,
            "options": {"temperature": self.config.temperature},
        }
        if tools:
            payload["tools"] = tools

        # Check cache
        cache_key = None
        if self._cache and tools:
            cache_key = CacheStore.make_key(self.config.model, all_messages, tools)
            cached = self._cache.get(cache_key)
            if cached is not None:
                logger.info("Cache hit — skipping API call")
                return cached

        try:
            resp = requests.post(
                f"{self.config.ollama_url}/api/chat",
                json=payload,
                timeout=self.config.request_timeout,
            )
            resp.raise_for_status()
            result = resp.json()
        except requests.Timeout:
            return {"error": f"Ollama request timed out after {self.config.request_timeout}s"}
        except requests.ConnectionError:
            return {"error": f"Cannot connect to Ollama at {self.config.ollama_url}"}
        except requests.RequestException as exc:
            return {"error": f"Ollama API error: {exc}"}

        # Store in cache (only cache responses with tool calls for reuse)
        if self._cache and cache_key and result.get("message", {}).get("tool_calls"):
            self._cache.put(cache_key, result)

        return result

    def _execute_tool_call(
        self, tool_call: dict[str, Any], verbose: bool
    ) -> dict[str, Any]:
        """Parse and execute a single tool call."""
        func = tool_call.get("function", {})
        name = func.get("name", "unknown")
        raw_args = func.get("arguments", {})

        # Arguments might be a string (JSON) or already a dict
        if isinstance(raw_args, str):
            try:
                arguments = json.loads(raw_args)
            except json.JSONDecodeError as exc:
                logger.warning("Invalid JSON in tool call %s: %s", name, exc)
                return {
                    "error": (
                        f"Invalid JSON arguments: {exc}. "
                        "Please fix the JSON and retry."
                    )
                }
        else:
            arguments = raw_args

        if verbose:
            preview = json.dumps(arguments, ensure_ascii=False)[:120]
            logger.info("Executing tool: %s(%s)", name, preview)

        result = self.executor.execute(name, arguments)

        if verbose:
            if "error" in result:
                logger.warning("Tool %s error: %s", name, result["error"])
            else:
                logger.info("Tool %s completed successfully", name)

        return result

    def _get_context(self) -> str:
        """Generate workspace context for the LLM."""
        parts = [f"Workspace: {self.config.work_dir}"]

        user = os.getenv("USER") or os.getenv("USERNAME") or "unknown"
        parts.append(f"User: {user}")

        # List visible files (top-level only)
        work_path = Path(self.config.work_dir)
        try:
            entries = sorted(work_path.iterdir())[:15]
            if entries:
                names = ", ".join(e.name for e in entries)
                parts.append(f"Files: {names}")
        except OSError:
            pass

        # Git branch (safe subprocess, no shell=True)
        try:
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=self.config.work_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                parts.append(f"Git branch: {result.stdout.strip()}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        return " | ".join(parts)
