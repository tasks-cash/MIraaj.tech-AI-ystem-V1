"""Deterministic campaign safety checks shared by every provider.

These functions never call an LLM and never mutate campaign content — they
only detect and report. NestJS remains the authority on approval/publishing;
this module exists so the AI service can raise review flags even when a
provider (disabled or Gemini) fails to catch a problem itself. All untrusted
text (OCR summaries, additional context, source variants pulled from media)
must be treated as DATA ONLY here, never as instructions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models.campaign_enums import (
    FAKE_STATISTIC_PATTERNS,
    PAYMENT_DISCLOSURE_KEY_PHRASES,
    PROHIBITED_CAMPAIGN_CLAIM_PATTERNS,
    PROHIBITED_PAYMENT_CLAIM_PATTERNS,
    PROTECTED_CAMPAIGN_TERMS,
)

_URL_PATTERN = re.compile(r"https?://[^\s<>\"')\]]+", re.IGNORECASE)
_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_PATTERN = re.compile(r"(?<!\w)\+?\d[\d\-\s()]{6,17}\d(?!\w)")
_CURRENCY_PATTERN = re.compile(
    r"(?:USD|EUR|GBP|DZD|SAR|AED|EGP|MAD|TND|\$|€|£)\s?\d[\d,.]*"
    r"|\d[\d,.]*\s?(?:USD|EUR|GBP|DZD|SAR|AED|EGP|MAD|TND)",
    re.IGNORECASE,
)
_NUMBER_PATTERN = re.compile(r"(?<!\w)\d+(?:[.,]\d+)?%?(?!\w)")

# Deliberately conservative and EN/AR/FR-only (mirrors prompt_injection.py's
# language scope). This is defense-in-depth on top of the system-prompt
# instructions given to any live LLM provider, not a complete classifier.
_SENSITIVE_TRAIT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"target(?:ing)?\s+(?:only\s+)?(?:people\s+with\s+)?"
        r"(diabetes|hiv|cancer|depression|disabilit(?:y|ies)|"
        r"muslims?|christians?|jews|jewish|lgbt|gay|lesbian|transgender)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:only|exclusively)\s+for\s+(men|women)\s+(?:aged|over|under)", re.IGNORECASE),
    re.compile(
        r"استهداف\s+(?:فقط\s+)?(المرضى|المسلمين|المسيحيين|اليهود|المثليين)",
    ),
    re.compile(
        r"cibler\s+(?:uniquement\s+)?(?:les\s+)?(musulmans|chrétiens|juifs|handicapés)",
        re.IGNORECASE,
    ),
)

_FACE_RECOGNITION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"face\s+recognition", re.IGNORECASE),
    re.compile(r"identify\s+(this|the|that)\s+person", re.IGNORECASE),
    re.compile(r"who\s+is\s+this\s+person", re.IGNORECASE),
    re.compile(r"التعرف\s+على\s+(الوجه|الشخص)"),
    re.compile(r"reconnaissance\s+faciale", re.IGNORECASE),
)


def scan_prohibited_claims(text: str | None) -> list[str]:
    if not text:
        return []
    return [
        pattern.pattern for pattern in PROHIBITED_CAMPAIGN_CLAIM_PATTERNS if pattern.search(text)
    ]


def scan_payment_prohibited_claims(text: str | None) -> list[str]:
    if not text:
        return []
    return [
        pattern.pattern for pattern in PROHIBITED_PAYMENT_CLAIM_PATTERNS if pattern.search(text)
    ]


def scan_fake_statistics(text: str | None) -> list[str]:
    if not text:
        return []
    return [pattern.pattern for pattern in FAKE_STATISTIC_PATTERNS if pattern.search(text)]


def scan_sensitive_trait_targeting(text: str | None) -> bool:
    if not text:
        return False
    return any(pattern.search(text) for pattern in _SENSITIVE_TRAIT_PATTERNS)


def scan_face_recognition_request(text: str | None) -> bool:
    if not text:
        return False
    return any(pattern.search(text) for pattern in _FACE_RECOGNITION_PATTERNS)


@dataclass(frozen=True)
class ProtectedTokens:
    urls: tuple[str, ...] = field(default_factory=tuple)
    emails: tuple[str, ...] = field(default_factory=tuple)
    phones: tuple[str, ...] = field(default_factory=tuple)
    currency_amounts: tuple[str, ...] = field(default_factory=tuple)
    numbers: tuple[str, ...] = field(default_factory=tuple)
    brand_terms: tuple[str, ...] = field(default_factory=tuple)


def extract_protected_tokens(text: str | None) -> ProtectedTokens:
    if not text:
        return ProtectedTokens()
    raw_urls = (url.rstrip(",.;:!?)]}\"'") for url in _URL_PATTERN.findall(text))
    return ProtectedTokens(
        urls=tuple(dict.fromkeys(raw_urls)),
        emails=tuple(dict.fromkeys(_EMAIL_PATTERN.findall(text))),
        phones=tuple(dict.fromkeys(match.strip() for match in _PHONE_PATTERN.findall(text))),
        currency_amounts=tuple(dict.fromkeys(_CURRENCY_PATTERN.findall(text))),
        numbers=tuple(dict.fromkeys(_NUMBER_PATTERN.findall(text))),
        brand_terms=tuple(term for term in PROTECTED_CAMPAIGN_TERMS if term in text),
    )


def check_protected_terms_preserved(source_text: str | None, output_text: str | None) -> list[str]:
    """Return a list of issue codes for protected tokens present in
    ``source_text`` but missing from ``output_text``. Never raises; callers
    decide how to act on the result (typically: raise a review flag)."""

    if not source_text:
        return []
    source_tokens = extract_protected_tokens(source_text)
    output_text = output_text or ""
    issues: list[str] = []

    for brand_term in source_tokens.brand_terms:
        if brand_term not in output_text:
            issues.append(f"protected_brand_term_missing:{brand_term}")
    for url in source_tokens.urls:
        if url not in output_text:
            issues.append("protected_url_missing")
    for email in source_tokens.emails:
        if email not in output_text:
            issues.append("protected_email_missing")
    for phone in source_tokens.phones:
        if phone not in output_text:
            issues.append("protected_phone_missing")
    for amount in source_tokens.currency_amounts:
        if amount not in output_text:
            issues.append("protected_currency_amount_missing")

    # Plain numbers are checked as a single aggregate flag (rather than one
    # issue per digit group) to avoid noisy duplication with phone/currency
    # tokens that already cover the common high-signal cases.
    multi_digit_numbers = [number for number in source_tokens.numbers if len(number) >= 2]
    if multi_digit_numbers and any(number not in output_text for number in multi_digit_numbers):
        issues.append("protected_number_missing")

    return issues


def has_payment_disclosure(text: str | None, language: str) -> bool:
    if not text:
        return False
    key_phrases = PAYMENT_DISCLOSURE_KEY_PHRASES.get(language.strip().lower(), ())
    return any(phrase in text for phrase in key_phrases)


def missing_payment_disclosure_languages(
    texts_by_language: dict[str, str], required_languages: list[str]
) -> list[str]:
    missing: list[str] = []
    for language in required_languages:
        text = texts_by_language.get(language, "")
        if not has_payment_disclosure(text, language):
            missing.append(language)
    return missing


def estimate_semantic_preservation(source_text: str | None, output_text: str | None) -> float:
    """Crude, deterministic drift heuristic: never a substitute for human
    linguistic review, only a signal that feeds ``requiresReview``.

    Combines protected-token preservation with a length-ratio sanity check
    so an unexpectedly short/long transcreation is flagged even when it
    happens to preserve all protected tokens.
    """

    if not source_text:
        return 1.0

    issues = check_protected_terms_preserved(source_text, output_text)
    source_tokens = extract_protected_tokens(source_text)
    total_tokens = (
        len(source_tokens.brand_terms)
        + len(source_tokens.urls)
        + len(source_tokens.emails)
        + len(source_tokens.phones)
        + len(source_tokens.currency_amounts)
    )
    token_score = 1.0 if total_tokens == 0 else max(0.0, 1.0 - (len(issues) / max(total_tokens, 1)))

    output_text = output_text or ""
    source_len = max(len(source_text), 1)
    output_len = len(output_text)
    length_ratio = output_len / source_len
    # Transcreation legitimately compresses or expands text; only flag
    # extreme collapses/expansions (e.g. empty output, or 5x runaway text).
    length_score = 1.0 if 0.2 <= length_ratio <= 5.0 else 0.4

    return round(min(token_score, length_score) if output_len else 0.0, 4)
