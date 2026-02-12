"""
Peanut Agent - Local AI agent system with tool calling.

Makes small language models (7B-14B) work as powerful agents
by combining Ollama with validated tool calling, caching,
and enriched context.
"""

__version__ = "2.0.0"

from peanut_agent.agent import PeanutAgent
from peanut_agent.config import AgentConfig

__all__ = ["PeanutAgent", "AgentConfig", "__version__"]
