# 🤖 Agente Local con Ollama - Sistema Completo

Sistema que hace que **modelos pequeños (7B-8B)** funcionen tan bien como modelos grandes usando tool calling + arquitectura optimizada.

## 🎯 Lo que hace diferente a este sistema

| Problema del modelo pequeño | Solución implementada |
|------------------------------|----------------------|
| Se pierde con muchas herramientas | ✅ Solo 7 herramientas, ultra-claras |
| Rompe el JSON de tool calls | ✅ Validación + auto-corrección |
| No sabe qué archivos existen | ✅ Contexto enriquecido automático |
| Se inventa argumentos | ✅ JSON Schema estricto |
| Es inconsistente | ✅ Temperatura 0 = cero creatividad |

## 📦 Instalación

### 1. Instalar Ollama

```bash
# Linux / WSL
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama
```

### 2. Descargar un modelo

```bash
# Recomendado: Qwen 2.5 (mejor para tool calling)
ollama pull qwen2.5:7b

# Alternativas
ollama pull mistral:7b-instruct
ollama pull llama3.2:3b
```

### 3. Instalar dependencias Python

```bash
pip install requests
```

## 🚀 Uso rápido

### Modo básico (un comando)

```python
from agent import OllamaAgent

# Crear agente
agent = OllamaAgent(model="qwen2.5:7b")

# Ejecutar tarea
response = agent.run("Lista los archivos Python del directorio actual")
print(response)
```

### Modo interactivo (chat)

```bash
python agent.py
```

Esto inicia un chat donde puedes conversar con el agente:

```
👤 Tú: Crea un archivo README.md con un título y descripción del proyecto
🤖 Agente: [ejecuta write_file] ✓ He creado el archivo README.md

👤 Tú: Ahora súbelo a git con el mensaje "Initial commit"
🤖 Agente: [ejecuta git add, git commit] ✓ Commit creado
```

## 🛠️ Herramientas disponibles

### 1. **shell** - Ejecutar comandos seguros

```python
# Ejemplos permitidos
"Lista archivos: ls -la"
"Buscar texto: grep 'error' logs.txt"
"Ejecutar script: python3 script.py"

# ❌ Prohibidos: rm, sudo, shutdown, etc.
```

### 2. **read_file** - Leer archivos

```python
"Lee el contenido de package.json"
"Qué dice el archivo config.py?"
```

### 3. **write_file** - Escribir archivos

```python
"Crea un archivo test.py con un hello world"
"Guarda este JSON en data.json: {...}"
```

### 4. **list_directory** - Listar directorios

```python
"Qué archivos hay en el directorio actual?"
"Lista el contenido de ./src"
```

### 5. **http_request** - Peticiones HTTP

```python
"Haz un GET a https://api.github.com/users/octocat"
"POST a https://httpbin.org/post con body: {\"test\": true}"
```

### 6. **git** - Operaciones Git

```python
"Muestra el estado de git"
"Haz commit de todos los cambios con mensaje 'Update docs'"
"Push a la rama main"
```

### 7. **docker** - Operaciones Docker

```python
"Muestra los contenedores corriendo"
"Levanta docker-compose"
"Muestra los logs del servicio web"
```

## 📚 Ejemplos completos

### Ejemplo 1: Análisis de proyecto

```python
from agent import OllamaAgent

agent = OllamaAgent(model="qwen2.5:7b")

response = agent.run("""
Analiza este proyecto:
1. Lista todos los archivos .py
2. Lee el package.json si existe
3. Muestra el estado de git
4. Dame un resumen del proyecto
""")

print(response)
```

### Ejemplo 2: Automatización de despliegue

```python
agent = OllamaAgent(model="qwen2.5:7b")

response = agent.run("""
Despliega la aplicación:
1. Verifica que no haya cambios sin commitear (git status)
2. Ejecuta los tests (python -m pytest)
3. Si pasan, haz build (npm run build)
4. Levanta docker-compose
5. Verifica que el servicio web esté corriendo
""")

print(response)
```

### Ejemplo 3: Investigación de API

```python
agent = OllamaAgent(model="qwen2.5:7b")

response = agent.run("""
Investiga la API de GitHub:
1. Haz GET a https://api.github.com/repos/anthropics/anthropic-sdk-python
2. Extrae: nombre, estrellas, lenguaje, última actualización
3. Guarda los resultados en github_info.json
""")

print(response)
```

## ⚙️ Configuración avanzada

### Cambiar modelo

```python
agent = OllamaAgent(
    model="mistral:7b-instruct",  # o el que prefieras
    temperature=0.0
)
```

### Ajustar temperatura (creatividad)

```python
# Tareas operativas (default)
agent = OllamaAgent(temperature=0.0)

# Generar código/docs
agent = OllamaAgent(temperature=0.3)

# Brainstorming
agent = OllamaAgent(temperature=0.7)
```

### Cambiar directorio de trabajo

```python
agent = OllamaAgent(work_dir="/home/usuario/proyecto")
```

### Límite de iteraciones

```python
agent = OllamaAgent(max_iterations=20)  # default: 10
```

## 🏗️ Arquitectura del sistema

```
Usuario
  ↓
  input: "Lista archivos Python"
  ↓
┌─────────────────────────────┐
│ OllamaAgent                 │
│ + Contexto enriquecido      │ → "📂 Dir: /home/user, 📄 Archivos: x.py, y.py"
└─────────────────────────────┘
  ↓
┌─────────────────────────────┐
│ Ollama API                  │
│ + JSON Schema (tools)       │ → Modelo propone: shell("ls *.py")
└─────────────────────────────┘
  ↓
┌─────────────────────────────┐
│ ToolExecutor                │
│ + Allowlist validation      │ → ✓ "ls" está permitido
│ + Security checks           │ → ✗ "rm" está prohibido
└─────────────────────────────┘
  ↓
  Ejecuta: subprocess.run("ls *.py")
  ↓
  Resultado: ["script.py", "agent.py"]
  ↓
┌─────────────────────────────┐
│ Validation + Retry          │
│ ¿JSON válido? → Sí ✓        │
│ ¿Error? → Reintentar        │
└─────────────────────────────┘
  ↓
  Respuesta final al usuario
```

## 🔐 Seguridad

### Allowlist de comandos shell

Solo se permiten comandos seguros:
- ✅ Lectura: `ls`, `cat`, `grep`, `find`
- ✅ Desarrollo: `python`, `npm`, `git`, `docker`
- ❌ Prohibidos: `rm`, `sudo`, `shutdown`, `chmod`

### Path traversal protection

Todos los archivos se validan contra el directorio de trabajo:
```python
# ❌ Bloqueado: ../../../etc/passwd
# ✅ Permitido: ./config.json
```

### Timeouts

Todos los comandos tienen timeout:
- Shell: 30 segundos
- HTTP: 30 segundos
- Docker: 60 segundos

## 🐛 Debugging

### Ver qué está haciendo el agente

```python
agent = OllamaAgent(model="qwen2.5:7b")
response = agent.run("tu comando", verbose=True)
```

Output:
```
============================================================
🔄 Iteración 1/10
============================================================
🔧 Herramientas solicitadas: 1

▶️  Ejecutando: shell
   Args: {"cmd": "ls -la"}
   ✓ Resultado: {"stdout": "total 24\n-rw-r--r-- 1..."}

============================================================
✅ Respuesta final:
He listado los archivos...
```

### Ver historial de mensajes

```python
history = agent.get_history()
for msg in history:
    print(f"{msg['role']}: {msg.get('content', 'tool_call')[:50]}")
```

## 🎓 Mejores prácticas

### 1. Tareas específicas y claras

```python
# ❌ Ambiguo
"Haz algo con los archivos"

# ✅ Claro
"Lista todos los archivos .py, lee cada uno, y crea un resumen en summary.txt"
```

### 2. Usar temperatura 0 para operaciones

```python
# Para tareas operativas (archivos, comandos)
agent = OllamaAgent(temperature=0.0)

# Para creatividad (generar código, ideas)
agent = OllamaAgent(temperature=0.3)
```

### 3. Proveer contexto

```python
# ✅ Mejor
"Este es un proyecto Flask. Lista las rutas definidas en app.py y crea documentación en API.md"

# vs
"Lista las rutas"
```

### 4. Verificar resultados intermedios

```python
# El agente puede verificar sus propios pasos
agent.run("""
1. Crea test.txt con contenido "Hello"
2. Lee test.txt para verificar
3. Si está correcto, responde OK
""")
```

## 🔧 Troubleshooting

### Problema: "Error llamando a Ollama"

```bash
# Verificar que Ollama esté corriendo
ollama list

# Iniciar Ollama si no está
ollama serve
```

### Problema: "Modelo no responde"

```bash
# Verificar que el modelo esté descargado
ollama pull qwen2.5:7b

# Probar el modelo manualmente
ollama run qwen2.5:7b "Hola"
```

### Problema: "Tool calling no funciona bien"

1. Usa `qwen2.5:7b` (mejor para tool calling)
2. Temperatura = 0.0
3. Tareas específicas (no ambiguas)

### Problema: "JSONDecodeError"

El sistema tiene auto-corrección, pero si persiste:
- Usa un modelo mejor (qwen2.5:14b)
- Simplifica la tarea
- Reduce número de herramientas simultáneas

## 📊 Comparación de modelos

| Modelo | Tamaño | Tool Calling | Velocidad | RAM |
|--------|--------|--------------|-----------|-----|
| qwen2.5:7b | 7B | ⭐⭐⭐⭐⭐ | Rápido | 8GB |
| qwen2.5:14b | 14B | ⭐⭐⭐⭐⭐ | Medio | 16GB |
| mistral:7b | 7B | ⭐⭐⭐⭐ | Rápido | 8GB |
| llama3.2:3b | 3B | ⭐⭐⭐ | Muy rápido | 4GB |
| phi3:mini | 3.8B | ⭐⭐⭐ | Muy rápido | 4GB |

## 🤝 Contribuir

Puedes añadir más herramientas editando `tools.py`:

```python
def _mi_herramienta(self, args: Dict[str, Any]) -> Dict[str, Any]:
    """Tu herramienta personalizada"""
    # Tu código aquí
    return {"result": "..."}
```

Y agregándola a `TOOLS_SCHEMA` con su JSON Schema.

## 📄 Licencia

MIT

## 🙏 Créditos

Basado en la filosofía de:
- Tool calling de Anthropic
- Guided decoding de vLLM
- Structured outputs de Ollama

---

**¿Preguntas?** Abre un issue o consulta la documentación de [Ollama](https://docs.ollama.com/).
