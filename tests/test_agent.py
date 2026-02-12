import pytest
from agentlow.agent import OllamaAgent
from agentlow.tools import ToolExecutor
from pathlib import Path

@pytest.fixture
def agent(tmp_path):
    return OllamaAgent(
        model="qwen2.5:7b",  # Asume Ollama corriendo en tests
        work_dir=str(tmp_path),
        temperature=0.0
    )

def test_agent_init(agent):
    assert agent.model == "qwen2.5:7b"
    assert len(agent.messages) == 0

def test_tool_executor(tmp_path):
    executor = ToolExecutor(work_dir=str(tmp_path))
    # Test read/write
    write_result = executor.execute_tool("write_file", {"path": "test.txt", "content": "Hello"})
    assert write_result["success"]
    read_result = executor.execute_tool("read_file", {"path": "test.txt"})
    assert read_result["content"] == "Hello"

def test_agent_run_simple(agent):
    response = agent.run("Echo test", verbose=False)
    assert "test" in response.lower()  # Asume modelo responde echo

def test_cache(agent):
    # Asume caché implementado
    first = agent.run("Lista archivos")
    second = agent.run("Lista archivos")
    assert first == second  # Con caché hit

# Más tests para herramientas Pro...
