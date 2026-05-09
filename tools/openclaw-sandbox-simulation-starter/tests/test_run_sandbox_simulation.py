from __future__ import annotations

from pathlib import Path
from datetime import date
import json
import sys

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

import run_sandbox_simulation as runner


def sample_input_payload(target_start: str = "2026-04-01", target_end: str = "2026-04-30") -> dict:
    return {
        "runId": "run_demo_1",
        "token": "sandbox-token",
        "sandboxName": "采购预测",
        "agentName": "苏博泰克财务分析助手",
        "question": "未来一个月哪些物料需要提前采购",
        "inputPeriod": {
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
        },
        "targetPeriod": {
            "startDate": target_start,
            "endDate": target_end,
        },
        "selectedDatasetIds": ["sales_order", "purchase_order", "material_master"],
        "dataSource": {
            "dataSourceId": "ds-local-1",
            "sourceTenantCode": "demo-tenant",
            "connection": {
                "host": "127.0.0.1",
                "port": 65432,
                "database": "kingdee_analytics",
                "user": "kb_local",
                "password": "secret",
            }
        },
        "orgScope": {
            "mode": "all",
            "allowedOrgIds": [],
        },
        "selectedMaterialIds": ["M001", "M002"],
    }


def test_build_live_run_payload_prefers_source_tenant_code(monkeypatch):
    captured = {}

    monkeypatch.setattr(
        runner,
        "load_candidate_material_rows",
        lambda **_kwargs: [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "activityQty": 100,
            }
        ],
    )

    def fake_compute_live_material_rows(*, tenant_id, **_kwargs):
        captured["tenant_id"] = tenant_id
        return [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "predictedDemandQty": 50,
                "inventoryAvailableQty": 10,
                "recommendedQty": 40,
                "estimatedCost": 20,
                "riskLevel": "medium",
            }
        ]

    monkeypatch.setattr(runner, "compute_live_material_rows", fake_compute_live_material_rows)

    payload = sample_input_payload()
    runner.build_live_run_payload(payload)

    assert captured["tenant_id"] == "demo-tenant"


def test_build_live_run_payload_requires_selected_material_ids(monkeypatch):
    monkeypatch.setattr(runner, "load_candidate_material_rows", lambda **_kwargs: [])
    monkeypatch.setattr(runner, "compute_live_material_rows", lambda **_kwargs: [])

    payload = sample_input_payload()
    payload["selectedMaterialIds"] = []

    try:
        runner.build_live_run_payload(payload)
    except ValueError as error:
        assert str(error) == "sandbox_selected_material_ids_required"
    else:
        raise AssertionError("expected ValueError for empty selectedMaterialIds")


def test_build_live_run_payload_filters_candidates_by_selected_material_ids(monkeypatch):
    captured = {}

    monkeypatch.setattr(
        runner,
        "load_candidate_material_rows",
        lambda **_kwargs: [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "activityQty": 100,
            },
            {
                "materialId": "M003",
                "materialName": "原料 C",
                "activityQty": 80,
            },
        ],
    )

    def fake_compute_live_material_rows(*, candidate_materials, **_kwargs):
        captured["candidate_material_ids"] = [row["materialId"] for row in candidate_materials]
        return [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "predictedDemandQty": 50,
                "inventoryAvailableQty": 10,
                "recommendedQty": 40,
                "estimatedCost": 20,
                "riskLevel": "medium",
            }
        ]

    monkeypatch.setattr(runner, "compute_live_material_rows", fake_compute_live_material_rows)

    payload = sample_input_payload()
    payload["selectedMaterialIds"] = ["M001"]

    runner.build_live_run_payload(payload)

    assert captured["candidate_material_ids"] == ["M001"]


def test_build_live_run_payload_raises_when_selected_materials_have_no_predictable_candidates(monkeypatch):
    monkeypatch.setattr(runner, "load_candidate_material_rows", lambda **_kwargs: [])
    monkeypatch.setattr(runner, "compute_live_material_rows", lambda **_kwargs: [])

    payload = sample_input_payload()
    payload["selectedMaterialIds"] = ["M404"]

    try:
        runner.build_live_run_payload(payload)
    except ValueError as error:
        assert str(error) == "sandbox_selected_materials_not_found"
    else:
        raise AssertionError("expected ValueError when selected materials have no predictable candidates")


def test_runner_writes_status_and_result_files(tmp_path, monkeypatch):
    run_dir = tmp_path / "Sandbox" / "runs" / "run_demo_1"
    run_dir.mkdir(parents=True)
    input_path = run_dir / "input.json"
    input_payload = sample_input_payload()
    input_path.write_text(json.dumps(input_payload, ensure_ascii=False), encoding="utf-8")

    sample_payload = {
        "sandboxName": "采购预测",
        "agentName": "苏博泰克财务分析助手",
        "summary": {
            "forecastDemandQty": 188,
            "recommendedPurchaseQty": 144,
            "estimatedPurchaseCost": 512,
            "shortageRiskLevel": "medium",
        },
        "graph": {"nodes": [{"id": "scenario-root"}], "edges": []},
        "recommendations": [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "predictedDemandQty": 188,
                "inventoryAvailableQty": 44,
                "recommendedQty": 144,
                "estimatedCost": 512,
                "riskLevel": "medium",
            }
        ],
        "report": {
            "headline": "live result headline",
            "bullets": ["结果来自 live run"],
        },
    }

    monkeypatch.setattr(runner, "build_live_run_payload", lambda payload: sample_payload)

    exit_code = runner.main(["--input", str(input_path)])

    assert exit_code == 0
    status_payload = json.loads((run_dir / "status.json").read_text("utf-8"))
    assert status_payload["status"] == "succeeded"
    assert status_payload["resultAvailable"] is True
    result_payload = json.loads((run_dir / "result.json").read_text("utf-8"))
    assert result_payload["summary"]["forecastDemandQty"] == 188
    assert json.loads((run_dir / "report.json").read_text("utf-8"))["headline"] == "live result headline"
    assert json.loads((run_dir / "graph.json").read_text("utf-8"))["nodes"][0]["id"] == "scenario-root"
    assert json.loads((run_dir / "forecast.json").read_text("utf-8"))["summary"]["forecastDemandQty"] == 188


def test_runner_output_changes_with_target_window(monkeypatch):
    def fake_compute_live_material_rows(*, target_months, **_kwargs):
        month_count = len(target_months)
        return [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "predictedDemandQty": 50 * month_count,
                "inventoryAvailableQty": 10,
                "recommendedQty": 40 * month_count,
                "estimatedCost": 20 * month_count,
                "riskLevel": "medium" if month_count > 1 else "low",
            }
        ]

    monkeypatch.setattr(runner, "compute_live_material_rows", fake_compute_live_material_rows)
    monkeypatch.setattr(
        runner,
        "load_candidate_material_rows",
        lambda **_kwargs: [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "activityQty": 100,
            },
            {
                "materialId": "M002",
                "materialName": "原料 B",
                "activityQty": 90,
            },
        ],
    )

    first = runner.build_live_run_payload(sample_input_payload("2026-04-01", "2026-04-30"))
    second = runner.build_live_run_payload(sample_input_payload("2026-04-01", "2026-06-30"))

    assert first["summary"]["forecastDemandQty"] != second["summary"]["forecastDemandQty"]
    assert first["summary"]["recommendedPurchaseQty"] != second["summary"]["recommendedPurchaseQty"]
    assert first["summary"]["estimatedPurchaseCost"] != second["summary"]["estimatedPurchaseCost"]


def test_runner_output_changes_with_input_history_window(monkeypatch):
    def fake_compute_live_material_rows(*, candidate_materials, history_start_date, history_end_date, **_kwargs):
        day_span = (date.fromisoformat(history_end_date) - date.fromisoformat(history_start_date)).days + 1
        material_factor = len(candidate_materials)
        return [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "predictedDemandQty": day_span * material_factor,
                "inventoryAvailableQty": 10,
                "recommendedQty": day_span * material_factor * 0.8,
                "estimatedCost": day_span * material_factor * 0.4,
                "riskLevel": "medium",
            }
        ]

    monkeypatch.setattr(runner, "compute_live_material_rows", fake_compute_live_material_rows)
    monkeypatch.setattr(
        runner,
        "load_candidate_material_rows",
        lambda **_kwargs: [
            {
                "materialId": "M001",
                "materialName": "原料 A",
                "activityQty": 100,
            }
        ],
    )

    first_payload = sample_input_payload()
    second_payload = sample_input_payload()
    second_payload["inputPeriod"]["startDate"] = "2025-01-01"
    second_payload["inputPeriod"]["endDate"] = "2025-12-31"

    first = runner.build_live_run_payload(first_payload)
    second = runner.build_live_run_payload(second_payload)

    assert first["summary"]["forecastDemandQty"] != second["summary"]["forecastDemandQty"]
    assert first["summary"]["recommendedPurchaseQty"] != second["summary"]["recommendedPurchaseQty"]


def test_load_candidate_material_rows_uses_selected_datasets_and_period(monkeypatch):
    captured_queries = []

    def fake_read_sql_query(query, _engine, params=None):
        sql = str(query)
        captured_queries.append((sql, dict(params or {})))
        if "v_sales_order" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "SO-001",
                        "material_name": "销售物料",
                        "activity_qty": 120.0,
                    }
                ]
            )
        if "v_purchase_order" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "PO-009",
                        "material_name": "",
                        "activity_qty": 80.0,
                    }
                ]
            )
        return pd.DataFrame(columns=["material_id", "material_name", "activity_qty"])

    monkeypatch.setattr(pd, "read_sql_query", fake_read_sql_query)

    rows = runner.load_candidate_material_rows(
        engine=object(),
        selected_dataset_ids=["sales_order", "purchase_order"],
        input_period={
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
        },
        allowed_org_ids=["org-1"],
        schema="sandbox_v1",
        limit=12,
    )

    assert [row["materialId"] for row in rows] == ["SO-001", "PO-009"]
    assert rows[0]["materialName"] == "销售物料"
    assert rows[0]["activityQty"] == 120.0
    assert any("v_sales_order" in sql for sql, _params in captured_queries)
    assert any("v_purchase_order" in sql for sql, _params in captured_queries)
    assert all(params["start_date"] == "2026-01-01" for _sql, params in captured_queries)
    assert all(params["end_date"] == "2026-03-31" for _sql, params in captured_queries)
    assert all(params["org_ids"] == ["org-1"] for _sql, params in captured_queries)


def test_load_candidate_material_rows_routes_dynamic_dataset_ids(monkeypatch):
    captured_queries = []

    def fake_read_sql_query(query, _engine, params=None):
        sql = str(query)
        captured_queries.append((sql, dict(params or {})))
        if "v_purchase_request" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "REQ-001",
                        "material_name": "采购申请物料",
                        "activity_qty": 35.0,
                    }
                ]
            )
        if "v_inventory_snapshot" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "INV-002",
                        "material_name": "库存物料",
                        "activity_qty": 22.0,
                    }
                ]
            )
        if "v_sales_delivery_notice" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "DEL-003",
                        "material_name": "发货通知物料",
                        "activity_qty": 11.0,
                    }
                ]
            )
        return pd.DataFrame(columns=["material_id", "material_name", "activity_qty"])

    monkeypatch.setattr(pd, "read_sql_query", fake_read_sql_query)

    rows = runner.load_candidate_material_rows(
        engine=object(),
        selected_dataset_ids=["pur_requisition", "stk_inventory", "sales_delivery_notice"],
        input_period={
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
        },
        allowed_org_ids=["org-9"],
        schema="sandbox_v1",
        limit=12,
    )

    assert [row["materialId"] for row in rows] == ["REQ-001", "INV-002", "DEL-003"]
    assert any("v_purchase_request" in sql for sql, _params in captured_queries)
    assert any("v_inventory_snapshot" in sql for sql, _params in captured_queries)
    assert any("v_sales_delivery_notice" in sql for sql, _params in captured_queries)
    assert all(params["org_ids"] == ["org-9"] for _sql, params in captured_queries)


def test_load_candidate_material_rows_keeps_selected_materials_outside_default_limit(monkeypatch):
    def fake_read_sql_query(_query, _engine, params=None):
        records = [
            {
                "material_id": f"M{index:03d}",
                "material_name": f"物料 {index}",
                "activity_qty": float(100 - index),
            }
            for index in range(1, 14)
        ]
        return pd.DataFrame.from_records(records)

    monkeypatch.setattr(pd, "read_sql_query", fake_read_sql_query)

    rows = runner.load_candidate_material_rows(
        engine=object(),
        selected_dataset_ids=["sales_order"],
        selected_material_ids=["M013"],
        input_period={
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
        },
        allowed_org_ids=[],
        schema="sandbox_v1",
        limit=12,
    )

    assert [row["materialId"] for row in rows] == ["M013"]


def test_load_candidate_material_rows_material_master_does_not_query_sales_order(monkeypatch):
    captured_queries = []

    def fake_read_sql_query(query, _engine, params=None):
        sql = str(query)
        captured_queries.append((sql, dict(params or {})))
        if "v_inventory_snapshot" in sql:
            return pd.DataFrame.from_records(
                [
                    {
                        "material_id": "MAT-001",
                        "material_name": "库存物料",
                        "activity_qty": 0.0,
                    }
                ]
            )
        return pd.DataFrame(columns=["material_id", "material_name", "activity_qty"])

    monkeypatch.setattr(pd, "read_sql_query", fake_read_sql_query)

    rows = runner.load_candidate_material_rows(
        engine=object(),
        selected_dataset_ids=["material_master"],
        input_period={
            "startDate": "2026-01-01",
            "endDate": "2026-03-31",
        },
        allowed_org_ids=["org-1"],
        schema="sandbox_v1",
        limit=12,
    )

    assert [row["materialId"] for row in rows] == ["MAT-001"]
    assert any("v_inventory_snapshot" in sql for sql, _params in captured_queries)
    assert all("v_sales_order" not in sql for sql, _params in captured_queries)


def test_compute_live_material_rows_passes_history_window_to_predictor(monkeypatch):
    captured_calls = []

    class FakeForecastRow:
        def __init__(self):
            self.material_id = "M001"
            self.material_name = ""
            self.p10 = 3.0
            self.p50 = 30.0
            self.p90 = 9.0

    def fake_predict_demand(**kwargs):
        captured_calls.append(kwargs)
        return [FakeForecastRow()]

    monkeypatch.setattr(runner, "predict_demand", fake_predict_demand)

    rows = runner.compute_live_material_rows(
        engine=object(),
        tenant_id="tenant-1",
        allowed_org_ids=["org-1", "org-2"],
        candidate_materials=[
            {
                "materialId": "M001",
                "materialName": "真实物料",
                "activityQty": 90.0,
            }
        ],
        target_months=[date(2026, 4, 1)],
        history_start_date="2026-01-01",
        history_end_date="2026-03-31",
        history_month_count=3,
        model_dir=None,
        schema="sandbox_v1",
    )

    assert captured_calls[0]["history_start_date"] == "2026-01-01"
    assert captured_calls[0]["history_end_date"] == "2026-03-31"
    assert captured_calls[0]["org_ids"] == ["org-1", "org-2"]
    assert rows[0]["materialId"] == "M001"
    assert rows[0]["materialName"] == "真实物料"
    assert rows[0]["predictedDemandQty"] == 30.0
