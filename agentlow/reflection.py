"""agentlow.reflection

🥜 Peanut Reflection Loop (PRO)

Importante (bugfix CI):
- Python ``re`` NO soporta recursión estilo PCRE ``(?R)``.
- Para extraer JSON "sucio" usamos un parser de llaves balanceadas.

Este módulo:
- define el esquema ``PeanutReflection`` (Pydantic)
- implementa ``reflect_on_result`` que consulta a Ollama y valida JSON
- incluye fallback heurístico cuando Ollama no está disponible
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional

import requests
from pydantic import BaseModel, Field, ValidationError


class PeanutReflection(BaseModel):
    """Resultado estricto de la reflexión."""

    success: bool = Field(..., description="¿La herramienta funcionó?")
    analysis: str = Field(..., min_length=1, description="Crítica breve del resultado.")
    peanuts_earned: int = Field(..., ge=0, le=1, description="1 si éxito, 0 si fallo.")
    next_action: Literal["retry", "finalize"] = Field(..., description="Acción a tomar.")
    improved_input: Optional[str] = Field(
        default=None,
        description="Si next_action=retry, propuesta de argumentos mejorados (idealmente JSON).",
    )


@dataclass(frozen=True)
class OllamaClient:
    """Cliente mínimo para Ollama."""

    ollama_url: str = "http://localhost:11434"
    timeout_s: int = 60

    def chat(self, model: str, messages: list[dict[str, Any]], temperature: float = 0.0) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": float(temperature)},
        }
        resp = requests.post(f"{self.ollama_url}/api/chat", json=payload, timeout=self.timeout_s)
        resp.raise_for_status()
        return resp.json()


def _extract_first_json_object(text: str) -> Optional[str]:
    """Extrae el primer objeto JSON del texto usando llaves balanceadas.

    Funciona aunque el modelo meta texto alrededor.
    Evita regex recursivas (no soportadas por Python re).
    """

    s = (text or "").strip()
    if not s:
        return None

    # Quita cercas típicas ```json ... ```
    if s.startswith("```"):
        # elimina primera línea ```xxx
        parts = s.splitlines()
        if parts:
            parts = parts[1:]
        # elimina última línea ```
        if parts and parts[-1].strip().startswith("```"):
            parts = parts[:-1]
        s = "\n".join(parts).strip()

    if s.startswith("{") and s.endswith("}"):
        return s

    in_str = False
    escape = False
    depth = 0
    start = -1

    for i, ch in enumerate(s):
        if in_str:
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
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
                start = i
            depth += 1
            continue
        if ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start != -1:
                return s[start : i + 1]

    return None


def _heuristic_reflection(tool_output: Any) -> PeanutReflection:
    """Fallback robusto cuando el modelo no puede auditar."""

    try:
        as_text = json.dumps(tool_output, ensure_ascii=False)
    except (TypeError, ValueError):
        as_text = str(tool_output)

    lowered = as_text.lower()
    looks_error = any(k in lowered for k in ["error", "exception", "traceback"])

    if isinstance(tool_output, dict):
        if tool_output.get("success") is False:
            looks_error = True
        rc = tool_output.get("returncode")
        if isinstance(rc, int) and rc != 0:
            looks_error = True

    if looks_error:
        return PeanutReflection(
            success=False,
            analysis="El output parece contener un error o un fallo de ejecución. Ajusta argumentos o simplifica la llamada.",
            peanuts_earned=0,
            next_action="retry",
            improved_input=None,
        )

    return PeanutReflection(
        success=True,
        analysis="El output parece válido y útil para la tarea.",
        peanuts_earned=1,
        next_action="finalize",
        improved_input=None,
    )


def reflect_on_result(
    tool_name: str,
    user_input: str,
    tool_output: Any,
    *,
    model: str = "qwen2.5:7b",
    ollama_url: str = "http://localhost:11434",
    temperature: float = 0.0,
    timeout_s: int = 60,
    max_output_chars: int = 6000,
) -> PeanutReflection:
    """Audita un tool call y decide si reintentar."""

    try:
        tool_output_text = json.dumps(tool_output, ensure_ascii=False)
    except (TypeError, ValueError):
        tool_output_text = str(tool_output)

    if len(tool_output_text) > max_output_chars:
        tool_output_text = tool_output_text[:max_output_chars] + "…(truncado)"

    system_prompt = (
        "Eres un auditor de calidad extremadamente estricto.\n"
        "Reglas:\n"
        "- Responde SOLO con un objeto JSON válido (sin markdown, sin texto extra).\n"
        "- Si el output es un error, está vacío o no cumple la tarea: success=false.\n"
        "- Si success=false: next_action=\"retry\" y sugiere improved_input (idealmente JSON).\n"
        "- Si success=true: next_action=\"finalize\" y peanuts_earned=1.\n"
        "- peanuts_earned: 1 si success=true, 0 si success=false.\n"
        "Esquema EXACTO:\n"
        '{"success": bool, "analysis": str, "peanuts_earned": 0|1, "next_action": "retry"|"finalize", "improved_input": str|null}'
    )

    user_msg = (
        f"HERRAMIENTA: {tool_name}\n"
        f"TAREA_USUARIO: {user_input}\n"
        f"OUTPUT_HERRAMIENTA: {tool_output_text}\n\n"
        "Evalúa si resolvió la tarea del usuario. Devuelve SOLO JSON."
    )

    client = OllamaClient(ollama_url=ollama_url, timeout_s=timeout_s)

    try:
        resp = client.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            temperature=temperature,
        )

        content = (resp.get("message") or {}).get("content") or ""
        raw_json = _extract_first_json_object(content)
        if not raw_json:
            return _heuristic_reflection(tool_output)

        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError:
            cleaned = raw_json.strip().replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                return _heuristic_reflection(tool_output)

        try:
            refl = PeanutReflection.model_validate(data)
        except ValidationError:
            return _heuristic_reflection(tool_output)

        # Normalizaciones defensivas
        if refl.success:
            refl.peanuts_earned = 1
            refl.next_action = "finalize"
            refl.improved_input = None
        else:
            refl.peanuts_earned = 0
            refl.next_action = "retry"
            if refl.improved_input is not None and not refl.improved_input.strip():
                refl.improved_input = None

        return refl

    except (requests.RequestException, ValueError):
        return _heuristic_reflection(tool_output)
