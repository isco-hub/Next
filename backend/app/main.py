from __future__ import annotations

import uuid

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.api.v1 import admin, auth, extension, feedback, health, outlook, plots, recommendations, reports, translations, ussd
from app.core.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import configure_logging
from app.core.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=settings.environment,
        )

    app = FastAPI(
        title="NextCrop API",
        version=settings.version,
        docs_url="/v1/docs" if not settings.is_production else None,
        redoc_url="/v1/redoc" if not settings.is_production else None,
        openapi_url="/v1/openapi.json",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-trace-id"],
    )

    # Trace ID middleware
    @app.middleware("http")
    async def trace_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
        request.state.trace_id = trace_id
        import structlog
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id, path=request.url.path)
        response = await call_next(request)
        response.headers["x-trace-id"] = trace_id
        return response

    # Exception handlers
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(ValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

    # Routers
    prefix = "/v1"
    app.include_router(health.router, prefix=prefix, tags=["health"])
    app.include_router(outlook.router, prefix=prefix, tags=["outlook"])
    app.include_router(recommendations.router, prefix=prefix, tags=["recommendations"])
    app.include_router(plots.router, prefix=prefix, tags=["plots"])
    app.include_router(feedback.router, prefix=prefix, tags=["feedback"])
    app.include_router(auth.router, prefix=prefix, tags=["auth"])
    app.include_router(ussd.router, prefix=prefix, tags=["ussd"])
    app.include_router(extension.router, prefix=prefix, tags=["extension"])
    app.include_router(admin.router, prefix=prefix, tags=["admin"])
    app.include_router(reports.router, prefix=prefix, tags=["reports"])
    app.include_router(translations.router, prefix=prefix, tags=["translations"])

    return app


app = create_app()

