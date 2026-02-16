"""agentlow.agent

Agente con Ollama + Tool Calling.

Objetivo: que modelos pequeños (7B) funcionen como agentes potentes usando
arquitectura (tool schemas + validación + bucle de ejecución).

API pública (usada por tests): ``OllamaAgent``.
"""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any, Dict, List, Optional

import requests

from .tools import TOOLS_SCHEMA, ToolExecutor


class OllamaAgent:
    """Agente que usa Ollama con tool calling + validación + auto-corrección."""

    def __init__(
        self,
        model: str = "qwen2.5:7b",
        ollama_url: str = "http://localhost:11434",
        work_dir: Optional[str] = None,
        temperature: float = 0.0,
        max_iterations: int = 10,
    ) -> None:
        self.model = model
        self.ollama_url = ollama_url
        self.executor = ToolExecutor(work_dir)
        self.temperature = float(temperature)
        self.max_iterations = int(max_iterations)

        # Historial de conversación
        self.messages: List[Dict[str, Any]] = []

    def _call_ollama(self, messages: List[Dict[str, Any]], tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Llama a la API de Ollama (/api/chat)."""
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": self.temperature},
        }
        if tools:
            payload["tools"] = tools

        try:
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": f"Error llamando a Ollama: {e}"}

    def _get_enriched_context(self) -> str:
        """Genera contexto enriquecido del sistema (defensivo)."""
        context_parts = [
            f"📂 Directorio actual: {self.executor.work_dir}",
            f"👤 Usuario: {os.getenv('USER', 'unknown')}",
        ]

        # Listar archivos en directorio actual
        try:
            files = list(self.executor.work_dir.iterdir())[:10]
            if files:
                file_list = ", ".join([f.name for f in files])
                context_parts.append(f"📄 Archivos visibles: {file_list}")
        except OSError:
            pass

        # Git status si existe
        try:
            result = subprocess.run(
                "git status -s",
                shell=True,
                cwd=self.executor.work_dir,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                context_parts.append(f"🔀 Git: {result.stdout.strip()[:100]}")
        except (OSError, subprocess.TimeoutExpired):
            pass

        return "\n".join(context_parts)

    def run(self, user_input: str, verbose: bool = True) -> str:
        """Ejecuta el agente con el input del usuario."""
        context = self._get_enriched_context()
        enhanced_input = f"{context}\n\n{user_input}"

        self.messages.append({"role": "user", "content": enhanced_input})

        iteration = 0
        while iteration < self.max_iterations:
            iteration += 1

            if verbose:
                print("\n" + "=" * 60)
                print(f"🔄 Iteración {iteration}/{self.max_iterations}")
                print("=" * 60)

            response = self._call_ollama(self.messages, TOOLS_SCHEMA)
            if "error" in response:
                return f"❌ Error: {response['error']}"

            message = response.get("message", {})

            # Respuesta final
            if not message.get("tool_calls"):
                final_content = str(message.get("content", ""))
                self.messages.append({"role": "assistant", "content": final_content})
                if verbose:
                    print(f"\n✅ Respuesta final:\n{final_content}")
                return final_content

            tool_calls = message.get("tool_calls", [])
            if verbose:
                print(f"\n🔧 Herramientas solicitadas: {len(tool_calls)}")

            self.messages.append(
                {
                    "role": "assistant",
                    "content": str(message.get("content", "")),
                    "tool_calls": tool_calls,
                }
            )

            for tool_call in tool_calls:
                function_name = tool_call["function"]["name"]

                # Validar/parsear argumentos
                raw_args = tool_call["function"].get("arguments", "{}")
                try:
                    arguments = json.loads(raw_args)
                except json.JSONDecodeError as e:
                    if verbose:
                        print(f"⚠️  JSON inválido en {function_name}, reintentando...")
                    result: Dict[str, Any] = {
                        "error": f"JSON inválido: {e}. Corrige SOLO el JSON, no cambies la herramienta.",
                    }
                else:
                    if verbose:
                        print(f"\n▶️  Ejecutando: {function_name}")
                        print(f"   Args: {json.dumps(arguments, ensure_ascii=False)[:100]}")
                    result = self.executor.execute_tool(function_name, arguments)
                    if verbose:
                        print(f"   ✓ Resultado: {json.dumps(result, ensure_ascii=False)[:200]}")

                self.messages.append({"role": "tool", "content": json.dumps(result, ensure_ascii=False)})

        return f"⚠️ Se alcanzó el límite de {self.max_iterations} iteraciones sin respuesta final."

    def chat(self, user_input: str, verbose: bool = True) -> str:
        """Modo chat interactivo (mantiene historial)."""
        return self.run(user_input, verbose)

    def reset(self) -> None:
        """Reinicia el historial de conversación."""
        self.messages = []

    def get_history(self) -> List[Dict[str, Any]]:
        """Devuelve el historial de mensajes."""
        return self.messages


def main() -> None:
    """Ejemplo / CLI mínima."""
    print("🤖 Iniciando agente con Ollama...")
    print("=" * 60)

    agent = OllamaAgent(model="qwen2.5:7b", temperature=0.0, max_iterations=10)

    print("\n🎮 Modo interactivo")
    print("Escribe 'salir' para terminar")
    print("=" * 60)

    agent.reset()
    while True:
        try:
            user_input = input("\n👤 Tú: ").strip()
            if user_input.lower() in {"salir", "exit", "quit"}:
                print("👋 ¡Hasta luego!")
                break
            if not user_input:
                continue
            response = agent.chat(user_input, verbose=False)
            print(f"\n🤖 Agente: {response}")
        except KeyboardInterrupt:
            print("\n\n👋 ¡Hasta luego!")
            break


if __name__ == "__main__":
    main()
