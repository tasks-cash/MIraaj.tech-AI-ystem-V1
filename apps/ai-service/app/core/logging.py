import logging
from collections.abc import MutableMapping
from typing import Any

import structlog

SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "password",
        "secret",
        "token",
        "apikey",
        "aiserviceinternalsecret",
        "adminapitoken",
        "geminiapikey",
        "mongodburi",
        "redisurl",
        "credentials",
    }
)


def redact_value(key: str, value: Any) -> Any:
    normalized_key = key.lower().replace("_", "").replace("-", "")
    if normalized_key in SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {
            nested_key: redact_value(nested_key, nested_value)
            for nested_key, nested_value in value.items()
        }
    if isinstance(value, list):
        return [redact_value(key, item) for item in value]
    return value


def configure_logging(level: str) -> None:
    logging.basicConfig(format="%(message)s", level=level)

    def redact_processor(
        _logger: object,
        _method_name: str,
        event_dict: MutableMapping[str, Any],
    ) -> MutableMapping[str, Any]:
        for key, value in list(event_dict.items()):
            event_dict[key] = redact_value(key, value)
        return event_dict

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_processor,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level, logging.INFO)),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
