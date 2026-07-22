from fastapi import APIRouter

from app.core.config import get_settings
from app.models.distribution_schemas import (
    DistributionAssetInput,
    DistributionAssetResponse,
    ProofVerifyInput,
    ProofVerifyResponse,
)
from app.services.distribution import generate_distribution_assets, verify_proof

router = APIRouter(prefix="/internal/v1/distribution", tags=["internal-distribution"])


@router.post("/assets", response_model=DistributionAssetResponse)
async def create_assets(payload: DistributionAssetInput) -> DistributionAssetResponse:
    return generate_distribution_assets(payload, get_settings())


@router.post("/proofs/verify", response_model=ProofVerifyResponse)
async def verify_distribution_proof(payload: ProofVerifyInput) -> ProofVerifyResponse:
    return verify_proof(payload, get_settings())


@router.get("/status")
async def distribution_status() -> dict[str, object]:
    settings = get_settings()
    return {
        "qrRenderer": "ready",
        "qrDecoder": "ready",
        "ocr": "ready",
        "autoVerificationEnabled": settings.DISTRIBUTION_AUTO_VERIFY_ENABLED,
        "publicPostInspectionEnabled": settings.DISTRIBUTION_PUBLIC_POST_INSPECTION_ENABLED,
    }
