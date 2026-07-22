import httpx
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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("allowlist", "url"),
    (
        ("127.0.0.1", "http://127.0.0.1/test.png"),
        ("127.0.0.1", "http://127.0.0.1:80/test.png"),
        ("127.0.0.1", "https://127.0.0.1/test.png"),
        ("127.0.0.1", "https://127.0.0.1:443/test.png"),
        ("127.0.0.1:8443", "https://127.0.0.1:8443/test.png"),
    ),
)
async def test_fetch_allows_only_matching_standard_or_explicit_port(
    monkeypatch: pytest.MonkeyPatch,
    allowlist: str,
    url: str,
) -> None:
    monkeypatch.setenv("MEDIA_FETCH_ALLOWED_HOSTS", allowlist)
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    settings = get_settings()
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, content=b"ok", headers={"content-type": "image/png"})

    try:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await fetch_signed_media(url, settings=settings, client=client)
        assert result.content == b"ok"
        assert requests == 1
    finally:
        reset_settings_cache()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("allowlist", "url"),
    (
        ("127.0.0.1", "https://127.0.0.1:8443/test.png"),
        ("127.0.0.1:8443", "https://127.0.0.1:9443/test.png"),
        ("127.0.0.1:8443", "https://127.0.0.1/test.png"),
    ),
)
async def test_fetch_rejects_port_policy_before_network(
    monkeypatch: pytest.MonkeyPatch,
    allowlist: str,
    url: str,
) -> None:
    monkeypatch.setenv("MEDIA_FETCH_ALLOWED_HOSTS", allowlist)
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    settings = get_settings()
    requests = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, content=b"unexpected")

    try:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises(MediaFetchError) as error:
                await fetch_signed_media(url, settings=settings, client=client)
        assert error.value.code == "INTERNAL_MEDIA_FETCH_REJECTED"
        assert requests == 0
    finally:
        reset_settings_cache()


@pytest.mark.asyncio
async def test_fetch_does_not_follow_redirect_to_nonallowlisted_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MEDIA_FETCH_ALLOWED_HOSTS", "127.0.0.1")
    from app.core.config import reset_settings_cache

    reset_settings_cache()
    settings = get_settings()
    requested_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_urls.append(str(request.url))
        return httpx.Response(
            302,
            headers={"location": "http://127.0.0.1:9200/private.png"},
        )

    try:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            follow_redirects=False,
        ) as client:
            with pytest.raises(MediaFetchError) as error:
                await fetch_signed_media(
                    "http://127.0.0.1/image.png",
                    settings=settings,
                    client=client,
                )
        assert error.value.code == "INTERNAL_MEDIA_FETCH_REJECTED"
        assert requested_urls == ["http://127.0.0.1/image.png"]
    finally:
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
