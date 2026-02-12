"""
Setup para instalación con pip
"""
from setuptools import setup, find_packages
from pathlib import Path

# Leer README
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

setup(
    name="agentlow-pro",
    version="2.0.0",
    author="AgentLow Team",
    author_email="info@agentlow.dev",
    description="Sistema de agente local con IA avanzado - Modelos pequeños con capacidades grandes",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/smouj/AGENTLOW",
    project_urls={
        "Bug Tracker": "https://github.com/smouj/AGENTLOW/issues",
        "Documentation": "https://github.com/smouj/AGENTLOW#readme",
        "Source Code": "https://github.com/smouj/AGENTLOW",
    },
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.31.0",
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "websockets>=12.0",
        "pydantic>=2.4.0",
        "rich>=13.6.0",
        "beautifulsoup4>=4.12.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.1.0",
            "black>=23.9.0",
            "ruff>=0.0.290",
            "mypy>=1.5.0",
        ],
        "full": [
            "beautifulsoup4>=4.12.0",
            "selenium>=4.14.0",
            "paramiko>=3.3.0",  # Para SSH
        ],
    },
    entry_points={
        "console_scripts": [
            "agentlow=agentlow.cli:main",
            "agentlow-web=agentlow.web_ui:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
    keywords=[
        "ai", "agent", "llm", "ollama", "tool-calling", 
        "function-calling", "automation", "local-ai"
    ],
)
