import io
import time
from hashlib import sha256
from typing import Any

from PIL import Image

from app.core.config import get_settings


def tiny_png_bytes(text: str = "TEST") -> bytes:
    image = Image.new("RGB", (120, 40), color=(240, 240, 240))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def tiny_jpeg_bytes() -> bytes:
    image = Image.new("RGB", (64, 64), color=(255, 0, 0))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def tiny_pdf_bytes() -> bytes:
    import fitz

    document = fitz.open()
    page = document.new_page(width=200, height=200)
    page.insert_text((72, 72), "Miraaj.tech test PDF")
    payload = document.tobytes()
    document.close()
    return payload


def signed_headers(
    body: bytes,
    *,
    timestamp: int | None = None,
    method: str = "POST",
    path: str = "/internal/v1/media/inspect",
    idempotency_key: str = "media-inspect-1",
) -> dict[str, str]:
    import hmac

    from app.core.security import body_sha256, canonical_request

    settings = get_settings()
    request_id = "23a9022a-6d80-4a1e-b6a8-ea13bea7371e"
    correlation_id = "corr-23a9022a"
    current_timestamp = timestamp or int(time.time())
    content_hash = body_sha256(body)
    canonical = canonical_request(
        method=method,
        path=path,
        service_id="miraaj-api",
        timestamp=current_timestamp,
        request_id=request_id,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        content_sha256=content_hash,
    )
    signature = hmac.new(
        settings.AI_SERVICE_INTERNAL_SECRET.get_secret_value().encode(),
        canonical.encode(),
        sha256,
    ).hexdigest()
    return {
        "x-miraaj-service": "miraaj-api",
        "x-miraaj-timestamp": str(current_timestamp),
        "x-miraaj-request-id": request_id,
        "x-miraaj-correlation-id": correlation_id,
        "idempotency-key": idempotency_key,
        "x-miraaj-content-sha256": content_hash,
        "x-miraaj-signature": signature,
    }


def inspect_payload(url: str = "http://127.0.0.1:9200/media/test.png") -> dict[str, Any]:
    return {"signedMediaUrl": url}
