from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import Settings

LOCALHOST_NAMES = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})
METADATA_HOSTS = frozenset({"169.254.169.254", "metadata.google.internal"})
FETCH_REJECTED = "INTERNAL_MEDIA_FETCH_REJECTED"


class MediaFetchError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class FetchedMedia:
    content: bytes
    content_type: str | None
    final_url: str


def _host_entry_matches(
    parsed_host: str,
    port: int,
    standard_port: int,
    allowlist_entry: str,
) -> bool:
    entry = allowlist_entry.strip().lower()
    if not entry:
        return False

    if entry.startswith("["):
        closing = entry.find("]")
        if closing < 0:
            return False
        host_part = entry[1:closing]
        remainder = entry[closing + 1 :]
        if not remainder:
            return parsed_host == host_part and port == standard_port
        if not remainder.startswith(":"):
            return False
        try:
            entry_port = int(remainder[1:])
        except ValueError:
            return False
        return parsed_host == host_part and port == entry_port

    if entry.count(":") == 1:
        host_part, port_part = entry.rsplit(":", 1)
        try:
            entry_port = int(port_part)
        except ValueError:
            return False
        return parsed_host == host_part and port == entry_port

    return parsed_host == entry and port == standard_port


def _host_allowed(hostname: str, port: int, standard_port: int, settings: Settings) -> bool:
    return any(
        _host_entry_matches(hostname, port, standard_port, entry)
        for entry in settings.media_fetch_allowed_hosts
    )


def _reject(message: str) -> MediaFetchError:
    return MediaFetchError(FETCH_REJECTED, message)


def _validate_url(url: str, settings: Settings) -> tuple[str, int | None]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise _reject("Unsupported URL scheme.")
    if parsed.username or parsed.password:
        raise _reject("URL userinfo is not allowed.")
    if not parsed.hostname:
        raise _reject("URL host is missing.")

    hostname = parsed.hostname.lower()
    port = parsed.port
    standard_port = 443 if parsed.scheme == "https" else 80
    if port is None:
        port = standard_port

    if hostname in METADATA_HOSTS:
        raise _reject("Metadata endpoints are blocked.")

    if (
        settings.APP_ENV == "production"
        and hostname in LOCALHOST_NAMES
        and not _host_allowed(hostname, port, standard_port, settings)
    ):
        raise _reject("Localhost is blocked in production.")

    if not _host_allowed(hostname, port, standard_port, settings):
        message = (
            "Non-standard port is not allowlisted."
            if port != standard_port
            else "URL host is not allowlisted."
        )
        raise _reject(message)

    try:
        resolved = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise _reject("URL host could not be resolved.") from error

    for info in resolved:
        address = info[4][0]
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if (
            ip.is_loopback
            and settings.APP_ENV == "production"
            and not _host_allowed(hostname, port, standard_port, settings)
        ):
            raise _reject("Loopback address is blocked.")
        if ip.is_link_local or ip.is_multicast or ip.is_reserved:
            raise _reject("Private or reserved address is blocked.")
        if ip.is_private and not _host_allowed(hostname, port, standard_port, settings):
            raise _reject("Private network address is blocked.")

    return hostname, port


async def fetch_signed_media(
    url: str,
    *,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> FetchedMedia:
    _validate_url(url, settings)
    timeout = httpx.Timeout(settings.MEDIA_FETCH_TIMEOUT_SECONDS)
    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=timeout, follow_redirects=False)
    try:
        async with http_client.stream("GET", url) as response:
            if response.is_redirect or response.status_code in {301, 302, 303, 307, 308}:
                raise _reject("Redirects are not allowed.")
            if response.status_code >= 400:
                raise _reject("Signed media URL request failed.")

            content_type = response.headers.get("content-type")
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > settings.MEDIA_FETCH_MAX_BYTES:
                    raise MediaFetchError(
                        "MEDIA_SIZE_EXCEEDED",
                        "Download exceeded configured byte limit.",
                    )
                chunks.append(chunk)

            return FetchedMedia(
                content=b"".join(chunks),
                content_type=content_type.split(";")[0].strip() if content_type else None,
                final_url=str(response.url),
            )
    finally:
        if owns_client:
            await http_client.aclose()
