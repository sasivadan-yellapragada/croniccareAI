from __future__ import annotations

import json
import re
from typing import Any

from groq import Groq


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """
    Best-effort JSON extraction.
    The LLM is instructed to return JSON only, but we still guard against wrapping text.
    """
    if not text:
        return None
    # Try direct parse first.
    try:
        return json.loads(text)
    except Exception:
        pass

    # Fallback: pull the first {...} block.
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def _build_prompt(
    *,
    report_type: str,
    mode: str,
    extracted_text: str,
    metrics: list[dict[str, Any]],
    out_of_range: list[dict[str, Any]],
) -> list[dict[str, str]]:
    system = (
        "You are a careful health assistant focused on chronic disease education and self-care. "
        "You MUST NOT provide diagnoses or prescribe medications. "
        "When giving recommendations, keep them general, safe, and advise discussing with a clinician for personalization. "
        "Return concise, actionable guidance."
    )

    # Include only a limited amount of data for prompt size.
    metrics_str = json.dumps(metrics[:25], ensure_ascii=False)
    out_str = json.dumps(out_of_range[:25], ensure_ascii=False)

    if mode == "medications":
        user = (
            "Analyze the following report text and extracted lab/metric values. "
            "Identify potential medication-related topics the patient should discuss with their clinician. "
            "Do NOT give doses, start/end dates, or exact prescriptions.\n\n"
            f"REPORT_TYPE: {report_type}\n\n"
            f"OUT_OF_RANGE: {out_str}\n\n"
            f"METRICS: {metrics_str}\n\n"
            "REPORT_TEXT:\n"
            f"{extracted_text}\n\n"
            "Respond with JSON only in this shape:\n"
            "{\n"
            '  "summary": string,\n'
            '  "foodHabits": string[],\n'
            '  "exerciseIdeas": string[],\n'
            '  "medicationsToDiscuss": string[],\n'
            '  "safetyNotes": string[]\n'
            "}\n"
        )
    else:
        user = (
            "Analyze the following report text and extracted lab/metric values. "
            "Provide patient-friendly guidance: what might be relevant and specific lifestyle changes to consider.\n\n"
            f"REPORT_TYPE: {report_type}\n\n"
            f"OUT_OF_RANGE: {out_str}\n\n"
            f"METRICS: {metrics_str}\n\n"
            "REPORT_TEXT:\n"
            f"{extracted_text}\n\n"
            "Respond with JSON only in this shape:\n"
            "{\n"
            '  "summary": string,\n'
            '  "foodHabits": string[],\n'
            '  "exerciseIdeas": string[],\n'
            '  "medicationsToDiscuss": string[],\n'
            '  "safetyNotes": string[]\n'
            "}\n"
        )

    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


async def analyze_report(
    *,
    groq_client: Groq,
    groq_model: str,
    report_type: str,
    mode: str,
    extracted_text: str,
    metrics: list[dict[str, Any]],
    out_of_range: list[dict[str, Any]],
) -> dict[str, Any]:
    messages = _build_prompt(
        report_type=report_type,
        mode=mode,
        extracted_text=extracted_text,
        metrics=metrics,
        out_of_range=out_of_range,
    )

    completion = groq_client.chat.completions.create(
        model=groq_model,
        messages=messages,
        temperature=0.2,
        max_tokens=650,
    )

    content = completion.choices[0].message.content or ""
    parsed = _extract_json_object(content)
    if isinstance(parsed, dict):
        return parsed

    # Last-resort fallback (LLM didn't obey JSON-only).
    return {
        "summary": content.strip()[:8000],
        "foodHabits": [],
        "exerciseIdeas": [],
        "medicationsToDiscuss": [],
        "safetyNotes": ["AI output was not valid JSON; showing raw summary."],
    }

