import re
import sys
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

_PHONE_RE = re.compile(r"\b(\+?256|0)[0-9]{9}\b")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_TOKEN_RE = re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)


def _redact_pii(logger: WrappedLogger, method: str, event_dict: EventDict) -> EventDict:
    """Remove phone numbers, emails and tokens from log values."""
    for key, value in list(event_dict.items()):
        if isinstance(value, str):
            value = _PHONE_RE.sub("[PHONE]", value)
            value = _EMAIL_RE.sub("[EMAIL]", value)
            value = _TOKEN_RE.sub(r"\1[TOKEN]", value)
            event_dict[key] = value
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        _redact_pii,
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    import logging

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
        foreign_pre_chain=shared_processors,
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(log_level)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)

