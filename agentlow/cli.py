"""agentlow.cli

CLI mínima para ejecutar el agente en modo interactivo.

Entry point (setup.py): ``agentlow=agentlow.cli:main``.
"""

from __future__ import annotations

import argparse

from .agent import OllamaAgent


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentlow", description="🥜 AgentLow/Peanut-Agent (CLI)")
    parser.add_argument("--model", default="qwen2.5:7b", help="Modelo Ollama (ej: qwen2.5:7b)")
    parser.add_argument("--ollama-url", default="http://localhost:11434", help="URL de Ollama")
    parser.add_argument("--work-dir", default=None, help="Directorio de trabajo")
    parser.add_argument("--temperature", type=float, default=0.0, help="Temperatura")
    parser.add_argument("--max-iterations", type=int, default=10, help="Máx iteraciones")
    args = parser.parse_args()

    agent = OllamaAgent(
        model=args.model,
        ollama_url=args.ollama_url,
        work_dir=args.work_dir,
        temperature=args.temperature,
        max_iterations=args.max_iterations,
    )

    print("🥜 AgentLow CLI — modo interactivo")
    print("Escribe 'salir' para terminar")

    while True:
        try:
            prompt = input("\n👤 Tú: ").strip()
            if not prompt:
                continue
            if prompt.lower() in {"salir", "exit", "quit"}:
                print("👋 ¡Hasta luego!")
                return
            reply = agent.chat(prompt, verbose=False)
            print(f"\n🤖 Agente: {reply}")
        except KeyboardInterrupt:
            print("\n👋 ¡Hasta luego!")
            return


if __name__ == "__main__":
    main()
