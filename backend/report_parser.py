from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pypdf import PdfReader


@dataclass
class ParsedMetric:
    key: str
    value: float
    unit: str
    low: float | None
    high: float | None
    status: str  # low, normal, high, unknown


# Common clinical metrics with rough reference ranges.
REFERENCE_RANGES: dict[str, tuple[str, float | None, float | None, str]] = {
    "bp_systolic": ("Systolic BP", 90.0, 120.0, "mmHg"),
    "bp_diastolic": ("Diastolic BP", 60.0, 80.0, "mmHg"),
    "heart_rate": ("Heart Rate", 60.0, 100.0, "bpm"),
    "hemoglobin": ("Hemoglobin", 12.0, 17.5, "g/dL"),
    "wbc": ("WBC", 4.0, 11.0, "x10^9/L"),
    "rbc": ("RBC", 4.2, 6.1, "x10^12/L"),
    "platelets": ("Platelets", 150.0, 450.0, "x10^9/L"),
    "glucose": ("Glucose", 70.0, 140.0, "mg/dL"),
    "hba1c": ("HbA1c", None, 6.5, "%"),
    "creatinine": ("Creatinine", 0.6, 1.3, "mg/dL"),
    "urea": ("Urea", 15.0, 40.0, "mg/dL"),
    "cholesterol_total": ("Total Cholesterol", None, 200.0, "mg/dL"),
    "ldl": ("LDL", None, 100.0, "mg/dL"),
    "hdl": ("HDL", 40.0, None, "mg/dL"),
    "triglycerides": ("Triglycerides", None, 150.0, "mg/dL"),
}

# Regex aliases -> canonical metric key.
METRIC_PATTERNS: list[tuple[str, str]] = [
    (r"\bsystolic\b", "bp_systolic"),
    (r"\bdiastolic\b", "bp_diastolic"),
    (r"\bheart rate\b|\bpulse\b", "heart_rate"),
    (r"\bhemoglobin\b|\bhb\b", "hemoglobin"),
    (r"\bwbc\b|white blood cell", "wbc"),
    (r"\brbc\b|red blood cell", "rbc"),
    (r"\bplatelet[s]?\b", "platelets"),
    (r"\bglucose\b|\bblood sugar\b", "glucose"),
    (r"\bhba1c\b|\ba1c\b", "hba1c"),
    (r"\bcreatinine\b", "creatinine"),
    (r"\burea\b", "urea"),
    (r"\btotal cholesterol\b|\bcholesterol\b", "cholesterol_total"),
    (r"\bldl\b", "ldl"),
    (r"\bhdl\b", "hdl"),
    (r"\btriglycerides\b", "triglycerides"),
]


def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts).strip()


def extract_text_from_image(path: str) -> str:
    try:
        from PIL import Image
        import pytesseract

        img = Image.open(path)
        return pytesseract.image_to_string(img).strip()
    except Exception:
        return ""


def extract_text_from_file(path: str, mime_type: str | None = None) -> str:
    ext = Path(path).suffix.lower()
    if mime_type and "pdf" in mime_type or ext == ".pdf":
        return extract_text_from_pdf(path)
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}:
        return extract_text_from_image(path)
    # Fallback: try reading as text
    try:
        return Path(path).read_text(encoding="utf-8")
    except Exception:
        return ""


def _status(value: float, low: float | None, high: float | None) -> str:
    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    if low is None and high is None:
        return "unknown"
    return "normal"


def parse_metrics(text: str) -> list[dict[str, Any]]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    found: dict[str, ParsedMetric] = {}

    for line in lines:
        l = line.lower()
        bp_match = re.search(
            r"(?:\bblood pressure\b|\bbp\b)[^\d]{0,20}(\d{2,3})\s*/\s*(\d{2,3})",
            l,
        )
        if bp_match:
            for key, value_text in (
                ("bp_systolic", bp_match.group(1)),
                ("bp_diastolic", bp_match.group(2)),
            ):
                value = float(value_text)
                _, low, high, unit = REFERENCE_RANGES[key]
                found[key] = ParsedMetric(
                    key=key,
                    value=value,
                    unit=unit,
                    low=low,
                    high=high,
                    status=_status(value, low, high),
                )
            continue

        for pat, key in METRIC_PATTERNS:
            if re.search(pat, l):
                # pick first decimal/integer number in line
                m = re.search(r"(-?\d+(?:\.\d+)?)", l)
                if not m:
                    continue
                try:
                    value = float(m.group(1))
                except Exception:
                    continue
                _, low, high, unit = REFERENCE_RANGES[key]
                found[key] = ParsedMetric(
                    key=key,
                    value=value,
                    unit=unit,
                    low=low,
                    high=high,
                    status=_status(value, low, high),
                )
                break

    metrics: list[dict[str, Any]] = []
    for key, pm in found.items():
        label, _, _, _ = REFERENCE_RANGES[key]
        metrics.append(
            {
                "key": key,
                "label": label,
                "value": pm.value,
                "unit": pm.unit,
                "referenceLow": pm.low,
                "referenceHigh": pm.high,
                "status": pm.status,
            }
        )
    return metrics
