from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class AppError(Exception):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_type: str = "about:blank"
    title: str = "Internal Server Error"

    def __init__(self, detail: str | None = None, **extra: Any) -> None:
        self.detail = detail
        self.extra = extra
        super().__init__(detail)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_type = "/errors/not-found"
    title = "Not Found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    error_type = "/errors/conflict"
    title = "Conflict"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    error_type = "/errors/forbidden"
    title = "Forbidden"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_type = "/errors/unauthorized"
    title = "Unauthorized"


class RateLimitError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_type = "/errors/rate-limit"
    title = "Too Many Requests"


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_type = "/errors/validation"
    title = "Validation Error"


def _problem_response(
    status_code: int,
    error_type: str,
    title: str,
    detail: str | None,
    trace_id: str,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": error_type,
        "title": title,
        "status": status_code,
        "trace_id": trace_id,
    }
    if detail:
        body["detail"] = detail
    if errors:
        body["errors"] = errors
    return JSONResponse(
        content=body,
        status_code=status_code,
        media_type="application/problem+json",
        headers={"x-trace-id": trace_id},
    )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    return _problem_response(
        exc.status_code, exc.error_type, exc.title, exc.detail, trace_id
    )


async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    errors = [
        {"field": ".".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return _problem_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "/errors/validation",
        "Validation Error",
        "Request body failed validation.",
        trace_id,
        errors,
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    return _problem_response(500, "about:blank", "Internal Server Error", None, trace_id)

