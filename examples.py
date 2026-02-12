"""
Ejemplos avanzados del agente
"""
from agent import OllamaAgent


def ejemplo_analisis_proyecto():
    """Analiza un proyecto completo automáticamente"""
    print("\n" + "="*60)
    print("📊 EJEMPLO 1: Análisis completo de proyecto")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    response = agent.run("""
    Analiza este proyecto y dame un reporte:
    
    1. Lista todos los archivos .py en el directorio actual
    2. Para cada archivo Python, cuenta las líneas de código
    3. Si existe package.json o requirements.txt, léelo
    4. Muestra el estado de git (si es un repo)
    5. Crea un archivo ANALYSIS.md con:
       - Número total de archivos Python
       - Total de líneas de código
       - Dependencias encontradas
       - Estado del repositorio
       - Archivos más grandes
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_ci_cd_pipeline():
    """Simula un pipeline CI/CD"""
    print("\n" + "="*60)
    print("🚀 EJEMPLO 2: Pipeline CI/CD automatizado")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b", temperature=0.0)
    
    response = agent.run("""
    Ejecuta un pipeline de despliegue:
    
    1. Verifica que no haya cambios sin commitear (git status)
    2. Si hay cambios, detente y avisa
    3. Si está limpio, ejecuta: python -m pytest (o similar)
    4. Si los tests pasan:
       - Incrementa la versión en version.txt (o créalo con "1.0.0")
       - Haz git add y commit con mensaje "Bump version"
       - Muestra resumen del despliegue
    5. Si algo falla, explica qué pasó
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_scraping_y_guardado():
    """Obtiene datos de APIs y los guarda"""
    print("\n" + "="*60)
    print("🌐 EJEMPLO 3: Scraping de API + guardado")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    response = agent.run("""
    Investiga repositorios de GitHub:
    
    1. Haz GET a https://api.github.com/users/octocat/repos
    2. De la respuesta, extrae para cada repo:
       - name
       - description
       - language
       - stargazers_count
    3. Ordena los repos por estrellas (mayor a menor)
    4. Guarda el resultado en github_repos.json
    5. Crea también un archivo github_repos.md con formato markdown:
       # Repositorios de octocat
       
       ## [Nombre del repo](url)
       **Lenguaje:** X | **Estrellas:** Y
       Descripción...
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_docker_debugging():
    """Debuggea servicios Docker"""
    print("\n" + "="*60)
    print("🐳 EJEMPLO 4: Debugging de Docker")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    response = agent.run("""
    Diagnostica el estado de Docker:
    
    1. Muestra todos los contenedores (docker ps)
    2. Si hay un servicio llamado 'web', muestra sus logs (últimas 50 líneas)
    3. Verifica si docker-compose.yml existe en el directorio
    4. Si existe, léelo y lista los servicios definidos
    5. Crea un archivo DOCKER_STATUS.md con:
       - Contenedores corriendo
       - Servicios en docker-compose
       - Problemas detectados en logs (si hay errores)
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_refactoring_asistido():
    """Ayuda a refactorizar código"""
    print("\n" + "="*60)
    print("🔧 EJEMPLO 5: Refactoring asistido")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b", temperature=0.2)
    
    response = agent.run("""
    Analiza y mejora el código Python del proyecto:
    
    1. Lista todos los archivos .py
    2. Para cada archivo:
       - Lee el contenido
       - Identifica funciones que tengan más de 50 líneas
       - Identifica imports no usados (búsqueda simple de 'import X' vs uso de X)
    3. Crea un archivo REFACTORING_SUGGESTIONS.md con:
       - Lista de funciones largas (>50 líneas)
       - Imports potencialmente no usados
       - Sugerencias generales (sin reescribir el código)
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_monitoreo_logs():
    """Monitorea y analiza logs"""
    print("\n" + "="*60)
    print("📋 EJEMPLO 6: Análisis de logs")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    response = agent.run("""
    Analiza los logs de la aplicación:
    
    1. Si existe un archivo llamado app.log o similar, léelo
    2. Si no existe, crea un log de ejemplo con:
       2024-01-15 10:30:00 INFO Server started
       2024-01-15 10:30:05 ERROR Database connection failed
       2024-01-15 10:30:10 WARNING Retrying connection
       2024-01-15 10:30:15 INFO Connected to database
       2024-01-15 10:35:00 ERROR Null pointer exception in handler
    3. Analiza el log y extrae:
       - Total de líneas
       - Número de ERRORs
       - Número de WARNINGs
       - Última entrada
    4. Crea LOG_ANALYSIS.md con un resumen
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_multi_paso_complejo():
    """Workflow complejo multi-paso"""
    print("\n" + "="*60)
    print("🎯 EJEMPLO 7: Workflow complejo")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b", max_iterations=15)
    
    response = agent.run("""
    Prepara un reporte completo del proyecto para presentación:
    
    PASO 1: Análisis de código
    - Cuenta archivos .py, .js, .md
    - Calcula líneas totales
    
    PASO 2: Información de git
    - Obtén últimos 5 commits (git log)
    - Identifica autor más activo
    
    PASO 3: Dependencias
    - Lee requirements.txt, package.json, etc.
    - Lista dependencias principales
    
    PASO 4: Estado del proyecto
    - ¿Hay tests? (busca archivos test_*.py)
    - ¿Hay Docker? (busca Dockerfile)
    - ¿Hay CI/CD? (busca .github/workflows)
    
    PASO 5: Crear presentación
    - Crea PROJECT_REPORT.md con:
      # Project Overview
      
      ## Statistics
      - X archivos Python
      - Y líneas de código
      - Z commits en total
      
      ## Recent Activity
      [últimos commits]
      
      ## Dependencies
      [lista de dependencias]
      
      ## Project Health
      - Tests: ✓/✗
      - Docker: ✓/✗
      - CI/CD: ✓/✗
    """)
    
    print("\n✅ Resultado:")
    print(response)


def ejemplo_chat_interactivo():
    """Modo chat con memoria de conversación"""
    print("\n" + "="*60)
    print("💬 EJEMPLO 8: Chat interactivo con memoria")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    # Primera pregunta
    print("\n👤 Usuario: Lista los archivos Python")
    response1 = agent.chat("Lista los archivos Python", verbose=False)
    print(f"🤖 Agente: {response1}")
    
    # Segunda pregunta (con contexto de la primera)
    print("\n👤 Usuario: Ahora lee el primero que encontraste")
    response2 = agent.chat("Ahora lee el primero que encontraste", verbose=False)
    print(f"🤖 Agente: {response2}")
    
    # Tercera pregunta (sigue el contexto)
    print("\n👤 Usuario: Cuántas líneas tiene?")
    response3 = agent.chat("Cuántas líneas tiene?", verbose=False)
    print(f"🤖 Agente: {response3}")


def ejemplo_validacion_y_correccion():
    """Demuestra la auto-corrección de errores"""
    print("\n" + "="*60)
    print("🔄 EJEMPLO 9: Auto-corrección de errores")
    print("="*60)
    
    agent = OllamaAgent(model="qwen2.5:7b")
    
    # El agente debe manejar errores automáticamente
    response = agent.run("""
    Intenta estas operaciones (algunas fallarán a propósito):
    
    1. Lee un archivo que NO existe: "archivo_inexistente.txt"
    2. Cuando falle, crea ese archivo con contenido "test"
    3. Ahora léelo de nuevo
    4. Intenta ejecutar un comando prohibido: "rm -rf /"
    5. Cuando falle, explica por qué está prohibido
    6. Ejecuta un comando permitido: "echo 'Hello World'"
    """)
    
    print("\n✅ Resultado:")
    print(response)


if __name__ == "__main__":
    # Ejecuta todos los ejemplos
    ejemplos = [
        ejemplo_analisis_proyecto,
        ejemplo_ci_cd_pipeline,
        ejemplo_scraping_y_guardado,
        ejemplo_docker_debugging,
        ejemplo_refactoring_asistido,
        ejemplo_monitoreo_logs,
        ejemplo_multi_paso_complejo,
        ejemplo_chat_interactivo,
        ejemplo_validacion_y_correccion,
    ]
    
    print("🎮 Ejemplos disponibles:")
    for i, ejemplo in enumerate(ejemplos, 1):
        print(f"{i}. {ejemplo.__doc__}")
    
    print("\n" + "="*60)
    choice = input("Elige un ejemplo (1-9) o 'all' para todos: ").strip()
    
    if choice.lower() == 'all':
        for ejemplo in ejemplos:
            try:
                ejemplo()
                input("\n⏸️  Presiona Enter para continuar...")
            except KeyboardInterrupt:
                print("\n👋 Interrumpido")
                break
    elif choice.isdigit() and 1 <= int(choice) <= len(ejemplos):
        ejemplos[int(choice) - 1]()
    else:
        print("❌ Opción inválida")
