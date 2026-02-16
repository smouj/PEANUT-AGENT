"""
Setup para instalación con pip (opcional).
Recomendación: si no quieres instalar, ejecuta directamente:
  python wizard.py
  python gateway.py
  python web_ui.py
"""

from pathlib import Path

from setuptools import setup

this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding="utf-8")

setup(
    name="peanut-agent-pro",
    version="0.1.0",
    author="Smouj + Peanut Agent",
    description="🥜 PEANUT-AGENT PRO — Ollama + Tool Calling + Reflection + Memory + Gateway UI",
    long_description=long_description,
    long_description_content_type="text/markdown",
    python_requires=">=3.10",
    install_requires=[
        "requests>=2.31.0",
        "pydantic>=2.4.0",
        "rich>=13.6.0",
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "websockets>=12.0",
    ],
    py_modules=[
        "agent",
        "tools",
        "reflection",
        "memory",
        "wizard",
        "gateway",
        "web_ui",
        "peanut",
    ],
    package_data={"": ["web/index.html", "docs/*.md", "scripts/*"]},
    include_package_data=True,
    entry_points={
        "console_scripts": [
            "peanut=peanut:main",
            "peanut-wizard=wizard:run_wizard",
        ]
    },
    license="MIT",
)
