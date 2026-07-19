import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.security import (
    InternalAuthenticationError,
    internal_replay_cache,
    verify_internal_request,
)

CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,200}$")
SIGNED_HEADER_NAMES = (
    "x-miraaj-service",
    "x-miraaj-timestamp",
    "x-miraaj-request-id",
    "x-miraaj-correlation-id",
    "idempotency-key",
    "x-miraaj-content-sha256",
    "x-miraaj-signature",
)


def safe_request_id(value: str | None) -> str:
    if value:
        try:
            return str(UUID(value))
        except ValueError:
            pass
    return str(uuid4())


def safe_correlation_id(value: str | None, request_id: str) -> str:
    if value and CORRELATION_ID_PATTERN.fullmatch(value):
        return value
    return request_id


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    logger = structlog.get_logger()
    logger.info(
        "service_started",
        service="miraaj-ai-service",
        version=settings.AI_SERVICE_VERSION,
        environment=settings.APP_ENV,
    )
    yield
    logger.info("service_stopped", service="miraaj-ai-service")


app = FastAPI(
    title="Miraaj.tech AI Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


@app.middleware("http")
async def protect_internal_routes(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = safe_request_id(request.headers.get("x-miraaj-request-id"))
    correlation_id = safe_correlation_id(
        request.headers.get("x-miraaj-correlation-id"),
        request_id,
    )
    if request.url.path.startswith("/v1/"):
        body = await request.body()
        try:
            if any(len(request.headers.getlist(name)) > 1 for name in SIGNED_HEADER_NAMES):
                raise InternalAuthenticationError("Duplicate internal authentication headers.")
            raw_query = request.scope.get("query_string", b"")
            canonical_route = request.url.path
            if isinstance(raw_query, bytes) and raw_query:
                canonical_route = f"{canonical_route}?{raw_query.decode('ascii')}"
            request.state.internal_request = verify_internal_request(
                method=request.method,
                path=canonical_route,
                body=body,
                headers=request.headers,
                settings=get_settings(),
                replay_cache=internal_replay_cache,
            )
        except InternalAuthenticationError:
            structlog.get_logger().warning(
                "internal_auth_failed",
                route=request.url.path,
                request_id=request_id,
                correlation_id=correlation_id,
                safe_error_code="INTERNAL_AUTHENTICATION_FAILED",
            )
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "INTERNAL_AUTHENTICATION_FAILED",
                        "message": "Internal authentication failed.",
                    },
                    "requestId": request_id,
                    "correlationId": correlation_id,
                },
            )
    response = await call_next(request)
    response.headers["x-miraaj-request-id"] = request_id
    response.headers["x-miraaj-correlation-id"] = correlation_id
    return response


app.include_router(health_router)
