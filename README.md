# Peanut Agent

> Local AI agent with secure tool calling — makes small LLMs work as powerful agents via Ollama

[![CI](https://github.com/smouj/PEANUT-AGENT/actions/workflows/ci.yml/badge.svg)](https://github.com/smouj/PEANUT-AGENT/actions)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)](https://python.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What is this?

Peanut Agent connects to [Ollama](https://ollama.com/) and gives small local models (7B-14B parameters) the ability to use tools — shell commands, file operations, HTTP requests, git, and docker. It includes:

- **Secure execution** — no `shell=True` anywhere; all subprocess calls use argument lists with an allowlist
- **SQLite response cache** — repeated queries return instantly
- **Rich CLI** — interactive chat with status panels
- **69 tests** that pass without needing Ollama running

## Quick start

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/) running locally (or accessible via network)
- A model pulled: `ollama pull qwen2.5:7b`

### Install

```bash
# From source
git clone https://github.com/smouj/PEANUT-AGENT
cd PEANUT-AGENT
pip install -e .

# With development tools
pip install -e ".[dev]"
```

### Run

```bash
# Interactive mode
peanut

# Single command
peanut -c "List all Python files and count lines of code"

# Preflight check (verify Ollama connection)
peanut --check

# With options
peanut -m qwen2.5:14b -t 0.3 -v
```

### Use as a library

```python
from peanut_agent import PeanutAgent

agent = PeanutAgent(model="qwen2.5:7b")
response = agent.run("List files in the current directory")
print(response)
```

## CLI options

```
peanut [-h] [-V] [-m MODEL] [-t TEMP] [-w DIR] [-c CMD] [-v] [--no-cache] [--check]

  -m, --model        Ollama model (default: qwen2.5:7b)
  -t, --temperature  Sampling temperature (default: 0.0)
  -w, --work-dir     Workspace directory (default: cwd)
  -c, --command      Run single command and exit
  -v, --verbose      Show tool execution details
  --no-cache         Disable response caching
  --check            Verify Ollama connectivity and exit
```

## Available tools

The agent has 7 tools it can call:

| Tool | Description |
|------|-------------|
| `shell` | Run allowlisted commands (ls, grep, python, curl, etc.) |
| `read_file` | Read a text file in the workspace |
| `write_file` | Create or overwrite a file |
| `list_directory` | List directory contents |
| `http_request` | Make HTTP requests (GET/POST/PUT/DELETE/PATCH) |
| `git` | Git operations (status, log, diff, add, commit, push, pull, checkout, stash, fetch) |
| `docker` | Docker/Compose operations (ps, logs, images, compose up/down) |

## Security

All command execution uses `subprocess.run` with argument lists — **never** `shell=True`. This prevents shell injection attacks that plague most agent frameworks.

Additional protections:
- **Command allowlist** — only pre-approved commands can run (ls, cat, grep, python, git, docker, etc.)
- **Forbidden pattern detection** — blocks `rm -rf`, `sudo`, `| bash`, `eval`, etc.
- **Path traversal prevention** — file operations are sandboxed to the workspace directory
- **Timeouts** — shell (30s), HTTP (30s), git (30s), docker (60s)

The CI pipeline includes a `security-check` job that greps the source for `shell=True` and fails the build if found.

## Configuration

Settings can be passed via constructor, environment variables, or both:

```python
from peanut_agent import PeanutAgent, AgentConfig

# Via constructor
agent = PeanutAgent(model="mistral:7b", temperature=0.3)

# Via config object
config = AgentConfig(
    model="qwen2.5:14b",
    ollama_url="http://gpu-server:11434",
    max_iterations=15,
    cache_enabled=True,
)
agent = PeanutAgent(config=config)
```

Environment variables (prefix `PEANUT_`):

| Variable | Description |
|----------|-------------|
| `PEANUT_MODEL` | Model name |
| `PEANUT_OLLAMA_URL` | Ollama API URL |
| `PEANUT_TEMPERATURE` | Sampling temperature |
| `PEANUT_WORK_DIR` | Workspace directory |
| `PEANUT_CACHE_ENABLED` | Enable/disable cache (true/false) |
| `PEANUT_LOG_LEVEL` | Logging level (DEBUG/INFO/WARNING/ERROR) |
| `OLLAMA_URL` | Fallback for Ollama URL |

## Recommended models

| Tier | Models |
|------|--------|
| Excellent | `qwen2.5:7b`, `qwen2.5:14b`, `mistral:7b-instruct` |
| Good | `llama3.2:3b`, `phi3:mini`, `gemma2:9b` |
| Experimental | `llama3.1:8b`, `codellama:7b` |

Use temperature `0.0` for tool-calling tasks (maximum precision).

## Project structure

```
src/peanut_agent/
    __init__.py          # Package exports
    agent.py             # Core agent loop + Ollama API client
    config.py            # Immutable dataclass config with env var support
    cli.py               # Rich CLI interface
    tools/
        __init__.py
        executor.py      # Secure tool execution (no shell=True)
        schemas.py       # JSON Schema tool definitions for Ollama
    cache/
        __init__.py
        store.py         # SQLite-based response cache with TTL
tests/
    test_agent.py        # Agent tests (mocked HTTP)
    test_executor.py     # Tool executor tests
    test_cache.py        # Cache tests
    test_config.py       # Config tests
    conftest.py          # Shared fixtures
```

## Docker

```bash
# Start Ollama + Peanut Agent
docker-compose up -d

# Pull a model inside the container
docker exec peanut-ollama ollama pull qwen2.5:7b
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=peanut_agent --cov-report=term

# Lint
ruff check src/ tests/

# Verify security
grep -rn "shell=True" src/  # Should return nothing
```

## License

MIT — see [LICENSE](LICENSE).
