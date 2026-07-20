from __future__ import annotations

import io
from dataclasses import dataclass
from hashlib import sha256
from time import perf_counter
from typing import Any

from PIL import Image, UnidentifiedImageError

from app.core.config import Settings
from app.models.media_schemas import (
    DuplicateDetectionResult,
    MediaInspectResponse,
    SanitizationResult,
    VerifiedMediaMetadata,
)

PDF_SIGNATURE = b"%PDF"
JPEG_SIGNATURE = b"\xff\xd8\xff"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
WEBP_SIGNATURE = b"RIFF"

IMAGE_MIME_BY_SIGNATURE: tuple[tuple[bytes, str], ...] = (
    (JPEG_SIGNATURE, "image/jpeg"),
    (PNG_SIGNATURE, "image/png"),
    (WEBP_SIGNATURE, "image/webp"),
)


class MediaInspectError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class InspectedMedia:
    response: MediaInspectResponse
    image: Image.Image | None = None
    pdf_bytes: bytes | None = None


def _detect_kind(content: bytes) -> tuple[str, str]:
    if content.startswith(PDF_SIGNATURE):
        return "pdf", "application/pdf"
    for signature, mime in IMAGE_MIME_BY_SIGNATURE:
        if content.startswith(signature):
            if mime == "image/webp" and b"WEBP" not in content[:16]:
                continue
            return "image", mime
    raise MediaInspectError(
        "MEDIA_SIGNATURE_MISMATCH",
        "Unsupported or mismatched media signature.",
    )


def _average_hash(image: Image.Image, hash_size: int = 8) -> str:
    grayscale = image.convert("L").resize((hash_size, hash_size))
    pixels = list(grayscale.getdata())
    average = sum(pixels) / len(pixels)
    bits = "".join("1" if pixel >= average else "0" for pixel in pixels)
    return hex(int(bits, 2))[2:].rjust(hash_size * hash_size // 4, "0")


def _perceptual_hash(image: Image.Image) -> tuple[str, str]:
    try:
        import imagehash

        return str(imagehash.average_hash(image)), "imagehash_average"
    except Exception:
        return _average_hash(image), "pillow_average"


def _strip_exif(image: Image.Image) -> tuple[Image.Image, bool]:
    cleaned = Image.new(image.mode, image.size)
    cleaned.putdata(list(image.getdata()))
    cleaned.info.clear()
    if hasattr(image, "getexif"):
        return cleaned, True
    return cleaned, bool(image.info)


def _validate_pdf(content: bytes, settings: Settings) -> tuple[int, list[str]]:
    warnings: list[str] = []
    try:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError
    except ImportError as error:
        raise MediaInspectError("MEDIA_DECODE_FAILED", "PDF reader is unavailable.") from error

    try:
        reader = PdfReader(io.BytesIO(content), strict=True)
    except PdfReadError as error:
        raise MediaInspectError("MEDIA_DECODE_FAILED", "PDF could not be decoded.") from error
    if reader.is_encrypted:
        raise MediaInspectError("MEDIA_PDF_ENCRYPTED", "Encrypted PDF files are not supported.")

    page_count = len(reader.pages)
    if page_count > settings.MEDIA_MAX_PDF_PAGES:
        raise MediaInspectError(
            "MEDIA_PDF_PAGE_LIMIT_EXCEEDED",
            "PDF exceeds configured page limit.",
        )

    rendered_pixels = 0
    try:
        import fitz

        document = fitz.open(stream=content, filetype="pdf")
        for page in document:
            rect = page.rect
            rendered_pixels += int(rect.width * rect.height)
        document.close()
    except Exception:
        warnings.append("PDF page dimensions could not be verified with pymupdf.")

    if rendered_pixels > settings.MEDIA_MAX_TOTAL_RENDERED_PIXELS:
        raise MediaInspectError(
            "MEDIA_PIXEL_LIMIT_EXCEEDED",
            "PDF rendered pixel budget exceeded.",
        )

    return page_count, warnings


def _normalize_image(image: Image.Image, settings: Settings) -> tuple[bytes, str, int, int]:
    format_name = settings.MEDIA_NORMALIZED_IMAGE_FORMAT.upper()
    if format_name == "JPG":
        format_name = "JPEG"
    buffer = io.BytesIO()
    save_kwargs: dict[str, Any] = {"format": format_name}
    if format_name in {"JPEG", "WEBP"}:
        save_kwargs["quality"] = settings.MEDIA_NORMALIZED_IMAGE_QUALITY
    image.save(buffer, **save_kwargs)
    normalized = buffer.getvalue()
    with Image.open(io.BytesIO(normalized)) as normalized_image:
        return normalized, f"image/{settings.MEDIA_NORMALIZED_IMAGE_FORMAT}", *normalized_image.size


def inspect_media_content(content: bytes, settings: Settings) -> InspectedMedia:
    started = perf_counter()
    warnings: list[str] = []
    try:
        kind, verified_mime = _detect_kind(content)
        digest = sha256(content).hexdigest()

        if kind == "image":
            if len(content) > settings.MEDIA_MAX_IMAGE_BYTES:
                raise MediaInspectError(
                    "MEDIA_SIZE_EXCEEDED",
                    "Image exceeds configured byte limit.",
                )
            try:
                image = Image.open(io.BytesIO(content))
                image.load()
            except UnidentifiedImageError as error:
                raise MediaInspectError(
                    "MEDIA_DECODE_FAILED",
                    "Image could not be decoded.",
                ) from error

            width, height = image.size
            pixels = width * height
            if width > settings.MEDIA_MAX_IMAGE_WIDTH or height > settings.MEDIA_MAX_IMAGE_HEIGHT:
                raise MediaInspectError(
                    "MEDIA_DIMENSIONS_EXCEEDED",
                    "Image dimensions exceed configured limits.",
                )
            if pixels > settings.MEDIA_MAX_IMAGE_PIXELS:
                raise MediaInspectError(
                    "MEDIA_PIXEL_LIMIT_EXCEEDED",
                    "Image pixel count exceeds configured limit.",
                )

            stripped_image, metadata_removed = _strip_exif(image)
            normalized_bytes, normalized_mime, normalized_width, normalized_height = (
                _normalize_image(
                    stripped_image,
                    settings,
                )
            )
            hash_value, hash_algorithm = _perceptual_hash(stripped_image)
            actions = ["exif_stripped"] if metadata_removed else []
            actions.append(f"normalized_{settings.MEDIA_NORMALIZED_IMAGE_FORMAT}")

            metadata = VerifiedMediaMetadata(
                verifiedMime=verified_mime,
                kind="image",
                originalBytes=len(content),
                width=width,
                height=height,
                sha256=digest,
            )
            sanitization = SanitizationResult(
                actions=actions,
                warnings=warnings,
                metadataRemoved=metadata_removed,
                normalizedBytes=len(normalized_bytes),
                normalizedSha256=sha256(normalized_bytes).hexdigest(),
                normalizedWidth=normalized_width,
                normalizedHeight=normalized_height,
                normalizedMime=normalized_mime,
            )
            duplicate = DuplicateDetectionResult(
                duplicateStatus="none",
                perceptualHash=hash_value,
                perceptualHashAlgorithm=hash_algorithm,
            )
            response = MediaInspectResponse(
                accepted=True,
                metadata=metadata,
                sanitization=sanitization,
                duplicate=duplicate,
                warnings=warnings,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
            return InspectedMedia(response=response, image=stripped_image)

        if len(content) > settings.MEDIA_MAX_PDF_BYTES:
            raise MediaInspectError("MEDIA_SIZE_EXCEEDED", "PDF exceeds configured byte limit.")
        page_count, pdf_warnings = _validate_pdf(content, settings)
        warnings.extend(pdf_warnings)
        metadata = VerifiedMediaMetadata(
            verifiedMime=verified_mime,
            kind="pdf",
            originalBytes=len(content),
            pageCount=page_count,
            sha256=digest,
        )
        response = MediaInspectResponse(
            accepted=True,
            metadata=metadata,
            sanitization=SanitizationResult(
                actions=["pdf_validated"],
                warnings=warnings,
                metadataRemoved=False,
            ),
            duplicate=DuplicateDetectionResult(duplicateStatus="none"),
            warnings=warnings,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
        return InspectedMedia(response=response, pdf_bytes=content)
    except MediaInspectError as error:
        return InspectedMedia(
            response=MediaInspectResponse(
                accepted=False,
                warnings=warnings,
                errorCode=error.code,
                safeMessage=error.message,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        )


def inspect_media_bytes(content: bytes, settings: Settings) -> MediaInspectResponse:
    return inspect_media_content(content, settings).response
