"""
Configuración del agente
"""

# =============================================================================
# CONFIGURACIÓN DE MODELOS
# =============================================================================

# Modelos recomendados (de mejor a peor para tool calling)
RECOMMENDED_MODELS = {
    "excellent": [
        "qwen2.5:7b",           # ⭐ Mejor relación calidad/tamaño
        "qwen2.5:14b",          # Aún mejor si tienes RAM
        "mistral:7b-instruct",  # Muy bueno para instrucciones
    ],
    "good": [
        "llama3.2:3b",          # Pequeño pero decente
        "phi3:mini",            # 3.8B, sorprendentemente capaz
        "gemma2:9b",            # Bueno si tienes 16GB+ RAM
    ],
    "experimental": [
        "llama3.1:8b",          # Hit or miss con tool calling
        "codellama:7b",         # Específico para código
    ]
}

# =============================================================================
# PARÁMETROS DE TEMPERATURA
# =============================================================================

TEMPERATURE_SETTINGS = {
    "operational": 0.0,     # Tareas operativas (shell, archivos, git)
    "creative": 0.3,        # Generar código, documentación
    "exploratory": 0.7,     # Brainstorming, ideas
}

# Usa 0.0 para máxima precisión en tool calling
DEFAULT_TEMPERATURE = 0.0

# =============================================================================
# LÍMITES DE SEGURIDAD
# =============================================================================

MAX_ITERATIONS = 10           # Máximo de iteraciones del agent loop
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB máximo por archivo
SHELL_TIMEOUT = 30            # Timeout para comandos shell (segundos)
HTTP_TIMEOUT = 30             # Timeout para HTTP requests (segundos)
DOCKER_TIMEOUT = 60           # Timeout para docker (segundos)

# =============================================================================
# ALLOWLIST DE COMANDOS SHELL (personalizable)
# =============================================================================

# Puedes añadir más comandos aquí si los necesitas
EXTRA_ALLOWED_COMMANDS = [
    # Ejemplo: descomenta si necesitas estos
    # 'make',
    # 'cargo',
    # 'go',
    # 'rustc',
]

# =============================================================================
# DIRECTORIO DE TRABAJO
# =============================================================================

# Por defecto usa el directorio actual, pero puedes fijarlo aquí
# WORK_DIR = "/home/tu_usuario/proyectos"
WORK_DIR = None  # None = usa directorio actual

# =============================================================================
# OLLAMA
# =============================================================================

OLLAMA_URL = "http://localhost:11434"

# =============================================================================
# LOGGING Y DEBUG
# =============================================================================

VERBOSE_DEFAULT = True  # Mostrar detalles de ejecución
SHOW_CONTEXT = True     # Mostrar contexto enriquecido
