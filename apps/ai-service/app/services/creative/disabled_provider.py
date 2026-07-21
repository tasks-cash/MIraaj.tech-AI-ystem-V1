"""Disabled creative generation providers.

When ``AI_IMAGE_PROVIDER`` / ``AI_VIDEO_PROVIDER`` is ``disabled`` (the default),
these adapters return a structured ``provider_unavailable`` result and never
fabricate commercial-looking media bytes. NestJS routes jobs to manual upload
or review based on that signal.
"""

from __future__ import annotations

from time import perf_counter
from uuid import uuid4

from app.core.config import Settings
from app.models.creative_schemas import (
    CreativeJobStatusOutput,
    GenerateImageInput,
    GenerateImageOutput,
    GenerateVideoInput,
    GenerateVideoOutput,
)


class DisabledImageGenerationProvider:
    provider_id = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def generate_image(self, payload: GenerateImageInput) -> GenerateImageOutput:
        started = perf_counter()
        return GenerateImageOutput(
            provider="disabled",
            model=None,
            status="provider_unavailable",
            jobId=payload.jobId or str(uuid4()),
            media=None,
            requiresReview=True,
            reviewReasonCodes=["provider_dependency"],
            safeError="CREATIVE_PROVIDER_DISABLED",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="provider_unavailable",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_DISABLED",
        )

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="cancelled",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_DISABLED",
        )

    async def health_check(self) -> dict[str, object]:
        return {
            "provider": self.provider_id,
            "status": "ok",
            "safeError": "CREATIVE_PROVIDER_DISABLED",
        }


class DisabledVideoGenerationProvider:
    provider_id = "disabled"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def generate_video(self, payload: GenerateVideoInput) -> GenerateVideoOutput:
        started = perf_counter()
        return GenerateVideoOutput(
            provider="disabled",
            model=None,
            status="provider_unavailable",
            jobId=payload.jobId or str(uuid4()),
            media=None,
            requiresReview=True,
            reviewReasonCodes=["provider_dependency"],
            safeError="CREATIVE_PROVIDER_DISABLED",
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="provider_unavailable",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_DISABLED",
        )

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="cancelled",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_DISABLED",
        )

    async def health_check(self) -> dict[str, object]:
        return {
            "provider": self.provider_id,
            "status": "ok",
            "safeError": "CREATIVE_PROVIDER_DISABLED",
        }
