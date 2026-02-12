# Contributing to Peanut Agent

## Setup

```bash
git clone https://github.com/smouj/PEANUT-AGENT
cd PEANUT-AGENT
pip install -e ".[dev]"
```

## Development workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run tests: `pytest`
4. Run lint: `ruff check src/ tests/`
5. Verify no `shell=True`: `grep -rn "shell=True" src/`
6. Commit and push
7. Open a pull request

## Security rules

- **Never use `shell=True`** in subprocess calls. All commands must use argument lists.
- New tools must validate inputs and enforce path traversal protection.
- New shell commands must be added to the allowlist in `config.py`.

## Testing

All tests must pass without Ollama running. Use `unittest.mock.patch` to mock HTTP calls to the Ollama API.

```bash
pytest --cov=peanut_agent --cov-report=term
```
