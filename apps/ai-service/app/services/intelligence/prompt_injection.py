"""Prompt-injection detection for untrusted source text (EN/AR/FR).

Any OCR text, image captions, or other user-controlled free text passed into
the reasoning providers is DATA ONLY. This module never executes or follows
matched text; it only flags it so providers can raise a review flag and
callers can log a safe, non-sensitive signal. Detection is intentionally
conservative (pattern-based) since the deterministic provider never reads
free text for decision-making in the first place.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_MAX_SCAN_CHARS = 20_000

_EN_PATTERNS = (
    r"ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above)\s+.{0,20}instructions",
    r"disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above)",
    r"you\s+are\s+now\b",
    r"act\s+as\s+(a|an)\b",
    r"system\s+prompt",
    r"reveal\s+(your|the)\s+(system|internal)\s+prompt",
    r"new\s+instructions?\s*:",
    r"forget\s+(everything|all)\s+(you\s+were|above)",
    r"do\s+anything\s+now",
)

_AR_PATTERNS = (
    r"تجاهل.{0,20}(التعليمات|الأوامر)",
    r"تصرف\s*كأنك",
    r"تصرف\s+ك",
    r"أنت\s+الآن",
    r"انسَ.{0,20}(سبق|أعلاه)",
    r"انسى.{0,20}(سبق|أعلاه)",
    r"تعليمات\s+جديدة",
    r"اكشف.{0,20}(تعليمات|النظام)",
)

_FR_PATTERNS = (
    r"ignore[rz]?.{0,20}instructions?\s+(pr[ée]c[ée]dentes|ci-dessus)",
    r"agis\s+comme",
    r"tu\s+es\s+maintenant",
    r"oublie.{0,20}pr[ée]c[ée]d",
    r"nouvelles?\s+instructions",
    r"r[ée]v[èe]le.{0,20}(prompt|instructions)\s+syst[èe]me",
)

_COMPILED_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "en": tuple(re.compile(pattern, re.IGNORECASE) for pattern in _EN_PATTERNS),
    "ar": tuple(re.compile(pattern) for pattern in _AR_PATTERNS),
    "fr": tuple(re.compile(pattern, re.IGNORECASE) for pattern in _FR_PATTERNS),
}


@dataclass(frozen=True)
class PromptInjectionResult:
    matched: bool
    matchedPatterns: list[str] = field(default_factory=list)
    languageHints: list[str] = field(default_factory=list)


def scan_for_prompt_injection(text: str | None) -> PromptInjectionResult:
    """Scan untrusted text for injection-style phrasing. Returns a flag only;
    callers must never let a match change classification logic, it should
    only raise a review flag/warning."""

    if not text:
        return PromptInjectionResult(matched=False)

    scoped_text = text[:_MAX_SCAN_CHARS]
    matched_patterns: list[str] = []
    language_hints: list[str] = []
    for language, patterns in _COMPILED_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(scoped_text):
                matched_patterns.append(pattern.pattern)
                if language not in language_hints:
                    language_hints.append(language)

    return PromptInjectionResult(
        matched=bool(matched_patterns),
        matchedPatterns=matched_patterns,
        languageHints=language_hints,
    )


def wrap_untrusted_content(text: str, *, max_chars: int) -> str:
    """Delimit untrusted content so LLM-backed providers can be instructed to
    treat everything between the markers as data, never as instructions."""

    truncated = text[:max_chars]
    return f"===UNTRUSTED_SOURCE_CONTENT_START===\n{truncated}\n===UNTRUSTED_SOURCE_CONTENT_END==="
