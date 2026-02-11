"""
Agente con Ollama + Tool Calling
Sistema que hace que modelos pequeños funcionen como agentes potentes
"""
import json
import requests
from typing import List, Dict, Any
from tools import ToolExecutor, TOOLS_SCHEMA


class OllamaAgent:
    """Agente que usa Ollama con tool calling + validación + auto-corrección"""
    
    def __init__(
        self,
        model: str = "qwen2.5:7b",
        ollama_url: str = "http://localhost:11434",
        work_dir: str = None,
        temperature: float = 0.0,
        max_iterations: int = 10
    ):
        self.model = model
        self.ollama_url = ollama_url
        self.executor = ToolExecutor(work_dir)
        self.temperature = temperature
        self.max_iterations = max_iterations
        
        # Historial de conversación
        self.messages: List[Dict[str, Any]] = []
    
    def _call_ollama(self, messages: List[Dict], tools: List[Dict] = None) -> Dict:
        """Llama a la API de Ollama"""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": self.temperature
            }
        }
        
        if tools:
            payload["tools"] = tools
        
        try:
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=120
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": f"Error llamando a Ollama: {str(e)}"}
    
    def _get_enriched_context(self) -> str:
        """Genera contexto enriquecido del sistema"""
        import os
        import subprocess
        
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
        except:
            pass
        
        # Git status si existe
        try:
            result = subprocess.run(
                "git status -s",
                shell=True,
                cwd=self.executor.work_dir,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                context_parts.append(f"🔀 Git: {result.stdout.strip()[:100]}")
        except:
            pass
        
        return "\n".join(context_parts)
    
    def run(self, user_input: str, verbose: bool = True) -> str:
        """Ejecuta el agente con el input del usuario"""
        
        # Agregar contexto enriquecido al mensaje del usuario
        context = self._get_enriched_context()
        enhanced_input = f"{context}\n\n{user_input}"
        
        # Agregar mensaje del usuario
        self.messages.append({
            "role": "user",
            "content": enhanced_input
        })
        
        iteration = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            
            if verbose:
                print(f"\n{'='*60}")
                print(f"🔄 Iteración {iteration}/{self.max_iterations}")
                print(f"{'='*60}")
            
            # Llamar a Ollama con herramientas
            response = self._call_ollama(self.messages, TOOLS_SCHEMA)
            
            if "error" in response:
                return f"❌ Error: {response['error']}"
            
            message = response.get("message", {})
            
            # Si el modelo no devolvió tool_calls, es la respuesta final
            if not message.get("tool_calls"):
                final_content = message.get("content", "")
                
                # Agregar a historial
                self.messages.append({
                    "role": "assistant",
                    "content": final_content
                })
                
                if verbose:
                    print(f"\n✅ Respuesta final:\n{final_content}")
                
                return final_content
            
            # El modelo quiere usar herramientas
            tool_calls = message.get("tool_calls", [])
            
            if verbose:
                print(f"\n🔧 Herramientas solicitadas: {len(tool_calls)}")
            
            # Agregar mensaje del asistente con tool_calls
            self.messages.append({
                "role": "assistant",
                "content": message.get("content", ""),
                "tool_calls": tool_calls
            })
            
            # Ejecutar cada herramienta
            for tool_call in tool_calls:
                function_name = tool_call["function"]["name"]
                
                # Validar y parsear argumentos
                try:
                    arguments = json.loads(tool_call["function"]["arguments"])
                except json.JSONDecodeError as e:
                    # Auto-corrección: JSON inválido
                    if verbose:
                        print(f"⚠️  JSON inválido en {function_name}, reintentando...")
                    
                    result = {
                        "error": f"JSON inválido: {str(e)}. Corrige SOLO el JSON, no cambies la herramienta."
                    }
                else:
                    # Ejecutar herramienta
                    if verbose:
                        print(f"\n▶️  Ejecutando: {function_name}")
                        print(f"   Args: {json.dumps(arguments, ensure_ascii=False)[:100]}")
                    
                    result = self.executor.execute_tool(function_name, arguments)
                    
                    if verbose:
                        result_preview = json.dumps(result, ensure_ascii=False)[:200]
                        print(f"   ✓ Resultado: {result_preview}")
                
                # Agregar resultado como mensaje "tool"
                self.messages.append({
                    "role": "tool",
                    "content": json.dumps(result, ensure_ascii=False)
                })
        
        return f"⚠️ Se alcanzó el límite de {self.max_iterations} iteraciones sin respuesta final."
    
    def chat(self, user_input: str, verbose: bool = True) -> str:
        """Modo chat interactivo (mantiene historial)"""
        return self.run(user_input, verbose)
    
    def reset(self):
        """Reinicia el historial de conversación"""
        self.messages = []
    
    def get_history(self) -> List[Dict]:
        """Devuelve el historial de mensajes"""
        return self.messages


def main():
    """Ejemplo de uso del agente"""
    print("🤖 Iniciando agente con Ollama...")
    print("="*60)
    
    # Crear agente
    agent = OllamaAgent(
        model="qwen2.5:7b",  # Cambia por tu modelo
        temperature=0.0,     # Cero creatividad = máxima precisión
        max_iterations=10
    )
    
    # Ejemplo 1: Listar archivos
    print("\n📝 Ejemplo 1: Listar archivos del directorio")
    response = agent.run("Lista los archivos del directorio actual", verbose=True)
    
    print("\n" + "="*60)
    print("💬 Respuesta final:")
    print(response)
    
    # Ejemplo 2: Crear un archivo
    print("\n\n📝 Ejemplo 2: Crear un archivo")
    agent.reset()  # Limpiar historial
    response = agent.run(
        "Crea un archivo llamado 'test.txt' con el contenido 'Hola desde el agente!'",
        verbose=True
    )
    
    print("\n" + "="*60)
    print("💬 Respuesta final:")
    print(response)
    
    # Ejemplo 3: Modo interactivo
    print("\n\n🎮 Modo interactivo")
    print("Escribe 'salir' para terminar")
    print("="*60)
    
    agent.reset()
    
    while True:
        try:
            user_input = input("\n👤 Tú: ").strip()
            
            if user_input.lower() in ["salir", "exit", "quit"]:
                print("👋 ¡Hasta luego!")
                break
            
            if not user_input:
                continue
            
            response = agent.chat(user_input, verbose=False)
            print(f"\n🤖 Agente: {response}")
            
        except KeyboardInterrupt:
            print("\n\n👋 ¡Hasta luego!")
            break
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")


if __name__ == "__main__":
    main()
