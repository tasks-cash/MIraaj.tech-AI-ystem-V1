"""Runway text-to-video adapter (provider_id=\"runway\").

Official async API: POST /v1/text_to_video → poll GET /v1/tasks/{id}.
Cancellation uses DELETE /v1/tasks/{id} when supported. Live network calls
require ``allow_live_requests=True``. Tests inject MockTransport only.
"""

from __future__ import annotations

from time import perf_counter
from typing import Any
from uuid import uuid4

import httpx
import structlog

from app.core.config import Settings
from app.models.creative_schemas import (
    CreativeJobStatusOutput,
    GenerateVideoInput,
    GenerateVideoOutput,
    ProviderUsageMetadata,
)
from app.services.creative.prompt_builder import build_video_provider_prompt
from app.services.creative.provider_errors import (
    NormalizedProviderError,
    normalize_cancelled,
    normalize_http_status,
    normalize_invalid_response,
    normalize_job_failed,
    normalize_network,
    normalize_output_missing,
    normalize_timeout,
)
from app.services.creative.secret_redaction import scrub_for_logs

logger = structlog.get_logger()

_RUNWAY_VERSION = "2024-11-06"

# Common Runway ratio strings — pick nearest by aspect.
_RUNWAY_RATIOS: tuple[tuple[str, float], ...] = (
    ("1280:720", 1280 / 720),
    ("720:1280", 720 / 1280),
    ("960:960", 1.0),
    ("1104:832", 1104 / 832),
    ("832:1104", 832 / 1104),
)


def runway_ratio_for_dimensions(width: int, height: int) -> str:
    aspect = width / max(1, height)
    best = min(_RUNWAY_RATIOS, key=lambda item: abs(item[1] - aspect))
    return best[0]


def runway_duration_seconds(duration: float) -> int:
    """Clamp duration to a sensible integer seconds range for text_to_video."""

    return max(2, min(10, int(round(duration))))


_STATUS_MAP = {
    "PENDING": "provider_pending",
    "THROTTLED": "provider_pending",
    "RUNNING": "provider_pending",
    "SUCCEEDED": "completed",
    "FAILED": "failed",
    "CANCELLED": "cancelled",
    "CANCELED": "cancelled",
}


class RunwayVideoGenerationProvider:
    provider_id = "runway"

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
        configured = (self._settings.AI_VIDEO_MODEL or "").strip()
        return configured or "gen3a_turbo"

    def _api_key(self) -> str | None:
        secret = self._settings.AI_VIDEO_PROVIDER_API_KEY
        if secret is None:
            return None
        return secret.get_secret_value()

    def _base_url(self) -> str:
        return self._settings.AI_VIDEO_PROVIDER_BASE_URL.rstrip("/")

    def _headers(self) -> dict[str, str]:
        key = self._api_key()
        if not key:
            raise RuntimeError("Runway video provider API key is not configured.")
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Runway-Version": _RUNWAY_VERSION,
        }

    def _failed_output(
        self,
        *,
        job_id: str,
        error: NormalizedProviderError,
        started: float,
        review: list[str] | None = None,
        provider_job_id: str | None = None,
        usage: ProviderUsageMetadata | None = None,
    ) -> GenerateVideoOutput:
        return GenerateVideoOutput(
            provider="runway",
            model=self._model(),
            status="failed",
            jobId=job_id,
            providerJobId=provider_job_id,
            media=None,
            requiresReview=True,
            reviewReasonCodes=review or ["provider_dependency"],
            safeError=error.creative_error,
            safeErrorCode=error.code,
            usage=usage,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def generate_video(self, payload: GenerateVideoInput) -> GenerateVideoOutput:
        started = perf_counter()
        job_id = payload.jobId or str(uuid4())

        if not self._allow_live_requests:
            raise RuntimeError("Live Runway video requests are disabled.")
        if self._api_key() is None:
            return self._failed_output(
                job_id=job_id,
                error=normalize_http_status(401),
                started=started,
            )

        built = build_video_provider_prompt(
            prompt=payload.prompt,
            negative_prompt=payload.negativePrompt,
            language=payload.language,
        )

        body: dict[str, Any] = {
            "promptText": built.prompt,
            "model": self._model(),
            "duration": runway_duration_seconds(payload.durationSeconds),
            "ratio": runway_ratio_for_dimensions(payload.width, payload.height),
        }

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=self._settings.AI_VIDEO_PROVIDER_TIMEOUT_SECONDS
        )
        url = f"{self._base_url()}/v1/text_to_video"

        logger.info(
            "ai.provider.request.submitted",
            **scrub_for_logs(
                {
                    "provider": self.provider_id,
                    "model": self._model(),
                    "job_id": job_id,
                    "duration": body["duration"],
                    "ratio": body["ratio"],
                }
            ),
        )

        try:
            try:
                response = await client.post(url, headers=self._headers(), json=body)
            except httpx.TimeoutException:
                return self._failed_output(
                    job_id=job_id,
                    error=normalize_timeout(),
                    started=started,
                    review=built.reviewReasonCodes,
                )
            except httpx.HTTPError:
                return self._failed_output(
                    job_id=job_id,
                    error=normalize_network(),
                    started=started,
                    review=built.reviewReasonCodes,
                )

            if response.status_code >= 400:
                hint = ""
                try:
                    hint = response.text[:500]
                except Exception:  # noqa: BLE001
                    hint = ""
                error = normalize_http_status(response.status_code, body_hint=hint)
                output = self._failed_output(
                    job_id=job_id,
                    error=error,
                    started=started,
                    review=built.reviewReasonCodes,
                )
                self._store_local(job_id, output)
                return output

            try:
                data = response.json()
            except ValueError:
                return self._failed_output(
                    job_id=job_id,
                    error=normalize_invalid_response(),
                    started=started,
                    review=built.reviewReasonCodes,
                )

            provider_job_id = data.get("id")
            if not isinstance(provider_job_id, str) or not provider_job_id:
                return self._failed_output(
                    job_id=job_id,
                    error=normalize_invalid_response(),
                    started=started,
                    review=built.reviewReasonCodes,
                )

            usage = None
            if self._settings.AI_PROVIDER_USAGE_TRACKING_ENABLED:
                usage = ProviderUsageMetadata(
                    provider=self.provider_id,
                    model=self._model(),
                    providerJobId=provider_job_id,
                    costUnknown=True,
                    requestedDurationSeconds=float(body["duration"]),
                )

            output = GenerateVideoOutput(
                provider="runway",
                model=self._model(),
                status="provider_pending",
                jobId=job_id,
                providerJobId=provider_job_id,
                media=None,
                requiresReview=True,
                reviewReasonCodes=built.reviewReasonCodes,
                usage=usage,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
            self._store_local(job_id, output, provider_job_id=provider_job_id)
            logger.info(
                "ai.provider.job.pending",
                **scrub_for_logs(
                    {
                        "provider": self.provider_id,
                        "job_id": job_id,
                        "provider_job_id": provider_job_id,
                    }
                ),
            )
            return output
        finally:
            if owns_client:
                await client.aclose()

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        """Poll Runway task status. ``job_id`` may be Nest job id or provider task id."""

        if not self._allow_live_requests:
            raise RuntimeError("Live Runway video requests are disabled.")

        provider_job_id = job_id
        local = self._jobs.get(job_id)
        if local is not None and local.providerJobId:
            provider_job_id = local.providerJobId

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=self._settings.AI_VIDEO_PROVIDER_TIMEOUT_SECONDS
        )
        url = f"{self._base_url()}/v1/tasks/{provider_job_id}"
        try:
            try:
                response = await client.get(url, headers=self._headers())
            except httpx.TimeoutException:
                error = normalize_timeout()
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )
            except httpx.HTTPError:
                error = normalize_network()
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )

            if response.status_code >= 400:
                hint = ""
                try:
                    hint = response.text[:500]
                except Exception:  # noqa: BLE001
                    hint = ""
                error = normalize_http_status(response.status_code, body_hint=hint)
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )

            try:
                data = response.json()
            except ValueError:
                error = normalize_invalid_response()
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )

            return self._map_task_status(job_id=job_id, provider_job_id=provider_job_id, data=data)
        finally:
            if owns_client:
                await client.aclose()

    def _map_task_status(
        self,
        *,
        job_id: str,
        provider_job_id: str,
        data: dict[str, Any],
    ) -> CreativeJobStatusOutput:
        raw_status = str(data.get("status") or "").upper()
        mapped = _STATUS_MAP.get(raw_status, "provider_pending")
        output_url: str | None = None
        safe_error = None
        safe_error_code = None
        usage = None

        if mapped == "completed":
            output = data.get("output")
            urls: list[str] = []
            if isinstance(output, list):
                for item in output:
                    if isinstance(item, str) and item.startswith(("http://", "https://")):
                        urls.append(item)
                    elif isinstance(item, dict):
                        candidate = item.get("url") or item.get("uri")
                        if isinstance(candidate, str) and candidate.startswith(
                            ("http://", "https://")
                        ):
                            urls.append(candidate)
            if not urls:
                error = normalize_output_missing()
                result = CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )
                self._jobs[job_id] = result
                self._jobs[provider_job_id] = result
                return result
            output_url = urls[0]
            if self._settings.AI_PROVIDER_USAGE_TRACKING_ENABLED:
                usage = ProviderUsageMetadata(
                    provider=self.provider_id,
                    model=self._model(),
                    providerJobId=provider_job_id,
                    costUnknown=True,
                    providerReportedUsage={
                        "status": raw_status,
                        "outputCount": len(urls),
                    },
                )
            logger.info(
                "ai.provider.job.completed",
                **scrub_for_logs(
                    {
                        "provider": self.provider_id,
                        "job_id": job_id,
                        "provider_job_id": provider_job_id,
                    }
                ),
            )
        elif mapped == "failed":
            error = normalize_job_failed()
            safe_error = error.creative_error
            safe_error_code = error.code
            logger.info(
                "ai.provider.job.failed",
                **scrub_for_logs(
                    {
                        "provider": self.provider_id,
                        "job_id": job_id,
                        "provider_job_id": provider_job_id,
                        "safe_error_code": safe_error_code,
                    }
                ),
            )
        elif mapped == "cancelled":
            error = normalize_cancelled()
            safe_error = error.creative_error
            safe_error_code = error.code

        result = CreativeJobStatusOutput(
            jobId=job_id,
            providerJobId=provider_job_id,
            status=mapped,
            provider=self.provider_id,
            safeError=safe_error,
            safeErrorCode=safe_error_code,
            outputUrl=output_url,
            usage=usage,
        )
        self._jobs[job_id] = result
        self._jobs[provider_job_id] = result
        return result

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        if not self._allow_live_requests:
            raise RuntimeError("Live Runway video requests are disabled.")

        provider_job_id = job_id
        local = self._jobs.get(job_id)
        if local is not None and local.providerJobId:
            provider_job_id = local.providerJobId

        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=self._settings.AI_VIDEO_PROVIDER_TIMEOUT_SECONDS
        )
        url = f"{self._base_url()}/v1/tasks/{provider_job_id}"
        try:
            try:
                response = await client.delete(url, headers=self._headers())
            except httpx.TimeoutException:
                error = normalize_timeout()
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="failed",
                    provider=self.provider_id,
                    safeError=error.creative_error,
                    safeErrorCode=error.code,
                )
            except httpx.HTTPError:
                # Cancel not reachable — report not_supported rather than inventing success.
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="cancelled",
                    provider=self.provider_id,
                    safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
                    safeErrorCode="not_supported",
                )

            if response.status_code in {200, 202, 204}:
                status = CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="cancelled",
                    provider=self.provider_id,
                    safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
                    safeErrorCode="provider_cancelled",
                )
                self._jobs[job_id] = status
                self._jobs[provider_job_id] = status
                logger.info(
                    "ai.provider.job.cancelled",
                    **scrub_for_logs(
                        {
                            "provider": self.provider_id,
                            "job_id": job_id,
                            "provider_job_id": provider_job_id,
                        }
                    ),
                )
                return status

            if response.status_code in {404, 405, 501}:
                return CreativeJobStatusOutput(
                    jobId=job_id,
                    providerJobId=provider_job_id,
                    status="cancelled",
                    provider=self.provider_id,
                    safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
                    safeErrorCode="not_supported",
                )

            hint = ""
            try:
                hint = response.text[:500]
            except Exception:  # noqa: BLE001
                hint = ""
            error = normalize_http_status(response.status_code, body_hint=hint)
            return CreativeJobStatusOutput(
                jobId=job_id,
                providerJobId=provider_job_id,
                status="failed",
                provider=self.provider_id,
                safeError=error.creative_error,
                safeErrorCode=error.code,
            )
        finally:
            if owns_client:
                await client.aclose()

    def _store_local(
        self,
        job_id: str,
        output: GenerateVideoOutput,
        *,
        provider_job_id: str | None = None,
    ) -> None:
        status = CreativeJobStatusOutput(
            jobId=job_id,
            status=output.status,
            provider=self.provider_id,
            safeError=output.safeError,
            safeErrorCode=output.safeErrorCode,
            media=output.media,
            outputUrl=output.outputUrl,
            usage=output.usage,
            providerJobId=provider_job_id or output.providerJobId,
        )
        self._jobs[job_id] = status
        if status.providerJobId:
            self._jobs[status.providerJobId] = status

    async def health_check(self) -> dict[str, object]:
        key_ok = self._api_key() is not None
        return {
            "provider": self.provider_id,
            "status": "ok" if key_ok else "misconfigured",
            "configured": key_ok,
            "model": self._model() if key_ok else None,
            "safeError": None if key_ok else "authentication_failed",
            "pollIntervalSeconds": self._settings.AI_VIDEO_PROVIDER_POLL_INTERVAL_SECONDS,
            "maxPollAttempts": self._settings.AI_VIDEO_PROVIDER_MAX_POLL_ATTEMPTS,
            "usageTrackingEnabled": self._settings.AI_PROVIDER_USAGE_TRACKING_ENABLED,
            "liveSmokeTestEnabled": self._settings.AI_PROVIDER_LIVE_SMOKE_TEST_ENABLED,
        }

    def __repr__(self) -> str:
        return (
            f"RunwayVideoGenerationProvider(model={self._model()!r}, "
            f"allow_live_requests={self._allow_live_requests})"
        )
