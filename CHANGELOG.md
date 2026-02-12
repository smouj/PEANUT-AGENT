# Changelog

## v2.0.0 - 2026-02-12

Complete rewrite of the agent system.

### Security
- Eliminated all `shell=True` usage — all subprocess calls use argument lists
- Fixed command injection vulnerabilities in git and docker tools
- Added forbidden pattern detection (rm -rf, sudo, eval, | bash, etc.)
- CI pipeline includes automated `shell=True` detection

### Architecture
- New `src/peanut_agent/` package structure with proper Python packaging
- Modern `pyproject.toml` replacing `setup.py`
- Immutable dataclass configuration with environment variable support
- Modular tools system (executor + schemas separated)

### Features
- SQLite-based response cache with TTL expiry and hit/miss statistics
- Rich CLI with interactive mode, single-command mode, and preflight checks
- System prompt for better tool-calling behavior
- Preflight check to verify Ollama connectivity before running

### Testing
- 69 tests covering agent, executor, cache, and config
- All tests run without Ollama (mocked HTTP)
- Path traversal, command injection, and forbidden pattern tests

### Removed
- Old flat file structure (agent.py, tools.py, config.py in root)
- Broken `src/agentlow/` package that never worked
- References to non-existent features (plugins, streaming, web scraping, SSH, database)

## v1.0.0

- Initial version with basic tool calling via Ollama
- Core tools: shell, files, http, git, docker
