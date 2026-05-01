"""
统一 structlog 配置。
所有日志必须含 service / request_id / tenant_id / run_id 字段（如有）。
"""

from __future__ import annotations

import logging


def _require_structlog():
    try:
        import structlog
    except ImportError as exc:
        raise RuntimeError(
            "structlog is required to configure sandbox_simulation logging"
        ) from exc
    return structlog


def configure(level: int = logging.INFO) -> None:
    structlog = _require_structlog()
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )


def get_logger(service: str):
    structlog = _require_structlog()
    return structlog.get_logger().bind(
        service=service,
        request_id=None,
        tenant_id=None,
        run_id=None,
    )
