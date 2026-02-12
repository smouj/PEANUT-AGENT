"""Tests for PeanutAgent — uses mocked HTTP to avoid needing Ollama."""

import json
from unittest.mock import MagicMock, patch

import pytest

from peanut_agent.agent import PeanutAgent
from peanut_agent.config import AgentConfig


@pytest.fixture
def agent(tmp_path):
    config = AgentConfig(
        work_dir=str(tmp_path),
        cache_dir=str(tmp_path / ".cache"),
        model="test-model",
        cache_enabled=False,
    )
    return PeanutAgent(config=config)


@pytest.fixture
def agent_with_cache(tmp_path):
    config = AgentConfig(
        work_dir=str(tmp_path),
        cache_dir=str(tmp_path / ".cache"),
        model="test-model",
        cache_enabled=True,
        cache_ttl_seconds=60,
    )
    return PeanutAgent(config=config)


def _mock_ollama_response(content: str, tool_calls=None):
    """Build a mock Ollama API response."""
    msg = {"content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    return MagicMock(
        status_code=200,
        json=lambda: {"message": msg},
        raise_for_status=lambda: None,
    )


class TestAgentInit:
    def test_default_model(self, agent):
        assert agent.model == "test-model"

    def test_empty_history(self, agent):
        assert agent.get_history() == []

    def test_config_accessible(self, agent):
        assert agent.config.temperature == 0.0


class TestAgentRun:
    @patch("peanut_agent.agent.requests.post")
    def test_simple_response(self, mock_post, agent):
        """Model responds with text, no tool calls."""
        mock_post.return_value = _mock_ollama_response("Hello from agent!")

        result = agent.run("Say hello", verbose=False)
        assert result == "Hello from agent!"
        assert len(agent.get_history()) == 2  # user + assistant

    @patch("peanut_agent.agent.requests.post")
    def test_tool_call_then_response(self, mock_post, agent, tmp_path):
        """Model calls a tool, then produces final answer."""
        # First call: model wants to use list_directory
        tool_response = _mock_ollama_response(
            "",
            tool_calls=[{
                "function": {
                    "name": "list_directory",
                    "arguments": {"path": "."},
                }
            }],
        )
        # Second call: model produces final answer
        final_response = _mock_ollama_response("The directory has 0 files.")

        mock_post.side_effect = [tool_response, final_response]

        result = agent.run("List files", verbose=False)
        assert "0 files" in result
        assert mock_post.call_count == 2

    @patch("peanut_agent.agent.requests.post")
    def test_connection_error(self, mock_post, agent):
        """Handle Ollama not reachable."""
        import requests
        mock_post.side_effect = requests.ConnectionError("refused")

        result = agent.run("hello", verbose=False)
        assert "Cannot connect" in result

    @patch("peanut_agent.agent.requests.post")
    def test_max_iterations(self, mock_post, agent):
        """Detect iteration limit."""
        # Always return tool calls to exhaust iterations
        tool_resp = _mock_ollama_response(
            "",
            tool_calls=[{
                "function": {
                    "name": "list_directory",
                    "arguments": {"path": "."},
                }
            }],
        )
        mock_post.return_value = tool_resp

        result = agent.run("infinite loop", verbose=False)
        assert "iteration limit" in result.lower()


class TestAgentChat:
    @patch("peanut_agent.agent.requests.post")
    def test_history_preserved(self, mock_post, agent):
        mock_post.return_value = _mock_ollama_response("First answer")
        agent.chat("First question", verbose=False)

        mock_post.return_value = _mock_ollama_response("Second answer")
        agent.chat("Second question", verbose=False)

        history = agent.get_history()
        assert len(history) == 4  # 2 user + 2 assistant

    @patch("peanut_agent.agent.requests.post")
    def test_reset_clears_history(self, mock_post, agent):
        mock_post.return_value = _mock_ollama_response("answer")
        agent.chat("question", verbose=False)
        assert len(agent.get_history()) > 0

        agent.reset()
        assert agent.get_history() == []


class TestAgentCache:
    @patch("peanut_agent.agent.requests.post")
    def test_cache_stats_empty_when_disabled(self, mock_post, agent):
        assert agent.get_cache_stats() == {}

    def test_cache_stats_available_when_enabled(self, agent_with_cache):
        stats = agent_with_cache.get_cache_stats()
        assert "hits" in stats
        assert stats["hits"] == 0


class TestPreflight:
    @patch("peanut_agent.agent.requests.get")
    def test_preflight_success(self, mock_get, agent):
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"models": [{"name": "test-model:latest"}]},
            raise_for_status=lambda: None,
        )
        result = agent.preflight_check()
        assert result["ollama_reachable"] is True

    @patch("peanut_agent.agent.requests.get")
    def test_preflight_failure(self, mock_get, agent):
        import requests
        mock_get.side_effect = requests.ConnectionError("refused")
        result = agent.preflight_check()
        assert result["ollama_reachable"] is False


class TestToolCallParsing:
    @patch("peanut_agent.agent.requests.post")
    def test_string_arguments_parsed(self, mock_post, agent, tmp_path):
        """Arguments as JSON string instead of dict."""
        tool_resp = _mock_ollama_response(
            "",
            tool_calls=[{
                "function": {
                    "name": "write_file",
                    "arguments": json.dumps({"path": "test.txt", "content": "ok"}),
                }
            }],
        )
        final_resp = _mock_ollama_response("File written.")
        mock_post.side_effect = [tool_resp, final_resp]

        agent.run("Write a file", verbose=False)
        assert (tmp_path / "test.txt").read_text() == "ok"

    @patch("peanut_agent.agent.requests.post")
    def test_invalid_json_arguments(self, mock_post, agent):
        """Malformed JSON triggers error message, not crash."""
        tool_resp = _mock_ollama_response(
            "",
            tool_calls=[{
                "function": {
                    "name": "shell",
                    "arguments": "{invalid json",
                }
            }],
        )
        final_resp = _mock_ollama_response("Got an error.")
        mock_post.side_effect = [tool_resp, final_resp]

        result = agent.run("broken tool call", verbose=False)
        # Should not crash — agent should recover
        assert isinstance(result, str)
