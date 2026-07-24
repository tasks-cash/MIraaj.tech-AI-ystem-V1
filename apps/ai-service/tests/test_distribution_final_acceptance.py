from __future__ import annotations

import base64
import hashlib
import io
from dataclasses import dataclass
from types import SimpleNamespace

import imagehash
import pytest
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from app.core.config import get_settings
from app.models.distribution_schemas import (
    DistributionAssetInput,
    ProofEvidenceInput,
    ProofVerifyInput,
)
from app.services.distribution import (
    _decode_qr,
    _matches_known_perceptual_hash,
    generate_distribution_assets,
    verify_proof,
)

TRACKED_ORIGIN = "https://miraaj.example"
ARABIC_HEADLINE = "نظام إدارة العيادات المصمم لأطباء الأسنان في الجزائر"
DISCLOSURE = "محتوى إعلاني"


@dataclass(frozen=True)
class PilotAssignment:
    external_user_id: str
    external_assignment_id: str
    assignment_token_hash: str
    tracked_url: str
    qr_payload: str
    qr_checksum: str
    proof_marker: str
    header_checksum: str
    campaign_revision: int = 1
    template_revision: int = 1
    copy_revision: int = 1
    locale: str = "ar-DZ"
    external_task_id: str = "dentist-pilot-task"


def _settings(**updates: object):
    return get_settings().model_copy(update=updates)


def _asset(
    token: str,
    marker: str,
    *,
    locale: str = "ar-DZ",
    direction: str = "rtl",
    width: int = 1200,
    height: int = 630,
    headline: str = ARABIC_HEADLINE,
):
    return generate_distribution_assets(
        DistributionAssetInput(
            trackedUrl=f"{TRACKED_ORIGIN}/r/{token}",
            proofMarker=marker,
            headline=headline,
            cta="اعرف المزيد",
            disclosure=DISCLOSURE,
            locale=locale,
            direction=direction,
            width=width,
            height=height,
        ),
        _settings(),
    )


def _bytes(value: str) -> bytes:
    return base64.b64decode(value)


def _encoded(image: Image.Image, image_format: str = "PNG", **save: object) -> bytes:
    output = io.BytesIO()
    image.save(output, format=image_format, **save)
    return output.getvalue()


def _decode(image: Image.Image, image_format: str = "PNG", **save: object) -> list[str]:
    return _decode_qr(_encoded(image, image_format, **save))


@pytest.fixture(autouse=True)
def deterministic_arabic_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.distribution.TesseractOCRProvider.run_ocr",
        lambda *args, **kwargs: SimpleNamespace(
            normalizedText=f"{ARABIC_HEADLINE}\nMJR-DENTIST-01\nمجموعة أطباء الأسنان\n{DISCLOSURE}"
        ),
    )
    monkeypatch.setattr(
        "app.services.distribution.TesseractOCRProvider.is_available", lambda _self: True
    )


def test_ten_unique_arabic_dentist_pilot_assignments() -> None:
    assignments: list[PilotAssignment] = []
    for index in range(10):
        sequence = index + 1
        user = f"dentist-user-{sequence:02d}"
        external_assignment = f"dentist-assignment-{sequence:02d}"
        token = hashlib.sha256(f"tracked:{sequence}".encode()).hexdigest()
        assignment_token_hash = hashlib.sha256(f"secret:{sequence}".encode()).hexdigest()
        marker = f"MJR-DENTIST-{sequence:02d}"
        assets = _asset(token, marker)
        assignments.append(
            PilotAssignment(
                external_user_id=user,
                external_assignment_id=external_assignment,
                assignment_token_hash=assignment_token_hash,
                tracked_url=f"{TRACKED_ORIGIN}/r/{token}",
                qr_payload=assets.qrDecodedPayload,
                qr_checksum=assets.qrSha256,
                proof_marker=marker,
                header_checksum=assets.headerSha256,
            )
        )
        assert assets.qrDecodeVerified and assets.headerQrDecodeVerified
        assert assets.qrDecodedPayload == assignments[-1].tracked_url
        assert assignments[-1].locale == "ar-DZ"
        assert assignments[-1].external_task_id == "dentist-pilot-task"
        assert not any(
            forbidden in assignments[-1].__dict__
            for forbidden in ("rewardAmount", "currency", "wallet", "settlement")
        )

    for field in (
        "external_user_id",
        "external_assignment_id",
        "assignment_token_hash",
        "tracked_url",
        "qr_payload",
        "qr_checksum",
        "proof_marker",
        "header_checksum",
    ):
        assert len({getattr(item, field) for item in assignments}) == 10
    assert len(assignments) == 10


@pytest.mark.parametrize("level", ["L", "M", "Q", "H"])
@pytest.mark.parametrize(
    "token",
    ["short", "typical-token-0123456789", "x" * 64, "y" * 128],
)
def test_qr_generation_payload_and_error_correction_matrix(level: str, token: str) -> None:
    tracked = f"{TRACKED_ORIGIN}/r/{token}"
    result = generate_distribution_assets(
        DistributionAssetInput(
            trackedUrl=tracked,
            proofMarker="MJR-MATRIX-01",
            headline="Dental clinic management",
            locale="en",
            direction="ltr",
        ),
        _settings(DISTRIBUTION_QR_ERROR_CORRECTION_LEVEL=level),
    )
    qr = _bytes(result.qrPngBase64)
    assert _decode_qr(qr) == [tracked]
    assert hashlib.sha256(qr).hexdigest() == result.qrSha256
    assert all(value not in tracked for value in ("dentist-user", "@", "+213", "reward"))


def test_qr_transformation_matrix() -> None:
    result = _asset("transformation-token", "MJR-TRANSFORM-01")
    payload = result.qrDecodedPayload
    original = Image.open(io.BytesIO(_bytes(result.qrPngBase64))).convert("RGB")
    transformations = {
        "original": original,
        "nearest_up": original.resize((1024, 1024), Image.Resampling.NEAREST),
        "quality_up": original.resize((1024, 1024), Image.Resampling.LANCZOS),
        "moderate_down": original.resize((512, 512), Image.Resampling.LANCZOS),
        "minimum_down": original.resize((320, 320), Image.Resampling.NEAREST),
        "padding": ImageOps.expand(original, border=80, fill="white"),
        "brightness_up": ImageEnhance.Brightness(original).enhance(1.15),
        "brightness_down": ImageEnhance.Brightness(original).enhance(0.85),
        "contrast_up": ImageEnhance.Contrast(original).enhance(1.2),
        "mild_sharpen": original.filter(ImageFilter.SHARPEN),
    }
    for name, image in transformations.items():
        assert payload in _decode(image), name
    assert payload in _decode(original, "JPEG", quality=92)
    assert payload in _decode(original, "JPEG", quality=75)
    low_contrast = ImageEnhance.Contrast(original).enhance(0.08)
    assert _decode(low_contrast) in ([], [payload])
    damaged = original.crop((150, 150, original.width, original.height))
    assert payload not in _decode(damaged)
    wrong = _asset("wrong-assignment-token", "MJR-WRONG-01")
    assert _decode_qr(_bytes(wrong.qrPngBase64)) == [wrong.qrDecodedPayload]
    assert wrong.qrDecodedPayload != payload


@pytest.mark.parametrize(
    ("locale", "direction", "headline"),
    [
        ("ar-DZ", "rtl", ARABIC_HEADLINE * 2),
        ("en", "ltr", "Clinic management for professional dental teams " * 2),
        ("fr", "ltr", "Gestion de clinique pour les équipes dentaires " * 2),
    ],
)
@pytest.mark.parametrize("dimensions", [(1200, 630), (1080, 1080), (1080, 1350), (1080, 1920)])
def test_header_language_size_and_transformation_matrix(
    locale: str, direction: str, headline: str, dimensions: tuple[int, int]
) -> None:
    width, height = dimensions
    first = _asset(
        "opaque-header-matrix-token",
        "MJR-HEADER-01",
        locale=locale,
        direction=direction,
        width=width,
        height=height,
        headline=headline,
    )
    second = _asset(
        "opaque-header-matrix-token",
        "MJR-HEADER-01",
        locale=locale,
        direction=direction,
        width=width,
        height=height,
        headline=headline,
    )
    header = Image.open(io.BytesIO(_bytes(first.headerPngBase64))).convert("RGB")
    assert header.size == dimensions
    assert first.headerQrDecodedPayload == first.qrDecodedPayload
    assert first.headerSha256 == second.headerSha256
    assert first.qrDecodedPayload in _decode(header)
    preview_width = max(630, width // 2)
    preview_height = max(630, height // 2)
    preview = header.resize((preview_width, preview_height), Image.Resampling.LANCZOS)
    assert _decode(preview) in ([first.qrDecodedPayload], [])
    compressed = _decode(header, "JPEG", quality=82)
    assert compressed in ([first.qrDecodedPayload], [])
    different = _asset(
        "opaque-header-matrix-token-other",
        "MJR-HEADER-02",
        locale=locale,
        direction=direction,
        width=width,
        height=height,
        headline=headline,
    )
    assert different.headerSha256 != first.headerSha256


def test_private_dentist_proof_duplicate_and_false_positive_matrix() -> None:
    assets = _asset("proof-token", "MJR-DENTIST-01")
    header = Image.open(io.BytesIO(_bytes(assets.headerPngBase64))).convert("RGB")
    screenshot = Image.new("RGB", (1400, 900), "white")
    screenshot.paste(header.resize((1200, 630)), (100, 80))
    original = _encoded(screenshot)
    original_hash = str(imagehash.phash(screenshot))
    transformed = [
        screenshot.resize((1120, 720), Image.Resampling.LANCZOS),
        ImageEnhance.Brightness(screenshot).enhance(1.05),
        ImageEnhance.Contrast(screenshot).enhance(1.05),
        screenshot.filter(ImageFilter.GaussianBlur(0.35)),
    ]
    for image in transformed:
        assert _matches_known_perceptual_hash([str(imagehash.phash(image))], [original_hash])
    different = Image.new("RGB", screenshot.size, "#203040")
    assert not _matches_known_perceptual_hash([str(imagehash.phash(different))], [original_hash])

    proof = ProofVerifyInput(
        assignmentId="dentist-assignment-01",
        trackedUrl=assets.qrDecodedPayload,
        proofMarker="MJR-DENTIST-01",
        approvedPostText=ARABIC_HEADLINE,
        requiredDisclosure=DISCLOSURE,
        expectedGroups=["مجموعة أطباء الأسنان"],
        profession="dentist",
        platform="facebook",
        privateGroup=True,
        submittedBeforeDeadline=True,
        screenshotEvidence=[
            ProofEvidenceInput(screenshotBase64=base64.b64encode(original).decode())
        ],
    )
    result = verify_proof(proof, _settings())
    assert result.decision == "needs_review"
    assert result.mandatoryChecks["qrMatches"] is True
    assert "PRIVATE_GROUP_REQUIRES_REVIEW" in result.reasonCodes
    duplicate = verify_proof(
        proof.model_copy(update={"knownChecksums": list(result.extractedEvidence["checksums"])}),
        _settings(),
    )
    assert duplicate.decision == "rejected"
    assert duplicate.reasonCodes == sorted(set(duplicate.reasonCodes))
    assert "EXACT_PROOF_REUSED" in duplicate.reasonCodes
