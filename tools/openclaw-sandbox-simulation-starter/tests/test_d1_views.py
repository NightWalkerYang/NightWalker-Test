from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import text

PYTHON_ROOT = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation._common.db import get_engine, get_schema


EXPECTED_VIEWS = [
    "v_sales_outstock",
    "v_sales_order",
    "v_sales_delivery_notice",
    "v_purchase_order",
    "v_purchase_receive",
    "v_inventory_snapshot",
    "v_instock",
    "v_bom",
    "v_purchase_request",
    "v_purchase_mr_app",
]


def _require_sandbox_env() -> None:
    if not os.environ.get("SANDBOX_PG_DSN"):
        pytest.skip("SANDBOX_PG_DSN is required to run D-1 view tests", allow_module_level=True)


def test_schema_exists() -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.schemata
                WHERE schema_name = :schema_name
                """
            ),
            {"schema_name": get_schema()},
        ).scalar()
    assert result == 1


@pytest.mark.parametrize("view_name", EXPECTED_VIEWS)
def test_view_exists(view_name: str) -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.views
                WHERE table_schema = :schema_name
                  AND table_name = :view_name
                """
            ),
            {"schema_name": get_schema(), "view_name": view_name},
        ).scalar()
    assert result == 1, f"view {view_name} not found"


@pytest.mark.parametrize("view_name", EXPECTED_VIEWS)
def test_view_has_tenant_id(view_name: str) -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = :schema_name
                  AND table_name = :view_name
                  AND column_name = 'tenant_id'
                """
            ),
            {"schema_name": get_schema(), "view_name": view_name},
        ).scalar()
    assert result == 1, f"view {view_name} missing tenant_id"


@pytest.mark.parametrize("view_name", EXPECTED_VIEWS)
def test_view_selectable(view_name: str) -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text(f"SELECT * FROM {get_schema()}.{view_name} LIMIT 1"))
