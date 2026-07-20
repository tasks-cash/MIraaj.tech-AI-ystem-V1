from __future__ import annotations

import re

URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")
BRAND_PATTERN = re.compile(r"\b(Miraaj\.tech|Tasks\.cash)\b", re.IGNORECASE)


def _collect_protected_spans(text: str) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []
    for pattern in (URL_PATTERN, EMAIL_PATTERN, PHONE_PATTERN, BRAND_PATTERN):
        for match in pattern.finditer(text):
            spans.append((match.start(), match.end(), match.group(0)))
    spans.sort(key=lambda item: item[0])
    merged: list[tuple[int, int, str]] = []
    for start, end, value in spans:
        if merged and start < merged[-1][1]:
            continue
        merged.append((start, end, value))
    return merged


def normalize_ocr_text(raw_text: str) -> str:
    if not raw_text.strip():
        return ""

    placeholders: dict[str, str] = {}
    working = raw_text
    for index, (start, end, value) in enumerate(reversed(_collect_protected_spans(raw_text))):
        token = f"__PROTECTED_{index}__"
        placeholders[token] = value
        working = working[:start] + token + working[end:]

    normalized = re.sub(r"[ \t]+", " ", working)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = normalized.strip()

    for token, value in placeholders.items():
        normalized = normalized.replace(token, value)
    return normalized
