from __future__ import annotations

import base64
import hashlib
import io
import json
from difflib import SequenceMatcher
from time import perf_counter

import cv2
import imagehash
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.core.config import Settings
from app.models.distribution_schemas import (
    DistributionAssetInput,
    DistributionAssetResponse,
    ProofVerifyInput,
    ProofVerifyResponse,
)
from app.services.ocr.normalize_text import normalize_ocr_text
from app.services.ocr.tesseract_provider import TesseractOCRProvider


def _png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _decode_qr(image_bytes: bytes) -> list[str]:
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        return []
    variants = [image]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variants.extend(
        [
            gray,
            cv2.resize(gray, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_NEAREST),
            cv2.copyMakeBorder(gray, 32, 32, 32, 32, cv2.BORDER_CONSTANT, value=255),
        ]
    )
    _, threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(threshold)
    for candidate in variants:
        detector = cv2.QRCodeDetector()
        ok, decoded, _, _ = detector.detectAndDecodeMulti(candidate)
        if ok:
            values = [value for value in decoded if value]
            if values:
                return values
        value, _, _ = detector.detectAndDecode(candidate)
        if value:
            return [value]
    return []


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    paths = (
        "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for path in paths:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _render_qr_matrix(matrix: np.ndarray, target_width: int) -> np.ndarray:
    quiet_modules = 4
    modules = matrix.shape[0] + (quiet_modules * 2)
    pixels_per_module = target_width // modules
    if pixels_per_module < 2:
        raise ValueError("QR_PAYLOAD_EXCEEDS_RENDER_CAPACITY")
    bordered = cv2.copyMakeBorder(
        matrix,
        quiet_modules,
        quiet_modules,
        quiet_modules,
        quiet_modules,
        cv2.BORDER_CONSTANT,
        value=255,
    )
    rendered_width = modules * pixels_per_module
    rendered = cv2.resize(
        bordered,
        (rendered_width, rendered_width),
        interpolation=cv2.INTER_NEAREST,
    )
    padding = target_width - rendered_width
    before = padding // 2
    after = padding - before
    return cv2.copyMakeBorder(
        rendered,
        before,
        after,
        before,
        after,
        cv2.BORDER_CONSTANT,
        value=255,
    )


def generate_distribution_assets(
    payload: DistributionAssetInput, settings: Settings
) -> DistributionAssetResponse:
    params = cv2.QRCodeEncoder_Params()  # type: ignore[attr-defined]
    params.correction_level = {
        "L": cv2.QRCodeEncoder_CORRECT_LEVEL_L,
        "M": cv2.QRCodeEncoder_CORRECT_LEVEL_M,
        "Q": cv2.QRCodeEncoder_CORRECT_LEVEL_Q,
        "H": cv2.QRCodeEncoder_CORRECT_LEVEL_H,
    }[settings.DISTRIBUTION_QR_ERROR_CORRECTION_LEVEL]
    encoder = cv2.QRCodeEncoder_create(params)  # type: ignore[attr-defined]
    matrix = encoder.encode(payload.trackedUrl)
    qr_width = settings.DISTRIBUTION_QR_WIDTH
    rendered_qr = _render_qr_matrix(matrix, qr_width)
    ok, encoded = cv2.imencode(".png", rendered_qr)
    if not ok:
        raise ValueError("QR_RENDER_FAILED")
    qr_bytes = encoded.tobytes()
    qr_values = _decode_qr(qr_bytes)
    if payload.trackedUrl not in qr_values:
        raise ValueError("QR_DECODE_VERIFICATION_FAILED")

    header = Image.new("RGB", (payload.width, payload.height), "#071b33")
    draw = ImageDraw.Draw(header)
    qr_size = min(payload.height - 80, payload.width // 3)
    header_qr = _render_qr_matrix(matrix, qr_size)
    qr_image = Image.fromarray(header_qr).convert("RGB")
    qr_x = payload.width - qr_size - 40
    qr_y = (payload.height - qr_size) // 2
    draw.rounded_rectangle(
        (20, 20, payload.width - 20, payload.height - 20), radius=28, outline="#24d0b5", width=5
    )
    draw.text((55, 45), "Miraaj.tech", font=_font(34), fill="#24d0b5")
    text_right = qr_x - 35
    anchor = "ra" if payload.direction == "rtl" else "la"
    text_x = text_right if payload.direction == "rtl" else 55
    draw.text((text_x, 150), payload.headline[:180], font=_font(42), fill="white", anchor=anchor)
    draw.text((text_x, 260), payload.cta[:160], font=_font(28), fill="#d8e6f3", anchor=anchor)
    draw.text(
        (text_x, payload.height - 130),
        payload.disclosure[:220],
        font=_font(20),
        fill="#b3c7d8",
        anchor=anchor,
    )
    draw.text((55, payload.height - 65), payload.proofMarker, font=_font(24), fill="#f5c451")
    header.paste(qr_image, (qr_x, qr_y))
    header_bytes = _png(header)
    header_values = _decode_qr(header_bytes)
    if payload.trackedUrl not in header_values:
        raise ValueError("HEADER_QR_DECODE_VERIFICATION_FAILED")
    return DistributionAssetResponse(
        qrPngBase64=base64.b64encode(qr_bytes).decode("ascii"),
        qrSha256=hashlib.sha256(qr_bytes).hexdigest(),
        qrDecodedPayload=payload.trackedUrl,
        qrDecodeVerified=True,
        headerPngBase64=base64.b64encode(header_bytes).decode("ascii"),
        headerSha256=hashlib.sha256(header_bytes).hexdigest(),
        headerQrDecodedPayload=payload.trackedUrl,
        headerQrDecodeVerified=True,
        width=payload.width,
        height=payload.height,
    )


def _ratio(expected: str, actual: str) -> float:
    return round(
        SequenceMatcher(
            None, normalize_ocr_text(expected).casefold(), normalize_ocr_text(actual).casefold()
        ).ratio(),
        4,
    )


def _result_checksum(decision: str, scores: dict[str, float], reasons: list[str]) -> str:
    def canonical(value: object) -> object:
        if isinstance(value, dict):
            return {key: canonical(value[key]) for key in sorted(value)}
        if isinstance(value, list):
            return [canonical(item) for item in value]
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    checksum_payload = json.dumps(
        canonical({"decision": decision, "scores": scores, "reasons": sorted(set(reasons))}),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(checksum_payload.encode()).hexdigest()


def verify_proof(payload: ProofVerifyInput, settings: Settings) -> ProofVerifyResponse:
    started = perf_counter()
    ocr = TesseractOCRProvider(settings)
    texts: list[str] = []
    qr_values: list[str] = []
    checksums: list[str] = []
    perceptual_hashes: list[str] = []
    indicators: list[dict[str, object]] = []
    ocr_available = ocr.is_available()
    for evidence in payload.screenshotEvidence:
        content = base64.b64decode(evidence.screenshotBase64, validate=True)
        if len(content) > settings.DISTRIBUTION_MAX_SCREENSHOT_BYTES:
            raise ValueError("PROOF_SCREENSHOT_TOO_LARGE")
        checksum = hashlib.sha256(content).hexdigest()
        checksums.append(checksum)
        with Image.open(io.BytesIO(content)) as image:
            image.load()
            if image.width < 320 or image.height < 320:
                indicators.append({"code": "EXCESSIVE_CROP", "risk": 0.7})
            perceptual_hashes.append(str(imagehash.phash(image.convert("RGB"))))
        qr_values.extend(_decode_qr(content))
        if ocr_available:
            result = ocr.run_ocr(
                image_bytes=content,
                language_packs=settings.ocr_languages_default_packs,
                timeout_seconds=settings.MEDIA_OCR_TIMEOUT_SECONDS,
                page_segmentation_mode=6,
            )
            if not result.normalizedText.strip():
                with Image.open(io.BytesIO(content)) as source:
                    source.load()
                    crop = source.crop((0, 0, max(1, int(source.width * 0.7)), source.height))
                    cropped = _png(crop.convert("RGB"))
                result = ocr.run_ocr(
                    image_bytes=cropped,
                    language_packs=("eng",),
                    timeout_seconds=settings.MEDIA_OCR_TIMEOUT_SECONDS,
                    page_segmentation_mode=6,
                )
            texts.append(result.normalizedText)
    text = "\n".join(texts)
    marker_match = payload.proofMarker.casefold() in text.casefold()
    qr_match = payload.trackedUrl in qr_values
    disclosure_match = (
        not payload.requiredDisclosure or payload.requiredDisclosure.casefold() in text.casefold()
    )
    group_score = max((_ratio(group, text) for group in payload.expectedGroups), default=0.5)
    text_score = _ratio(payload.approvedPostText, text)
    exact_duplicate = any(checksum in payload.knownChecksums for checksum in checksums)
    perceptual_duplicate = _matches_known_perceptual_hash(
        perceptual_hashes, payload.knownPerceptualHashes
    )
    duplicate_risk = 1.0 if exact_duplicate else 0.8 if perceptual_duplicate else 0.0
    manipulation_risk = max((float(str(item["risk"])) for item in indicators), default=0.0)
    mandatory = {
        "assignmentActive": True,
        "qrMatches": qr_match,
        "proofMarkerMatches": marker_match,
        "trackedDomainApproved": True,
        "requiredDisclosurePresent": disclosure_match,
        "submittedBeforeDeadline": payload.submittedBeforeDeadline,
    }
    scores = {
        "assignmentBindingScore": 1.0 if qr_match and marker_match else 0.0,
        "qrMatchScore": 1.0 if qr_match else 0.0,
        "proofMarkerScore": 1.0 if marker_match else 0.0,
        "postTextMatchScore": text_score,
        "requiredPhraseScore": text_score,
        "disclosurePresenceScore": 1.0 if disclosure_match else 0.0,
        "groupMatchScore": group_score,
        "professionAudienceScore": 1.0 if payload.profession.casefold() in text.casefold() else 0.5,
        "timestampScore": 1.0 if payload.submittedBeforeDeadline else 0.0,
        "platformScore": 0.7,
        "postUrlScore": 0.0,
        "duplicateRiskScore": duplicate_risk,
        "manipulationRiskScore": manipulation_risk,
        "trackingSupportScore": 0.25,
    }
    positive = sum(value for key, value in scores.items() if not key.endswith("RiskScore")) / 12
    scores["overallVerificationScore"] = round(
        max(0.0, positive - (duplicate_risk * 0.5) - (manipulation_risk * 0.25)), 4
    )
    reasons: list[str] = []
    if not qr_match:
        reasons.append("QR_MISMATCH")
    if not ocr_available:
        reasons.append("OCR_UNAVAILABLE")
    if ocr_available and not marker_match:
        reasons.append("PROOF_MARKER_MISMATCH")
    if ocr_available and not disclosure_match:
        reasons.append("REQUIRED_DISCLOSURE_MISSING")
    if not payload.submittedBeforeDeadline:
        reasons.append("ASSIGNMENT_EXPIRED")
    if exact_duplicate:
        reasons.append("EXACT_PROOF_REUSED")
    elif perceptual_duplicate:
        reasons.append("PERCEPTUAL_DUPLICATE")
    if ocr_available and group_score < 0.25:
        reasons.append("GROUP_MISMATCH")
    automatic_reject = bool(
        {
            "QR_MISMATCH",
            "PROOF_MARKER_MISMATCH",
            "REQUIRED_DISCLOSURE_MISSING",
            "ASSIGNMENT_EXPIRED",
            "EXACT_PROOF_REUSED",
            "GROUP_MISMATCH",
        }.intersection(reasons)
    )
    if automatic_reject:
        decision = "rejected"
    elif (
        payload.privateGroup
        or not ocr_available
        or manipulation_risk >= 0.4
        or scores["overallVerificationScore"] < settings.DISTRIBUTION_AUTO_VERIFY_MIN_SCORE
    ):
        decision = "needs_review"
        reasons.append(
            "PRIVATE_GROUP_REQUIRES_REVIEW" if payload.privateGroup else "HUMAN_REVIEW_REQUIRED"
        )
    else:
        decision = "verified" if settings.DISTRIBUTION_AUTO_VERIFY_ENABLED else "needs_review"
    extracted: dict[str, object] = {
        "ocrText": text,
        "qrPayloads": qr_values,
        "checksums": checksums,
        "perceptualHashes": perceptual_hashes,
        "publicPostInspection": (
            "private_post_unverifiable"
            if payload.privateGroup
            else "inspection_blocked"
            if not settings.DISTRIBUTION_PUBLIC_POST_INSPECTION_ENABLED
            else "unsupported_platform"
        ),
    }
    return ProofVerifyResponse(
        decision=decision,
        scores=scores,
        mandatoryChecks=mandatory,
        reasonCodes=sorted(set(reasons)),
        extractedEvidence=extracted,
        duplicateMatches=[{"type": "exact" if exact_duplicate else "perceptual"}]
        if exact_duplicate or perceptual_duplicate
        else [],
        manipulationIndicators=indicators,
        resultChecksum=_result_checksum(decision, scores, reasons),
        durationMs=max(0, round((perf_counter() - started) * 1000)),
    )


def _matches_known_perceptual_hash(
    observed: list[str], known: list[str], *, maximum_distance: int = 8
) -> bool:
    for value in observed:
        try:
            candidate = imagehash.hex_to_hash(value)
        except ValueError:
            continue
        for prior in known:
            try:
                if candidate - imagehash.hex_to_hash(prior) <= maximum_distance:
                    return True
            except ValueError:
                continue
    return False
