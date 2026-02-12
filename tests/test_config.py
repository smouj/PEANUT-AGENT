"""Tests for AgentConfig."""

import os

import pytest

from peanut_agent.config import AgentConfig


class TestAgentConfigDefaults:
    def test_default_model(self):
        cfg = AgentConfig()
        assert cfg.model == "qwen2.5:7b"

    def test_default_temperature(self):
        cfg = AgentConfig()
        assert cfg.temperature == 0.0

    def test_default_max_iterations(self):
        cfg = AgentConfig()
        assert cfg.max_iterations == 10

    def test_work_dir_defaults_to_cwd(self):
        cfg = AgentConfig()
        assert cfg.work_dir == os.getcwd()

    def test_cache_dir_auto_set(self, tmp_path):
        cfg = AgentConfig(work_dir=str(tmp_path))
        assert cfg.cache_dir == str(tmp_path / ".peanut_cache")


class TestAgentConfigOverrides:
    def test_model_override(self):
        cfg = AgentConfig(model="llama3.2:3b")
        assert cfg.model == "llama3.2:3b"

    def test_temperature_override(self):
        cfg = AgentConfig(temperature=0.5)
        assert cfg.temperature == 0.5

    def test_immutable(self):
        cfg = AgentConfig()
        with pytest.raises(AttributeError):
            cfg.model = "other"


class TestAgentConfigFromEnv:
    def test_env_model(self, monkeypatch):
        monkeypatch.setenv("PEANUT_MODEL", "mistral:7b")
        cfg = AgentConfig.from_env()
        assert cfg.model == "mistral:7b"

    def test_explicit_overrides_env(self, monkeypatch):
        monkeypatch.setenv("PEANUT_MODEL", "mistral:7b")
        cfg = AgentConfig.from_env(model="phi3:mini")
        assert cfg.model == "phi3:mini"

    def test_ollama_url_fallback(self, monkeypatch):
        monkeypatch.setenv("OLLAMA_URL", "http://gpu-server:11434")
        cfg = AgentConfig.from_env()
        assert cfg.ollama_url == "http://gpu-server:11434"


class TestSecurityDefaults:
    def test_allowed_commands_is_frozenset(self):
        cfg = AgentConfig()
        assert isinstance(cfg.allowed_commands, frozenset)
        assert "ls" in cfg.allowed_commands
        assert "python3" in cfg.allowed_commands

    def test_forbidden_patterns_contains_critical(self):
        cfg = AgentConfig()
        assert "rm -rf" in cfg.forbidden_patterns
        assert "sudo" in cfg.forbidden_patterns
        assert "| bash" in cfg.forbidden_patterns
