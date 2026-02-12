FROM python:3.11-slim AS base

LABEL maintainer="smouj"
LABEL description="Peanut Agent - Local AI agent with secure tool calling"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 1000 peanut

WORKDIR /app

# Install Python deps first (better layer caching)
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir .

# Switch to non-root
USER peanut
RUN mkdir -p /home/peanut/workspace

ENV PEANUT_WORK_DIR=/home/peanut/workspace
ENV PEANUT_OLLAMA_URL=http://ollama:11434

ENTRYPOINT ["peanut"]
CMD ["--check"]
