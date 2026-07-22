import base64
import io
from types import SimpleNamespace

import pytest
from PIL import Image, ImageDraw, ImageFont

from app.core.config import get_settings
from app.models.distribution_schemas import (
    DistributionAssetInput,
    ProofEvidenceInput,
    ProofVerifyInput,
)
from app.services.distribution import _result_checksum, generate_distribution_assets, verify_proof


@pytest.fixture(autouse=True)
def deterministic_screenshot_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.distribution.TesseractOCRProvider.run_ocr",
        lambda *args, **kwargs: SimpleNamespace(
            normalizedText=(
                "Dental clinic operations\nMJR-A1B2C3D4E5F6\nDentist professional group"
            )
        ),
    )
    monkeypatch.setattr(
        "app.services.distribution.TesseractOCRProvider.is_available", lambda _self: True
    )


def test_result_checksum_matches_cross_repository_unicode_vector() -> None:
    assert _result_checksum("needs_review", {"z": 0.5, "a": 1.0}, ["B", "A", "A"]) == (
        "f4f7c955e18eabcc88b09b8cd4f6432bbc1a5fc68106b352d515f9334933b3f8"
    )


def _assets(*, direction: str = "ltr", locale: str = "en"):
    return generate_distribution_assets(
        DistributionAssetInput(
            trackedUrl="https://miraaj.example/r/opaque-test-token",
            proofMarker="MJR-A1B2C3D4E5F6",
            headline="حلول تشغيل العيادات لأطباء الأسنان"
            if direction == "rtl"
            else "Dental clinic operations",
            cta="Learn more",
            disclosure="Sponsored distribution task",
            locale=locale,
            direction=direction,
        ),
        get_settings(),
    )


@pytest.mark.parametrize(("direction", "locale"), (("ltr", "en"), ("ltr", "fr"), ("rtl", "ar-DZ")))
def test_local_qr_and_header_round_trip(direction: str, locale: str) -> None:
    result = _assets(direction=direction, locale=locale)
    assert result.qrDecodeVerified is True
    assert result.headerQrDecodeVerified is True
    assert result.qrDecodedPayload == "https://miraaj.example/r/opaque-test-token"
    assert result.headerQrDecodedPayload == result.qrDecodedPayload
    assert len(base64.b64decode(result.headerPngBase64)) > 1_000


def _proof_input(screenshot: str, **overrides: object) -> ProofVerifyInput:
    values: dict[str, object] = {
        "assignmentId": "das_test",
        "trackedUrl": "https://miraaj.example/r/opaque-test-token",
        "proofMarker": "MJR-A1B2C3D4E5F6",
        "approvedPostText": "Dental clinic operations",
        "requiredDisclosure": "",
        "expectedGroups": [],
        "profession": "dentist",
        "platform": "facebook",
        "privateGroup": True,
        "submittedBeforeDeadline": True,
        "screenshotEvidence": [ProofEvidenceInput(screenshotBase64=screenshot)],
    }
    values.update(overrides)
    return ProofVerifyInput.model_validate(values)


def _proof_screenshot() -> str:
    assets = _assets()
    canvas = Image.new("RGB", (1200, 900), "white")
    qr = Image.open(io.BytesIO(base64.b64decode(assets.qrPngBase64))).convert("RGB")
    qr = qr.resize((380, 380), Image.Resampling.NEAREST)
    canvas.paste(qr, (780, 40))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 44)
    draw.text((50, 80), "Dental clinic operations", fill="black", font=font)
    draw.text((50, 180), "MJR-A1B2C3D4E5F6", fill="black", font=font)
    draw.text((50, 280), "Dentist professional group", fill="black", font=font)
    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def test_private_group_proof_routes_to_human_review() -> None:
    result = verify_proof(_proof_input(_proof_screenshot()), get_settings())
    assert result.decision == "needs_review"
    assert result.mandatoryChecks["qrMatches"] is True
    assert "PRIVATE_GROUP_REQUIRES_REVIEW" in result.reasonCodes


def test_wrong_assignment_qr_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), trackedUrl="https://miraaj.example/r/different"),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "QR_MISMATCH" in result.reasonCodes


def test_exact_duplicate_is_rejected() -> None:
    screenshot = _proof_screenshot()
    first = verify_proof(_proof_input(screenshot), get_settings())
    checksum = list(first.extractedEvidence["checksums"])[0]
    duplicate = verify_proof(
        _proof_input(screenshot, knownChecksums=[checksum]),
        get_settings(),
    )
    assert duplicate.decision == "rejected"
    assert "EXACT_PROOF_REUSED" in duplicate.reasonCodes


def test_expired_assignment_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), submittedBeforeDeadline=False),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "ASSIGNMENT_EXPIRED" in result.reasonCodes


def test_missing_disclosure_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), requiredDisclosure="Disclosure not present"),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "REQUIRED_DISCLOSURE_MISSING" in result.reasonCodes


def test_edited_marker_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), proofMarker="MJR-EDITED000000"),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "PROOF_MARKER_MISMATCH" in result.reasonCodes


def test_wrong_group_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), expectedGroups=["unrelated school parent club"]),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "GROUP_MISMATCH" in result.reasonCodes


def test_replaced_tracked_link_is_rejected() -> None:
    result = verify_proof(
        _proof_input(_proof_screenshot(), trackedUrl="https://unapproved.example/replaced"),
        get_settings(),
    )
    assert result.decision == "rejected"
    assert "QR_MISMATCH" in result.reasonCodes
