"""OpenAI Images API adapter (provider_id=\"openai\").

Uses the official Images Generations HTTP API via httpx. Live network calls
require ``allow_live_requests=True`` and a configured API key. Automated tests
inject ``httpx.MockTransport`` and never hit the real API.
"""

from __future__ import annotations

import base64
import hashlib
from time import perf_counter
from typing import Any
from uuid import uuid4

import httpx
import structlog

from app.core.config import Settings
from app.models.creative_schemas import (
    CreativeJobStatusOutput,
    GeneratedMediaArtifact,
    GenerateImageInput,
    GenerateImageOutput,
    ProviderUsageMetadata,
)
from app.services.creative.prompt_builder import build_image_provider_prompt
from app.services.creative.provider_errors import (
    NormalizedProviderError,
    normalize_http_status,
    normalize_invalid_response,
    normalize_network,
    normalize_timeout,
)
from app.services.creative.secret_redaction import scrub_for_logs

logger = structlog.get_logger()

_OPENAI_SIZES: tuple[tuple[int, int], ...] = (
    (1024, 1024),
    (1024, 1792),
    (1792, 1024),
)


def nearest_openai_size(width: int, height: int) -> str:
    """Map requested dimensions to the nearest OpenAI-supported size string."""

    best = min(
        _OPENAI_SIZES,
        key=lambda pair: abs(pair[0] - width) + abs(pair[1] - height),
    )
    return f"{best[0]}x{best[1]}"


class OpenAIImageGenerationProvider:
    provider_id = "openai"

    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
        allow_live_requests: bool = False,
    ) -> None:
        self._settings = settings
        self._client = client
        self._allow_live_requests = allow_live_requests
        self._jobs: dict[str, CreativeJobStatusOutput] = {}

    def _model(self) -> str:
        configured = (self._settings.AI_IMAGE_MODEL or "").strip()
        return configured or "gpt-image-1"

    def _api_key(self) -> str | None:
        secret = self._settings.AI_IMAGE_PROVIDER_API_KEY
        if secret is None:
            return None
        return secret.get_secret_value()

    def _base_url(self) -> str:
        return self._settings.AI_IMAGE_PROVIDER_BASE_URL.rstrip("/")

    def _headers(self) -> dict[str, str]:
        key = self._api_key()
        if not key:
            raise RuntimeError("OpenAI image provider API key is not configured.")
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _failed_output(
        self,
        *,
        job_id: str,
        error: NormalizedProviderError,
        started: float,
        review: list[str] | None = None,
        usage: ProviderUsageMetadata | None = None,
    ) -> GenerateImageOutput:
        return GenerateImageOutput(
            provider="openai",
            model=self._model(),
            status="failed",
            jobId=job_id,
            media=None,
            requiresReview=True,
            reviewReasonCodes=review or ["provider_dependency"],
            safeError=error.creative_error,
            safeErrorCode=error.code,
            usage=usage,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def generate_image(self, payload: GenerateImageInput) -> GenerateImageOutput:
        started = perf_counter()
        job_id = payload.jobId or str(uuid4())

        if not self._allow_live_requests:
            raise RuntimeError("Live OpenAI image requests are disabled.")
        if self._api_key() is None:
            error = normalize_http_status(401)
            return self._failed_output(job_id=job_id, error=error, started=started)

        built = build_image_provider_prompt(
            prompt=payload.prompt,
            negative_prompt=payload.negativePrompt,
            concept_title=payload.conceptTitle,
            visual_narrative=payload.visualNarrative,
            required_elements=payload.requiredElements,
            prohibited_elements=payload.prohibitedElements,
            brand_placement=payload.brandPlacement,
            compliance_notes=payload.complianceNotes,
            language=payload.language,
        )

        max_variants = max(1, min(self._settings.AI_IMAGE_PROVIDER_MAX_VARIANTS, 4))
        size = nearest_openai_size(payload.width, payload.height)
        body: dict[str, Any] = {
            "model": self._model(),
            "prompt": built.prompt,
            "size": size,
            "n": 1 if max_variants >= 1 else 1,
            "response_format": "b64_json",
        }
        if built.negativePrompt:
            # Official Images API has no negative_prompt field; fold into prompt.
            body["prompt"] = (f"{built.prompt}\n[DATA negativeGuidance] {built.negativePrompt}")[
                :3_800
            ]

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=self._settings.AI_IMAGE_PROVIDER_TIMEOUT_SECONDS
        )
        url = f"{self._base_url()}/v1/images/generations"
        attempt = 0
        max_attempts = 1 + max(0, self._settings.AI_IMAGE_PROVIDER_MAX_RETRIES)
        last_error: NormalizedProviderError | None = None

        logger.info(
            "ai.provider.request.submitted",
            **scrub_for_logs(
                {
                    "provider": self.provider_id,
                    "model": self._model(),
                    "job_id": job_id,
                    "size": size,
                }
            ),
        )

        try:
            while attempt < max_attempts:
                attempt += 1
                try:
                    response = await client.post(url, headers=self._headers(), json=body)
                except httpx.TimeoutException:
                    last_error = normalize_timeout()
                    if attempt >= max_attempts:
                        break
                    continue
                except httpx.HTTPError:
                    last_error = normalize_network()
                    if attempt >= max_attempts:
                        break
                    continue

                if response.status_code >= 400:
                    hint = ""
                    try:
                        hint = response.text[:500]
                    except Exception:  # noqa: BLE001
                        hint = ""
                    last_error = normalize_http_status(response.status_code, body_hint=hint)
                    if last_error.retryable and attempt < max_attempts:
                        continue
                    output = self._failed_output(
                        job_id=job_id,
                        error=last_error,
                        started=started,
                        review=built.reviewReasonCodes,
                    )
                    self._store_job(job_id, output)
                    return output

                try:
                    data = response.json()
                except ValueError:
                    last_error = normalize_invalid_response()
                    break

                return self._parse_success(
                    data,
                    job_id=job_id,
                    started=started,
                    review=built.reviewReasonCodes,
                    size=size,
                )

            error = last_error or normalize_invalid_response()
            output = self._failed_output(
                job_id=job_id,
                error=error,
                started=started,
                review=built.reviewReasonCodes,
            )
            self._store_job(job_id, output)
            return output
        finally:
            if owns_client:
                await client.aclose()

    def _parse_success(
        self,
        data: dict[str, Any],
        *,
        job_id: str,
        started: float,
        review: list[str],
        size: str,
    ) -> GenerateImageOutput:
        items = data.get("data")
        if not isinstance(items, list) or not items:
            error = normalize_invalid_response()
            return self._failed_output(job_id=job_id, error=error, started=started, review=review)

        first = items[0]
        if not isinstance(first, dict):
            error = normalize_invalid_response()
            return self._failed_output(job_id=job_id, error=error, started=started, review=review)

        usage_raw = data.get("usage") if isinstance(data.get("usage"), dict) else None
        usage = ProviderUsageMetadata(
            provider=self.provider_id,
            model=self._model(),
            providerReportedUsage=usage_raw,
            costUnknown=True,
            requestedVariants=1,
            generatedVariants=1,
        )

        b64 = first.get("b64_json")
        if isinstance(b64, str) and b64:
            try:
                raw = base64.b64decode(b64, validate=False)
            except Exception:  # noqa: BLE001
                error = normalize_invalid_response()
                return self._failed_output(
                    job_id=job_id, error=error, started=started, review=review
                )
            width_s, _, height_s = size.partition("x")
            artifact = GeneratedMediaArtifact(
                contentBase64=base64.b64encode(raw).decode("ascii"),
                mimeType="image/png",
                width=int(width_s) if width_s.isdigit() else None,
                height=int(height_s) if height_s.isdigit() else None,
                sha256=hashlib.sha256(raw).hexdigest(),
                byteLength=len(raw),
                isMock=False,
            )
            output = GenerateImageOutput(
                provider="openai",
                model=self._model(),
                status="completed",
                jobId=job_id,
                media=artifact,
                requiresReview=True,
                reviewReasonCodes=review,
                usage=usage,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
            self._store_job(job_id, output)
            logger.info(
                "ai.provider.job.completed",
                **scrub_for_logs(
                    {
                        "provider": self.provider_id,
                        "job_id": job_id,
                        "byte_length": artifact.byteLength,
                        "sha256": artifact.sha256,
                    }
                ),
            )
            return output

        url = first.get("url")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            # Do not fetch here (SSRF). Nest retrieves via validate-media allowlist.
            review_codes = [*review, "provider_output_url_pending_retrieve"]
            output = GenerateImageOutput(
                provider="openai",
                model=self._model(),
                status="provider_pending",
                jobId=job_id,
                media=None,
                outputUrl=url,
                requiresReview=True,
                reviewReasonCodes=review_codes,
                usage=usage,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
            self._store_job(job_id, output, output_url=url)
            logger.info(
                "ai.provider.job.pending",
                **scrub_for_logs(
                    {
                        "provider": self.provider_id,
                        "job_id": job_id,
                        "note": "url_only_retrieve_via_allowlist",
                    }
                ),
            )
            return output

        error = normalize_invalid_response()
        return self._failed_output(job_id=job_id, error=error, started=started, review=review)

    def _store_job(
        self,
        job_id: str,
        output: GenerateImageOutput,
        *,
        output_url: str | None = None,
    ) -> None:
        self._jobs[job_id] = CreativeJobStatusOutput(
            jobId=job_id,
            status=output.status,
            provider=self.provider_id,
            safeError=output.safeError,
            safeErrorCode=output.safeErrorCode,
            media=output.media,
            outputUrl=output_url or output.outputUrl,
            usage=output.usage,
            providerJobId=output.providerJobId,
        )

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        existing = self._jobs.get(job_id)
        if existing is not None:
            return existing
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="failed",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_FAILED",
            safeErrorCode="provider_job_failed",
        )

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        # OpenAI Images generations are synchronous — cancel is not supported.
        status = CreativeJobStatusOutput(
            jobId=job_id,
            status="cancelled",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
            safeErrorCode="not_supported",
        )
        self._jobs[job_id] = status
        return status

    async def health_check(self) -> dict[str, object]:
        key_ok = self._api_key() is not None
        return {
            "provider": self.provider_id,
            "status": "ok" if key_ok else "misconfigured",
            "configured": key_ok,
            "model": self._model() if key_ok else None,
            "safeError": None if key_ok else "authentication_failed",
            "usageTrackingEnabled": self._settings.AI_PROVIDER_USAGE_TRACKING_ENABLED,
            "liveSmokeTestEnabled": self._settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED,
        }

    def __repr__(self) -> str:
        return (
            f"OpenAIImageGenerationProvider(model={self._model()!r}, "
            f"allow_live_requests={self._allow_live_requests})"
        )
