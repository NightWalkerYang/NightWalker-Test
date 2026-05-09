"""
sandbox v1 物化视图刷新入口。

CLI:
  python -m sandbox_simulation.refresh_features
环境变量：
  SANDBOX_PG_DSN
"""

from __future__ import annotations

import logging
import time

from sqlalchemy import text

from ._common.db import get_engine, get_schema
from ._common.logging import configure as configure_logging
from ._common.logging import get_logger

VIEWS = [
    "feature_material_monthly_demand",
    "feature_material_monthly_inflow",
    "feature_material_in_transit",
    "feature_material_inventory_latest",
    "feature_supplier_lead_time",
    "feature_supplier_price",
    "feature_bom_explosion",
    "feature_safety_stock",
]


class _StdLogger:
    def __init__(self, name: str):
        self._logger = logging.getLogger(name)

    def info(self, event: str, **fields) -> None:
        self._logger.info("%s %s", event, fields)

    def error(self, event: str, **fields) -> None:
        self._logger.error("%s %s", event, fields)


def _build_logger():
    try:
        configure_logging()
        return get_logger("refresh_features")
    except Exception:
        logging.basicConfig(level=logging.INFO)
        return _StdLogger("refresh_features")


def main() -> int:
    log = _build_logger()
    engine = get_engine()
    schema = get_schema()
    failures = 0
    for view_name in VIEWS:
        start = time.perf_counter()
        try:
            with engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as conn:
                conn.execute(
                    text(
                        f"REFRESH MATERIALIZED VIEW CONCURRENTLY {schema}.{view_name}"
                    )
                )
            log.info(
                "refresh_ok",
                view=view_name,
                duration_ms=int((time.perf_counter() - start) * 1000),
            )
        except Exception as exc:
            failures += 1
            log.error("refresh_failed", view=view_name, error=str(exc))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
