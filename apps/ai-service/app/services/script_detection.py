from __future__ import annotations

import unicodedata

from app.models.media_schemas import ScriptDetectionResult

SCRIPT_RANGES: tuple[tuple[str, int, int], ...] = (
    ("Arabic", 0x0600, 0x06FF),
    ("Arabic", 0x0750, 0x077F),
    ("Arabic", 0x08A0, 0x08FF),
    ("Latin", 0x0041, 0x007A),
    ("Latin", 0x00C0, 0x024F),
    ("Cyrillic", 0x0400, 0x04FF),
    ("Greek", 0x0370, 0x03FF),
    ("Hebrew", 0x0590, 0x05FF),
    ("Devanagari", 0x0900, 0x097F),
    ("Bengali", 0x0980, 0x09FF),
    ("Thai", 0x0E00, 0x0E7F),
)

RTL_SCRIPTS = frozenset({"Arabic", "Hebrew"})


def detect_scripts(text: str) -> ScriptDetectionResult:
    if not text.strip():
        return ScriptDetectionResult(
            scripts=[],
            direction="unknown",
            isMixed=False,
            confidence=0.0,
        )

    counts: dict[str, int] = {}
    meaningful = 0
    for char in text:
        if char.isspace() or char.isdigit() or unicodedata.category(char) == "Po":
            continue
        codepoint = ord(char)
        matched = False
        for script_name, start, end in SCRIPT_RANGES:
            if start <= codepoint <= end:
                counts[script_name] = counts.get(script_name, 0) + 1
                meaningful += 1
                matched = True
                break
        if not matched and char.isalpha():
            counts["Latin"] = counts.get("Latin", 0) + 1
            meaningful += 1

    if meaningful == 0:
        return ScriptDetectionResult(
            scripts=[],
            direction="unknown",
            isMixed=False,
            confidence=0.0,
        )

    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    scripts = [name for name, _count in ranked]
    primary_script = ranked[0][0]
    confidence = ranked[0][1] / meaningful
    is_mixed = len(scripts) > 1 and ranked[1][1] / meaningful >= 0.15

    rtl_count = sum(count for script, count in ranked if script in RTL_SCRIPTS)
    ltr_count = meaningful - rtl_count
    if rtl_count > 0 and ltr_count > 0:
        direction = "mixed"
    elif rtl_count > ltr_count:
        direction = "rtl"
    elif ltr_count > 0:
        direction = "ltr"
    else:
        direction = "unknown"

    return ScriptDetectionResult(
        scripts=scripts,
        primaryScript=primary_script,
        direction=direction,
        isMixed=is_mixed,
        confidence=round(confidence, 4),
    )
