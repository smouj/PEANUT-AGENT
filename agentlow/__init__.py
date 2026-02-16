"""🥜 agentlow

Paquete principal para AgentLow/Peanut-Agent.

Este paquete existe para:
- Exponer una API importable estable (p.ej. ``from agentlow.agent import OllamaAgent``)
- Permitir instalación editable vía ``pip install -e .``

Nota: mantenemos compatibilidad con scripts en raíz (agent.py, tools.py, etc.),
pero el camino recomendado es importar desde ``agentlow``.
"""

from __future__ import annotations

__all__ = [
    "OllamaAgent",
]

from .agent import OllamaAgent
