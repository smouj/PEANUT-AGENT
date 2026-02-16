"""Compat shim: reflection.py

Los tests existentes importan ``reflection`` desde la raíz del repo.
Para mantener compatibilidad, este archivo re-exporta la implementación real
ubicada en ``agentlow.reflection``.

✅ Fix CI: evita regex recursivas no soportadas por Python (``(?R)``).
"""

from __future__ import annotations

from agentlow.reflection import OllamaClient, PeanutReflection, reflect_on_result

__all__ = [
    "PeanutReflection",
    "OllamaClient",
    "reflect_on_result",
]
