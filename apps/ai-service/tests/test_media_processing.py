import pytest

from app.core.config import get_settings
from app.services.media_fetch import MediaFetchError, fetch_signed_media
from app.services.media_inspect import inspect_media_bytes
from tests.media_helpers import tiny_pdf_bytes, tiny_png_bytes


@pytest.mark.asyncio
async def test_fetch_rejects_disallowed_host() -> None:
    settings = get_settings()
    with pytest.raises(MediaFetchError) as error:
        await fetch_signed_media("http://evil.example/image.png", settings=settings)
    assert error.value.code == "INTERNAL_MEDIA_FETCH_REJECTED"


@pytest.mark.asyncio
async def test_fetch_rejects_userinfo() -> None:
    settings = get_settings()
    with pytest.raises(MediaFetchError) as error:
        await fetch_signed_media("http://user:pass@127.0.0.1/test.png", settings=settings)
    assert error.value.code == "INTERNAL_MEDIA_FETCH_REJECTED"


@pytest.mark.asyncio
async def test_fetch_rejects_non_allowlisted_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MEDIA_FETCH_ALLOWED_HOSTS", "127.0.0.1")
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    settings = get_settings()
    with pytest.raises(MediaFetchError) as error:
        await fetch_signed_media("http://127.0.0.1:9200/test.png", settings=settings)
    assert error.value.code == "INTERNAL_MEDIA_FETCH_REJECTED"
    reset_settings_cache()


def test_inspect_accepts_png() -> None:
    settings = get_settings()
    result = inspect_media_bytes(tiny_png_bytes(), settings)
    assert result.accepted is True
    assert result.metadata is not None
    assert result.metadata.kind == "image"
    assert result.duplicate is not None
    assert result.duplicate.perceptualHash


def test_inspect_rejects_oversized_image(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MEDIA_MAX_IMAGE_BYTES", "10")
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    settings = get_settings()
    result = inspect_media_bytes(tiny_png_bytes(), settings)
    assert result.accepted is False
    assert result.errorCode == "MEDIA_SIZE_EXCEEDED"
    reset_settings_cache()


def test_inspect_accepts_minimal_pdf() -> None:
    settings = get_settings()
    result = inspect_media_bytes(tiny_pdf_bytes(), settings)
    assert result.accepted is True
    assert result.metadata is not None
    assert result.metadata.kind == "pdf"


def test_inspect_rejects_invalid_signature() -> None:
    settings = get_settings()
    result = inspect_media_bytes(b"not-media", settings)
    assert result.accepted is False
    assert result.errorCode == "MEDIA_SIGNATURE_MISMATCH"
