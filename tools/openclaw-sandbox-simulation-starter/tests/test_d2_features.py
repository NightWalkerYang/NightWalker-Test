from pathlib import Path
import os
import sys

import pytest
from sqlalchemy import text

PYTHON_ROOT = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation._common.db import get_engine

EXPECTED_MVS = [
    "feature_material_monthly_demand",
    "feature_material_monthly_inflow",
    "feature_material_in_transit",
    "feature_material_inventory_latest",
    "feature_supplier_lead_time",
    "feature_supplier_price",
    "feature_bom_explosion",
    "feature_safety_stock",
]


def _require_sandbox_env() -> None:
    if not os.environ.get("SANDBOX_PG_DSN"):
        pytest.skip("SANDBOX_PG_DSN is required to run D-2 feature tests")


@pytest.mark.parametrize("mv", EXPECTED_MVS)
def test_mv_exists(mv):
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                  FROM pg_matviews
                 WHERE schemaname = 'sandbox_v1' AND matviewname = :v
                """
            ),
            {"v": mv},
        ).scalar()
    assert result == 1, f"{mv} not found"


@pytest.mark.parametrize("mv", EXPECTED_MVS)
def test_mv_has_unique_index(mv):
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT COUNT(*)
                  FROM pg_index idx
                  JOIN pg_class tbl
                    ON tbl.oid = idx.indrelid
                  JOIN pg_namespace ns
                    ON ns.oid = tbl.relnamespace
                 WHERE ns.nspname = 'sandbox_v1'
                   AND tbl.relname = :v
                   AND idx.indisunique
                """
            ),
            {"v": mv},
        ).scalar()
    assert result >= 1, f"{mv} has no unique index"


@pytest.mark.parametrize("mv", EXPECTED_MVS)
def test_mv_refresh_concurrent(mv):
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY sandbox_v1.{mv}"))


def test_bom_no_cycle():
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        max_depth = conn.execute(
            text("SELECT MAX(depth) FROM sandbox_v1.feature_bom_explosion")
        ).scalar()
    if max_depth is not None:
        assert max_depth <= 8


def test_bom_unique_index_present():
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                  FROM pg_indexes
                 WHERE schemaname = 'sandbox_v1'
                   AND tablename = 'feature_bom_explosion'
                   AND indexname = 'idx_feature_bom_explosion_uniq'
                """
            )
        ).scalar()
    assert result == 1, "feature_bom_explosion missing md5(path::text) unique index"
