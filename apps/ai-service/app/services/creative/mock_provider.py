"""Mock creative generation providers for local tests and offline development.

No network calls. Images are deterministic PNGs from Pillow. Videos attempt a
minimal OpenCV ``VideoWriter`` MP4; if that fails, poster-frame PNGs are
returned with metadata marking the result as a mock short video.
"""

from __future__ import annotations

import base64
import hashlib
import io
import tempfile
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from PIL import Image, ImageDraw, ImageFont

from app.core.config import Settings
from app.models.creative_enums import contains_prohibited_creative_visual_claim
from app.models.creative_schemas import (
    CreativeJobStatusOutput,
    GeneratedMediaArtifact,
    GenerateImageInput,
    GenerateImageOutput,
    GenerateVideoInput,
    GenerateVideoOutput,
)

_JOBS: dict[str, CreativeJobStatusOutput] = {}


def _seed_color(seed_material: str) -> tuple[int, int, int]:
    digest = hashlib.sha256(seed_material.encode("utf-8")).digest()
    return digest[0], digest[1], digest[2]


def _encode_png(image: Image.Image) -> tuple[bytes, str]:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    payload = buffer.getvalue()
    return payload, hashlib.sha256(payload).hexdigest()


def _draw_mock_image(
    *,
    width: int,
    height: int,
    prompt: str,
    seed: int | None,
    label: str,
) -> Image.Image:
    material = f"{seed if seed is not None else 0}:{prompt}:{width}x{height}:{label}"
    color = _seed_color(material)
    image = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.load_default()
    except OSError:
        font = None
    caption = f"MOCK {label}"
    draw.rectangle((8, 8, min(width - 8, 220), 40), fill=(0, 0, 0))
    draw.text((16, 14), caption[:40], fill=(255, 255, 255), font=font)
    # Deterministic accent bar from prompt hash — never commercial artwork.
    bar_y = 16 + (hashlib.sha256(material.encode()).digest()[3] % max(1, height - 48))
    draw.rectangle((0, bar_y, width, min(height, bar_y + 8)), fill=(255, 255, 255))
    return image


def _try_write_mock_mp4(
    *,
    frames: list[Image.Image],
    width: int,
    height: int,
    fps: int,
) -> bytes | None:
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None

    with tempfile.TemporaryDirectory(prefix="miraaj-mock-video-") as tmp:
        path = Path(tmp) / "mock.mp4"
        writer = cv2.VideoWriter(
            str(path),
            int(cv2.VideoWriter_fourcc(*"mp4v")),  # type: ignore[attr-defined]
            float(fps),
            (width, height),
        )
        if not writer.isOpened():
            writer.release()
            return None
        try:
            for frame in frames:
                rgb = frame.convert("RGB")
                array = np.array(rgb)
                bgr = cv2.cvtColor(array, cv2.COLOR_RGB2BGR)
                writer.write(bgr)
        finally:
            writer.release()
        if not path.exists() or path.stat().st_size < 32:
            return None
        return path.read_bytes()


class MockImageGenerationProvider:
    provider_id = "mock"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def generate_image(self, payload: GenerateImageInput) -> GenerateImageOutput:
        started = perf_counter()
        job_id = payload.jobId or str(uuid4())
        review_codes: list[str] = ["generated_image"]
        if contains_prohibited_creative_visual_claim(payload.prompt):
            review_codes.append("prohibited_element_warning")

        image = _draw_mock_image(
            width=payload.width,
            height=payload.height,
            prompt=payload.prompt,
            seed=payload.seed,
            label="IMAGE",
        )
        raw, digest = _encode_png(image)
        artifact = GeneratedMediaArtifact(
            contentBase64=base64.b64encode(raw).decode("ascii"),
            mimeType="image/png",
            width=payload.width,
            height=payload.height,
            sha256=digest,
            byteLength=len(raw),
            isMock=True,
        )
        output = GenerateImageOutput(
            provider="mock",
            model=(self._settings.AI_IMAGE_MODEL if self._settings else None) or "mock-png",
            status="completed",
            jobId=job_id,
            media=artifact,
            requiresReview=True,
            reviewReasonCodes=review_codes,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
        _JOBS[job_id] = CreativeJobStatusOutput(
            jobId=job_id,
            status="completed",
            provider=self.provider_id,
            media=artifact,
        )
        return output

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        existing = _JOBS.get(job_id)
        if existing is not None:
            return existing
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="failed",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_FAILED",
        )

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        status = CreativeJobStatusOutput(
            jobId=job_id,
            status="cancelled",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
        )
        _JOBS[job_id] = status
        return status

    async def health_check(self) -> dict[str, object]:
        return {"provider": self.provider_id, "status": "ok", "safeError": None}


class MockVideoGenerationProvider:
    provider_id = "mock"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def generate_video(self, payload: GenerateVideoInput) -> GenerateVideoOutput:
        started = perf_counter()
        job_id = payload.jobId or str(uuid4())
        review_codes: list[str] = ["generated_video"]
        if contains_prohibited_creative_visual_claim(payload.prompt):
            review_codes.append("prohibited_element_warning")

        frame_count = max(1, int(round(payload.durationSeconds * payload.fps)))
        frames = [
            _draw_mock_image(
                width=payload.width,
                height=payload.height,
                prompt=f"{payload.prompt}:{index}",
                seed=payload.seed,
                label=f"VID{index}",
            )
            for index in range(frame_count)
        ]

        mp4 = _try_write_mock_mp4(
            frames=frames,
            width=payload.width,
            height=payload.height,
            fps=payload.fps,
        )
        if mp4 is not None:
            digest = hashlib.sha256(mp4).hexdigest()
            artifact = GeneratedMediaArtifact(
                contentBase64=base64.b64encode(mp4).decode("ascii"),
                mimeType="video/mp4",
                width=payload.width,
                height=payload.height,
                durationSeconds=payload.durationSeconds,
                frameCount=frame_count,
                sha256=digest,
                byteLength=len(mp4),
                isMock=True,
                isPosterFrameFallback=False,
            )
        else:
            posters: list[str] = []
            for frame in frames[: min(8, len(frames))]:
                raw, _ = _encode_png(frame)
                posters.append(base64.b64encode(raw).decode("ascii"))
            first_raw, first_digest = _encode_png(frames[0])
            artifact = GeneratedMediaArtifact(
                contentBase64=base64.b64encode(first_raw).decode("ascii"),
                mimeType="image/png",
                width=payload.width,
                height=payload.height,
                durationSeconds=payload.durationSeconds,
                frameCount=frame_count,
                sha256=first_digest,
                byteLength=len(first_raw),
                isMock=True,
                isPosterFrameFallback=True,
                posterFramesBase64=posters,
            )

        output = GenerateVideoOutput(
            provider="mock",
            model=(self._settings.AI_VIDEO_MODEL if self._settings else None) or "mock-video",
            status="completed",
            jobId=job_id,
            media=artifact,
            requiresReview=True,
            reviewReasonCodes=review_codes,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
        _JOBS[job_id] = CreativeJobStatusOutput(
            jobId=job_id,
            status="completed",
            provider=self.provider_id,
            media=artifact,
        )
        return output

    async def get_job_status(self, job_id: str) -> CreativeJobStatusOutput:
        existing = _JOBS.get(job_id)
        if existing is not None:
            return existing
        return CreativeJobStatusOutput(
            jobId=job_id,
            status="failed",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_FAILED",
        )

    async def cancel_job(self, job_id: str) -> CreativeJobStatusOutput:
        status = CreativeJobStatusOutput(
            jobId=job_id,
            status="cancelled",
            provider=self.provider_id,
            safeError="CREATIVE_PROVIDER_JOB_CANCELLED",
        )
        _JOBS[job_id] = status
        return status

    async def health_check(self) -> dict[str, object]:
        return {"provider": self.provider_id, "status": "ok", "safeError": None}
