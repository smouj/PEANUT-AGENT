from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional

import requests
from pydantic import BaseModel, Field, ValidationError


class PeanutReflection(BaseModel):
    """Resultado de reflexión tras ejecutar una herramienta."""

    success: bool
    analysis: str
    peanuts_earned: int = Field(ge=0, le=1)
    next_action: Literal["retry", "finalize"]
    improved_input: Optional[str] = None


@dataclass(frozen=True)
class _OllamaCfg:
    host: str
    model: str
    timeout_s: int


def _cfg() -> _OllamaCfg:
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("PEANUT_REFLECTION_MODEL", os.environ.get("PEANUT_MODEL", "qwen2.5:7b"))
    timeout_s = int(os.environ.get("PEANUT_OLLAMA_TIMEOUT", "30"))
    return _OllamaCfg(host=host, model=model, timeout_s=timeout_s)


def _ollama_chat(messages: list[dict[str, Any]], *, model: str, host: str, timeout_s: int) -> str:
    """Llama a Ollama /api/chat y devuelve el contenido de la respuesta (string)."""
    url = f"{host}/api/chat"
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        # Si tu Ollama soporta format=json ayuda a forzar JSON limpio.
        "format": "json",
        "options": {"temperature": 0.0},
    }

    r = requests.post(url, json=payload, timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    msg = data.get("message") or {}
    return str(msg.get("content", "")).strip()


def _extract_first_json_object(text: str) -> Optional[str]:
    """Extrae el primer objeto JSON {...} con llaves balanceadas, ignorando strings.

    Evita regex recursiva (Python re NO soporta (?R)).
    """
    if not text:
        return None

    start = text.find("{")
    if start == -1:
        return None

    in_str = False
    esc = False
    depth = 0
    begin = None

    for i in range(start, len(text)):
        ch = text[i]

        if in_str:
            if esc:
                esc = False
                continue
            if ch == "\\":
                esc = True
                continue
            if ch == '"':
                in_str = False
            continue

        # fuera de string
        if ch == '"':
            in_str = True
            continue

        if ch == "{":
            if depth == 0:
                begin = i
            depth += 1
            continue

        if ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and begin is not None:
                    candidate = text[begin : i + 1].strip()
                    # Validación rápida: ¿es JSON parseable?
                    try:
                        json.loads(candidate)
                        return candidate
                    except json.JSONDecodeError:
                        # seguimos buscando otro objeto posible
                        begin = None
                        continue

    return None


def _parse_reflection_json(raw: str) -> Optional[PeanutReflection]:
    """Intenta parsear el JSON estricto o extraído de un texto sucio."""
    raw = (raw or "").strip()
    if not raw:
        return None

    # 1) intento directo
    try:
        return PeanutReflection.model_validate_json(raw)
    except Exception:
        pass

    # 2) extraer primer objeto JSON
    candidate = _extract_first_json_object(raw)
    if not candidate:
        return None

    try:
        return PeanutReflection.model_validate_json(candidate)
    except ValidationError:
        return None
    except Exception:
        return None


def reflect_on_result(tool_name: str, user_input: str, tool_output: str) -> PeanutReflection:
    """Genera una reflexión (audit) sobre el resultado de una herramienta.

    - Si Ollama está disponible: pide JSON estricto y lo valida con Pydantic.
    - Si Ollama NO está disponible: devuelve un fallback útil (no rompe el gateway).
    """
    tool_name = str(tool_name or "").strip() or "unknown_tool"
    user_input = str(user_input or "")
    tool_output = str(tool_output or "")

    cfg = _cfg()

    system = (
        "Eres un auditor de calidad extremadamente estricto.\n"
        "Tu tarea: evaluar si la ejecución de una herramienta fue exitosa.\n"
        "Responde SIEMPRE en JSON válido que cumpla EXACTAMENTE este esquema:\n"
        "{\n"
        '  "success": true|false,\n'
        '  "analysis": "string (breve)",\n'
        '  "peanuts_earned": 0|1,\n'
        '  "next_action": "retry"|"finalize",\n'
        '  "improved_input": "string opcional"\n'
        "}\n"
        "Reglas:\n"
        "- Si el output contiene error, está vacío o es inútil => success=false, peanuts_earned=0, next_action=retry.\n"
        '- improved_input debe sugerir un ajuste concreto (idealmente parámetros JSON) para reintentar.\n'
        "- Si es correcto => success=true, peanuts_earned=1, next_action=finalize.\n"
        "NO incluyas texto fuera del JSON."
    )

    user = (
        f"Herramienta: {tool_name}\n\n"
        f"Input del usuario:\n{user_input}\n\n"
        f"Output de la herramienta:\n{tool_output}\n"
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    # Intento con Ollama
    try:
        raw = _ollama_chat(messages, model=cfg.model, host=cfg.host, timeout_s=cfg.timeout_s)
        parsed = _parse_reflection_json(raw)
        if parsed:
            # Normalización mínima
            if parsed.success:
                parsed.peanuts_earned = 1
                parsed.next_action = "finalize"
                parsed.improved_input = None
            else:
                parsed.peanuts_earned = 0
                if not parsed.improved_input:
                    parsed.improved_input = user_input
            return parsed

        # Si Ollama respondió algo no parseable, fallback
        return PeanutReflection(
            success=False,
            analysis="Respuesta de reflexión no fue JSON válido. Se sugiere reintentar con input más simple.",
            peanuts_earned=0,
            next_action="retry",
            improved_input=user_input,
        )

    except requests.RequestException as e:
        # Ollama no disponible / conexión rechazada
        return PeanutReflection(
            success=False,
            analysis=f"Ollama no disponible para reflexión ({e.__class__.__name__}). El gateway puede iniciar igualmente.",
            peanuts_earned=0,
            next_action="finalize",
            improved_input=None,
        )
