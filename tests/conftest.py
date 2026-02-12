"""Shared test fixtures for Peanut Agent."""

import pytest

from peanut_agent.config import AgentConfig
from peanut_agent.tools.executor import ToolExecutor


@pytest.fixture
def tmp_config(tmp_path):
    """AgentConfig with work_dir set to a temp directory."""
    return AgentConfig(
        work_dir=str(tmp_path),
        cache_dir=str(tmp_path / ".cache"),
        model="test-model",
        ollama_url="http://localhost:11434",
    )


@pytest.fixture
def executor(tmp_config):
    """ToolExecutor using temp directory as workspace."""
    return ToolExecutor(tmp_config)
