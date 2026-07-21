"""Secret / URL redaction for production provider logs."""

from __future__ import annotations

from app.core.logging import redact_value
from app.services.creative.secret_redaction import (
    redact_text,
    redact_url,
    scrub_for_logs,
)


def test_redact_bearer_and_api_keys() -> None:
    text = "Authorization: Bearer sk-abc1234567890xyz and key=rk-secretvalue99"
    redacted = redact_text(text)
    assert "sk-abc" not in redacted
    assert "Bearer [REDACTED]" in redacted or "[REDACTED]" in redacted


def test_redact_signed_urls() -> None:
    url = "https://oaidalleapiprodscus.blob.core.windows.net/private/path?sig=supersecret"
    assert redact_url(url) == "https://oaidalleapiprodscus.blob.core.windows.net/[REDACTED]"


def test_scrub_for_logs_nested() -> None:
    payload = scrub_for_logs(
        {
            "provider": "openai",
            "authorization": "Bearer sk-live-secret",
            "outputUrl": "https://cdn.example/out.mp4?sig=abc",
            "AI_IMAGE_PROVIDER_API_KEY": "sk-should-vanish",
            "job_id": "job-1",
            "nested": {"token": "secret-token", "ok": True},
        }
    )
    assert payload["authorization"] == "[REDACTED]"
    assert payload["outputUrl"] == "[REDACTED]"
    assert payload["AI_IMAGE_PROVIDER_API_KEY"] == "[REDACTED]"
    assert payload["job_id"] == "job-1"
    assert payload["nested"]["token"] == "[REDACTED]"  # type: ignore[index]
    assert payload["nested"]["ok"] is True  # type: ignore[index]


def test_structlog_redact_value_keys() -> None:
    assert redact_value("AI_IMAGE_PROVIDER_API_KEY", "sk-x") == "[REDACTED]"
    assert redact_value("outputUrl", "https://x") == "[REDACTED]"
    assert redact_value("sha256", "abc") == "abc"


def test_prompt_not_logged_via_scrub_keys() -> None:
    # Prompts should not be passed to scrub_for_logs under sensitive keys;
    # ensure Authorization-shaped values inside free text are still scrubbed.
    scrubbed = scrub_for_logs({"note": "use Bearer sk-abcdef0123456789 carefully"})
    assert "sk-abcdef" not in str(scrubbed["note"])
