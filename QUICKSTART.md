# ⚡ QUICKSTART - AgentLow Pro v2.0

> De 0 a agente funcionando en **menos de 5 minutos**

## 🚀 Instalación (30 segundos)

```bash
# Opción 1: Instalación completa
pip install "agentlow-pro[full]"

# Opción 2: Básica (sin scraping ni SSH)
pip install agentlow-pro

# Opción 3: Docker
docker-compose up -d && open http://localhost:8000
```

## ✨ Tu primer agente (60 segundos)

```python
from agentlow import quick_start

# Crear agente
agent = quick_start()

# ¡Usarlo!
response = agent.run("Lista los archivos Python de este directorio")
print(response)
```

**¡Listo!** Ya tienes un agente funcionando 🎉

## 🎯 Casos de Uso Comunes

### 1. Automatizar Tareas Repetitivas

```python
agent.run("""
Automatiza el reporte diario:
1. Lee sales.csv
2. Calcula: total ventas, promedio, producto top
3. Crea DAILY_REPORT.md con los resultados
4. Si hay anomalías, avísame
""")
```

### 2. Trabajar con Git

```python
agent.run("""
Deploy:
1. Verifica git status (debe estar limpio)
2. Run tests
3. Si pasan, haz commit: "Release v2.0"
4. Push a main
""")
```

### 3. Análisis de Datos

```python
agent.run("""
Analiza logs:
1. Lee app.log
2. Cuenta errores por tipo
3. Identifica top 5 errores
4. Crea ERROR_SUMMARY.md
""")
```

### 4. Consultar APIs

```python
agent.run("""
Investigación:
1. GET https://api.github.com/repos/ollama/ollama
2. Extrae: estrellas, forks, issues abiertas
3. Guarda en github_stats.json
4. Compara con el mes pasado
""")
```

### 5. Base de Datos

```python
agent.run("""
Gestiona usuarios:
1. Crea BD users.db
2. Crea tabla: id, name, email, created_at
3. Inserta 3 usuarios de prueba
4. Query: todos los usuarios
5. Muestra resultados
""")
```

## 🎨 Interfaces Disponibles

### CLI Interactivo

```bash
# Modo chat
agentlow

# Comando único
agentlow -c "Analiza este proyecto"

# Con opciones
agentlow -m qwen2.5:14b -t 0.3 --stream
```

### Web UI

```bash
# Iniciar servidor
agentlow-web

# Abrir navegador
open http://localhost:8000
```

### Python API

```python
from agentlow import AgentLowPro

agent = AgentLowPro(
    model="qwen2.5:7b",
    enable_cache=True,      # ← 50x más rápido
    auto_select_model=True  # ← Mejor accuracy
)

response = agent.run("tu tarea")
```

## 🔧 Configuración Básica

```python
from agentlow import AgentLowPro

# Configuración mínima
agent = AgentLowPro()

# Configuración personalizada
agent = AgentLowPro(
    model="qwen2.5:7b",      # Modelo a usar
    temperature=0.0,          # 0=preciso, 1=creativo
    enable_cache=True,        # Caché inteligente
    log_level="INFO"          # Nivel de logging
)
```

## 📊 Herramientas Disponibles

| Tool | Qué hace | Ejemplo |
|------|----------|---------|
| `shell` | Ejecuta comandos | `ls -la`, `python script.py` |
| `read_file` | Lee archivos | `cat config.json` |
| `write_file` | Escribe archivos | Crea `output.txt` |
| `list_directory` | Lista dirs | Lista `./src` |
| `http_request` | Peticiones HTTP | GET/POST APIs |
| `git` | Git operations | status, commit, push |
| `docker` | Docker/Compose | ps, logs, up |
| `database` | SQL queries | CREATE, SELECT, INSERT |
| `ssh` | Comandos remotos | SSH a servidor |
| `web_scrape` | Scraping | Extrae de webs |
| `scheduler` | Tareas programadas | Cron-like |

## 💡 Tips Pro

### 1. Usa Caché para Velocidad

```python
agent = AgentLowPro(enable_cache=True)

# Primera vez: 2s
agent.run("analiza archivos")

# Segunda vez: 0.1s ← ¡20x más rápido!
agent.run("analiza archivos")
```

### 2. Auto-selección para Mejor Accuracy

```python
agent = AgentLowPro(auto_select_model=True)

# El agente elige el mejor modelo para cada tarea:
agent.run("escribe código")    # → CodeLlama
agent.run("lista archivos")    # → Qwen rápido
agent.run("análisis complejo") # → Qwen calidad
```

### 3. Streaming para UX

```python
agent = AgentLowPro(enable_streaming=True)

def mostrar(texto):
    print(texto, end='', flush=True)

agent.run("explica Docker", stream_callback=mostrar)
# D... o... c... k... e... r... [tiempo real!]
```

### 4. Verifica Stats

```python
stats = agent.get_stats()
print(stats)
# {
#   'total_calls': 10,
#   'cache_hits': 5,
#   'cache_hit_rate': '50.0%',
#   'total_tool_calls': 15,
#   'errors': 0
# }
```

## 🐛 Troubleshooting

### Error: "Connection refused"
```bash
# Inicia Ollama
ollama serve
```

### Error: "Model not found"
```bash
# Descarga modelo
ollama pull qwen2.5:7b
```

### Respuestas incorrectas
```python
# Usa temperatura 0 para tareas operativas
agent = AgentLowPro(temperature=0.0)

# O habilita auto-selección
agent = AgentLowPro(auto_select_model=True)
```

### Muy lento
```python
# Habilita caché
agent = AgentLowPro(enable_cache=True)

# O usa modelo más rápido
agent = AgentLowPro(model="llama3.2:3b")
```

## 📚 Próximos Pasos

1. **Lee la documentación completa**: [README.md](README.md)
2. **Explora ejemplos avanzados**: [examples/](examples/)
3. **Crea tus propias herramientas**: [PLUGINS.md](docs/PLUGINS.md)
4. **Despliega en producción**: [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 🎓 Recursos

- 📖 [Documentación completa](README.md)
- 🎥 [Video tutorial](https://youtube.com/agentlow) (próximamente)
- 💬 [Community Discord](https://discord.gg/agentlow) (próximamente)
- 🐛 [Report issues](https://github.com/smouj/AGENTLOW/issues)

## 🆘 ¿Necesitas ayuda?

```python
# En Python
from agentlow import AgentLowPro
help(AgentLowPro)

# O pregúntale al agente
agent = quick_start()
agent.run("¿Cómo puedo usar la herramienta de base de datos?")
```

---

**¿Listo para más?** Revisa el [README completo](README.md) para features avanzadas! 🚀
