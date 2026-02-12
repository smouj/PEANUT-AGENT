FROM python:3.11-slim

# Metadatos
LABEL maintainer="AgentLow Pro"
LABEL description="Sistema de agente local con IA avanzado"

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    curl \
    git \
    sqlite3 \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Instalar Ollama (opcional - puede correr en host)
# RUN curl -fsSL https://ollama.com/install.sh | sh

# Crear usuario no-root
RUN useradd -m -u 1000 agentlow

# Directorio de trabajo
WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY src/ ./src/
COPY setup.py .

# Instalar el paquete
RUN pip install -e .

# Cambiar a usuario no-root
USER agentlow

# Crear directorio de trabajo
RUN mkdir -p /home/agentlow/workspace

# Puerto para web UI
EXPOSE 8000

# Comando por defecto
CMD ["python", "-m", "agentlow.cli"]
