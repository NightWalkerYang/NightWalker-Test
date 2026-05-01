from pathlib import Path
import os
import sys
import uuid

import pytest
from sqlalchemy import text

PYTHON_ROOT = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation._common.db import get_engine


EXPECTED_TABLES = [
    "scenario_template",
    "scenario_run",
    "scenario_run_input",
    "scenario_run_output",
    "scenario_run_agent_msg",
    "scenario_run_log",
]


def _require_sandbox_env() -> None:
    if not os.environ.get("SANDBOX_PG_DSN"):
        pytest.skip("SANDBOX_PG_DSN is required to run D-3 scenario table tests")


@pytest.mark.parametrize("table", EXPECTED_TABLES)
def test_table_exists(table: str) -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT 1
                  FROM information_schema.tables
                 WHERE table_schema = 'sandbox_v1'
                   AND table_name = :table_name
                """
            ),
            {"table_name": table},
        ).scalar()
    assert result == 1


def test_seed_templates() -> None:
    _require_sandbox_env()
    engine = get_engine()
    with engine.connect() as conn:
        codes = [
            row[0]
            for row in conn.execute(
                text(
                    """
                    SELECT template_code
                      FROM sandbox_v1.scenario_template
                     ORDER BY 1
                    """
                )
            )
        ]
    assert set(codes) == {
        "next_month_purchase",
        "supplier_delay",
        "sales_surge",
        "price_lock",
    }


def test_run_lifecycle_insert() -> None:
    _require_sandbox_env()
    engine = get_engine()
    run_id = str(uuid.uuid4())

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO sandbox_v1.scenario_run (
                    run_id,
                    tenant_id,
                    org_id,
                    member_id,
                    template_code,
                    status
                )
                VALUES (
                    :run_id,
                    'demo-tenant',
                    'demo-org',
                    'demo-member',
                    'next_month_purchase',
                    'running'
                )
                """
            ),
            {"run_id": run_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO sandbox_v1.scenario_run_input (
                    run_id,
                    tenant_id,
                    payload
                )
                VALUES (:run_id, 'demo-tenant', '{}'::jsonb)
                """
            ),
            {"run_id": run_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO sandbox_v1.scenario_run_output (
                    run_id,
                    tenant_id,
                    forecast_json,
                    rule_result_json,
                    graph_json,
                    report_json,
                    report_md
                )
                VALUES (
                    :run_id,
                    'demo-tenant',
                    '{}'::jsonb,
                    '{}'::jsonb,
                    '{}'::jsonb,
                    '{}'::jsonb,
                    'test'
                )
                """
            ),
            {"run_id": run_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO sandbox_v1.scenario_run_agent_msg (
                    run_id,
                    tenant_id,
                    agent_role,
                    msg_seq,
                    role_phase,
                    content_md,
                    structured
                )
                VALUES (
                    :run_id,
                    'demo-tenant',
                    'sales',
                    1,
                    'first_round',
                    'test',
                    '{}'::jsonb
                )
                """
            ),
            {"run_id": run_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO sandbox_v1.scenario_run_log (
                    run_id,
                    tenant_id,
                    step_name,
                    status,
                    duration_ms,
                    log_json
                )
                VALUES (
                    :run_id,
                    'demo-tenant',
                    'predict',
                    'ok',
                    10,
                    '{}'::jsonb
                )
                """
            ),
            {"run_id": run_id},
        )

    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM sandbox_v1.scenario_run WHERE run_id = :run_id"),
            {"run_id": run_id},
        )
