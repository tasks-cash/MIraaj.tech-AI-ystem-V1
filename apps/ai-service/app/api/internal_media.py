from __future__ import annotations

import io
from time import perf_counter

import structlog
from fastapi import APIRouter, Request

from app.core.config import Settings, get_settings
from app.models.media_schemas import (
    AnalyzeResponse,
    MediaInspectResponse,
    OCRResponse,
    OCRStatusResponse,
    ProviderStatusResponse,
    SignedMediaRequest,
)
from app.services.confidence import compute_confidence_breakdown
from app.services.media_fetch import MediaFetchError, fetch_signed_media
from app.services.media_inspect import inspect_media_content
from app.services.ocr.language_selector import select_ocr_language_packs
from app.services.ocr.preprocess import preprocess_for_ocr
from app.services.ocr.tesseract_provider import TesseractOCRProvider
from app.services.script_detection import detect_scripts
from app.services.vision.disabled_provider import DisabledVisionProvider
from app.services.vision.gemini_provider import GeminiVisionProvider

router = APIRouter(prefix="/internal/v1", tags=["internal-media"])
logger = structlog.get_logger()


def _settings() -> Settings:
    return get_settings()


def _ocr_provider(settings: Settings) -> TesseractOCRProvider:
    return TesseractOCRProvider(settings)


def _vision_provider(settings: Settings) -> DisabledVisionProvider | GeminiVisionProvider:
    if settings.vision_provider_active:
        return GeminiVisionProvider(settings, allow_live_requests=False)
    return DisabledVisionProvider()


def _render_pdf_page(pdf_bytes: bytes, page_index: int) -> bytes:
    import fitz
    from PIL import Image

    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = document.load_page(page_index)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    document.close()
    return buffer.getvalue()


@router.post("/media/inspect")
async def inspect_media(request_body: SignedMediaRequest, request: Request) -> MediaInspectResponse:
    settings = _settings()
    started = perf_counter()
    try:
        fetched = await fetch_signed_media(str(request_body.signedMediaUrl), settings=settings)
        inspected = inspect_media_content(fetched.content, settings)
        logger.info(
            "media_inspect_completed",
            route=request.url.path,
            accepted=inspected.response.accepted,
            request_id=request.headers.get("x-miraaj-request-id"),
        )
        return inspected.response
    except MediaFetchError as error:
        return MediaInspectResponse(
            accepted=False,
            errorCode=error.code,
            safeMessage=error.message,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )


@router.post("/media/ocr")
async def ocr_media(request_body: SignedMediaRequest, request: Request) -> OCRResponse:
    settings = _settings()
    started = perf_counter()
    provider = _ocr_provider(settings)
    hints = request_body.hints

    try:
        fetched = await fetch_signed_media(str(request_body.signedMediaUrl), settings=settings)
        inspected = inspect_media_content(fetched.content, settings)
        if not inspected.response.accepted:
            return OCRResponse(
                accepted=False,
                inspect=inspected.response,
                errorCode=inspected.response.errorCode,
                safeMessage=inspected.response.safeMessage,
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        if not provider.is_available():
            return OCRResponse(
                accepted=False,
                inspect=inspected.response,
                errorCode="OCR_ENGINE_UNAVAILABLE",
                safeMessage="OCR engine is unavailable.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

        script_guess = detect_scripts("")
        selected_packs, unavailable = select_ocr_language_packs(
            installed_packs=(
                provider.installed_language_packs() or settings.ocr_languages_installed_packs
            ),
            default_packs=settings.ocr_languages_default_packs,
            preliminary_packs=settings.ocr_preliminary_language_packs,
            max_languages=settings.OCR_MAX_LANGUAGES_PER_JOB,
            requested_languages=hints.languages if hints else None,
            locale=hints.locale if hints else None,
            country=hints.country if hints else None,
            detected_scripts=script_guess.scripts,
        )
        if inspected.image is not None:
            image_bytes = preprocess_for_ocr(inspected.image, settings)
        elif inspected.pdf_bytes is not None:
            image_bytes = _render_pdf_page(inspected.pdf_bytes, 0)
        else:
            return OCRResponse(
                accepted=False,
                inspect=inspected.response,
                errorCode="MEDIA_DECODE_FAILED",
                safeMessage="OCR input could not be prepared.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

        try:
            ocr_result = provider.run_ocr(
                image_bytes=image_bytes,
                language_packs=tuple(selected_packs),
                timeout_seconds=settings.MEDIA_OCR_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            return OCRResponse(
                accepted=False,
                inspect=inspected.response,
                errorCode="OCR_TIMEOUT",
                safeMessage="OCR timed out.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )
        except RuntimeError as error:
            code = "OCR_LANGUAGE_PACK_MISSING" if "pack" in str(error).lower() else "OCR_FAILED"
            return OCRResponse(
                accepted=False,
                inspect=inspected.response,
                errorCode=code,
                safeMessage="OCR processing failed.",
                processingMs=max(0, round((perf_counter() - started) * 1_000)),
            )

        if unavailable:
            ocr_result.languagesUnavailable = list(
                dict.fromkeys([*ocr_result.languagesUnavailable, *unavailable])
            )
        logger.info(
            "media_ocr_completed",
            route=request.url.path,
            accepted=True,
            request_id=request.headers.get("x-miraaj-request-id"),
        )
        return OCRResponse(
            accepted=True,
            inspect=inspected.response,
            ocr=ocr_result,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )
    except MediaFetchError as error:
        return OCRResponse(
            accepted=False,
            errorCode=error.code,
            safeMessage=error.message,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )


@router.post("/media/analyze")
async def analyze_media(request_body: SignedMediaRequest, request: Request) -> AnalyzeResponse:
    settings = _settings()
    started = perf_counter()
    ocr_response = await ocr_media(request_body, request)
    if not ocr_response.accepted or ocr_response.ocr is None:
        return AnalyzeResponse(
            accepted=False,
            inspect=ocr_response.inspect,
            ocr=ocr_response.ocr,
            errorCode=ocr_response.errorCode,
            safeMessage=ocr_response.safeMessage,
            processingMs=max(0, round((perf_counter() - started) * 1_000)),
        )

    vision_output = None
    vision_provider = _vision_provider(settings)
    hints = request_body.hints
    if vision_provider.is_enabled() and ocr_response.inspect and ocr_response.inspect.metadata:
        metadata = ocr_response.inspect.metadata
        if metadata.kind == "image" and ocr_response.inspect.sanitization:
            try:
                fetched = await fetch_signed_media(
                    str(request_body.signedMediaUrl),
                    settings=settings,
                )
                inspected = inspect_media_content(fetched.content, settings)
                if inspected.image is not None:
                    buffer = io.BytesIO()
                    inspected.image.save(
                        buffer,
                        format=settings.MEDIA_NORMALIZED_IMAGE_FORMAT.upper(),
                    )
                    vision_output = await vision_provider.analyze(
                        image_bytes=buffer.getvalue(),
                        mime_type=metadata.verifiedMime,
                        purpose=hints.purpose if hints else None,
                        locale=hints.locale if hints else None,
                        country=hints.country if hints else None,
                        ocr_text=ocr_response.ocr.normalizedText,
                    )
            except RuntimeError:
                vision_output = None

    script_result = detect_scripts(ocr_response.ocr.normalizedText)
    confidence = compute_confidence_breakdown(
        inspect=ocr_response.inspect,
        ocr=ocr_response.ocr,
        script=script_result,
        language=ocr_response.ocr.languageDetection,
        vision=vision_output,
    )
    return AnalyzeResponse(
        accepted=True,
        inspect=ocr_response.inspect,
        ocr=ocr_response.ocr,
        vision=vision_output,
        confidence=confidence,
        processingMs=max(0, round((perf_counter() - started) * 1_000)),
    )


@router.get("/ocr/status")
async def ocr_status() -> OCRStatusResponse:
    settings = _settings()
    provider = _ocr_provider(settings)
    installed = sorted(
        provider.installed_language_packs() or settings.ocr_languages_installed_packs
    )
    available = provider.is_available()
    return OCRStatusResponse(
        engine=provider.provider_name,
        available=available,
        installedLanguagePacks=installed,
        defaultLanguagePacks=list(settings.ocr_languages_default_packs),
        maxLanguagesPerJob=settings.OCR_MAX_LANGUAGES_PER_JOB,
        preliminaryLanguages=list(settings.ocr_preliminary_language_packs),
        safeError=None if available else "OCR_ENGINE_UNAVAILABLE",
    )


@router.get("/providers/status")
async def providers_status() -> ProviderStatusResponse:
    settings = _settings()
    ocr = await ocr_status()
    vision_enabled = settings.vision_provider_active
    return ProviderStatusResponse(
        ocr=ocr,
        vision={
            "provider": "gemini" if vision_enabled else "disabled",
            "enabled": vision_enabled,
            "configured": settings.GEMINI_API_KEY is not None,
            "model": settings.GEMINI_MODEL if vision_enabled else None,
            "safeError": None if vision_enabled else "VISION_PROVIDER_DISABLED",
        },
    )
