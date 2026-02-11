# ⚡ Quick Start - 5 minutos al agente funcionando

## 🚀 Instalación Ultra-Rápida

```bash
# 1. Ejecuta el setup automático
python3 setup.py

# 2. ¡Listo! Ya puedes usar el agente
python3 agent.py
```

## 💡 Tu primer comando (en 30 segundos)

```python
from agent import OllamaAgent

agent = OllamaAgent()
response = agent.run("Lista los archivos de este directorio")
print(response)
```

## 🎯 Los 3 casos de uso más comunes

### 1️⃣ Automatizar tareas repetitivas

```python
agent.run("""
1. Lista todos los archivos .py
2. Para cada uno, cuenta las líneas
3. Guarda el resultado en code_stats.txt
""")
```

### 2️⃣ Trabajar con Git

```python
agent.run("""
1. Muestra el estado de git
2. Si hay cambios, haz commit con mensaje "Update code"
3. Haz push a la rama main
""")
```

### 3️⃣ Consultar APIs

```python
agent.run("""
1. Haz GET a https://api.github.com/users/octocat
2. Guarda la respuesta en user_info.json
3. Muéstrame el nombre y número de repos públicos
""")
```

## ⚙️ Configuración Mínima

```python
from agent import OllamaAgent

# Básico (usa defaults)
agent = OllamaAgent()

# Personalizado
agent = OllamaAgent(
    model="qwen2.5:7b",      # Tu modelo
    temperature=0.0,          # 0 = preciso, 0.7 = creativo
    work_dir="/ruta/proyecto", # Directorio de trabajo
    max_iterations=10         # Límite de pasos
)
```

## 🛠️ Las 7 herramientas disponibles

| Herramienta | Para qué sirve | Ejemplo |
|-------------|----------------|---------|
| `shell` | Ejecutar comandos | `ls`, `grep`, `python script.py` |
| `read_file` | Leer archivos | Lee `config.json` |
| `write_file` | Escribir archivos | Crea `output.txt` |
| `list_directory` | Listar directorios | Lista archivos en `./src` |
| `http_request` | Peticiones HTTP | GET a una API |
| `git` | Operaciones Git | `status`, `commit`, `push` |
| `docker` | Docker/Compose | `ps`, `logs`, `up` |

## 🔥 Comandos útiles

```bash
# Modo interactivo (chat)
python3 agent.py

# Ver ejemplos
python3 examples.py

# Verificar instalación
python3 setup.py

# Instalar dependencias
pip install -r requirements.txt

# Descargar modelo recomendado
ollama pull qwen2.5:7b
```

## 🐛 Solución rápida de problemas

### ❌ Error: "Connection refused"
```bash
# Inicia Ollama
ollama serve
```

### ❌ Error: "Model not found"
```bash
# Descarga el modelo
ollama pull qwen2.5:7b
```

### ❌ El agente no hace lo que pido
- Usa temperatura 0.0 para tareas operativas
- Sé más específico en las instrucciones
- Divide tareas complejas en pasos

## 📊 Modelos recomendados (de mejor a más rápido)

```bash
# Mejor calidad (si tienes 16GB+ RAM)
ollama pull qwen2.5:14b

# Equilibrado (recomendado - 8GB RAM)
ollama pull qwen2.5:7b

# Más rápido (4GB RAM)
ollama pull llama3.2:3b
```

## 💪 Ejemplo completo (copy-paste)

```python
from agent import OllamaAgent

# Crear agente
agent = OllamaAgent(model="qwen2.5:7b")

# Tarea compleja
response = agent.run("""
Analiza este proyecto Python:

1. Lista todos los archivos .py
2. Lee requirements.txt si existe
3. Muestra el último commit de git
4. Crea un archivo PROJECT_INFO.md con:
   - Número de archivos Python
   - Dependencias principales
   - Último commit
   - Tu evaluación del proyecto
""")

print(response)
```

## 🎓 Mejores prácticas (en 3 líneas)

1. **Temperatura 0** para operaciones, 0.3 para creatividad
2. **Instrucciones claras**: "Lista archivos .py" > "Mira los archivos"
3. **Divide y vencerás**: Tareas complejas en pasos

## 📚 Más información

- **README.md** → Documentación completa
- **examples.py** → 9 ejemplos avanzados
- **tools.py** → Código de las herramientas
- **agent.py** → Código del agente

## 🆘 Ayuda

```bash
# En Python
from agent import OllamaAgent
help(OllamaAgent)

# Ver historial de conversación
agent.get_history()

# Reset del agente
agent.reset()

# Modo verbose (ver qué hace)
agent.run("tu comando", verbose=True)
```

---

**¿Listo?** Ejecuta `python3 agent.py` y empieza a usar el agente! 🚀
