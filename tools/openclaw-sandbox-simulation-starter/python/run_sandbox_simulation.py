from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text

from sandbox_simulation._common.db import get_engine
from sandbox_simulation.predict_runtime import predict_demand
from sandbox_simulation.procurement import ProcurementInputs, build_procurement_recommendation
from sandbox_simulation.sandbox_payload import build_sandbox_payload


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a live sandbox simulation into Sandbox/runs/<runId>/ artifacts.")
    parser.add_argument("--input", required=True, help="Path to Sandbox/runs/<runId>/input.json")
    return parser.parse_args(argv)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n", encoding="utf-8")


def write_status(
    run_dir: Path,
    run_id: str,
    status: str,
    *,
    result_available: bool = False,
    error_message: str | None = None,
) -> dict[str, Any]:
    payload = {
        "runId": str(run_id or "").strip(),
        "status": str(status or "").strip() or "failed",
        "resultAvailable": bool(result_available),
        "errorMessage": str(error_message or "").strip() or None,
    }
    write_json(run_dir / "status.json", payload)
    return payload


def month_start(value: str) -> date:
    parsed = date.fromisoformat(str(value or "").strip())
    return parsed.replace(day=1)


def covered_target_months(start_date: str, end_date: str) -> list[date]:
    start = month_start(start_date)
    end = month_start(end_date)
    if end < start:
        raise ValueError("sandbox_target_period_invalid")
    months: list[date] = []
    cursor = start
    while cursor <= end:
        months.append(cursor)
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return months


def compute_history_month_count(input_period: dict[str, Any]) -> int:
    start = date.fromisoformat(str(input_period.get("startDate") or "").strip())
    end = date.fromisoformat(str(input_period.get("endDate") or "").strip())
    if end < start:
        raise ValueError("sandbox_input_period_invalid")
    start_month = start.replace(day=1)
    end_month = end.replace(day=1)
    count = 0
    cursor = start_month
    while cursor <= end_month:
        count += 1
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return max(count, 1)


def _safe_schema(schema: str) -> str:
    normalized = str(schema or "sandbox_v1").strip()
    if not normalized.replace("_", "").isalnum() or normalized[0].isdigit():
        return "sandbox_v1"
    return normalized


def _normalize_selected_dataset_ids(selected_dataset_ids: list[str]) -> list[str]:
    return [str(item or "").strip() for item in selected_dataset_ids if str(item or "").strip()]


def _normalize_allowed_org_ids(allowed_org_ids: list[str] | None) -> list[str]:
    return [str(item or "").strip() for item in (allowed_org_ids or []) if str(item or "").strip()]


def _normalize_selected_material_ids(selected_material_ids: list[str] | None) -> list[str]:
    return [str(item or "").strip() for item in (selected_material_ids or []) if str(item or "").strip()]


def _resolve_candidate_query_keys(selected_dataset_ids: list[str]) -> list[str]:
    normalized_ids = _normalize_selected_dataset_ids(selected_dataset_ids)
    if not normalized_ids:
        return ["sales_order", "sales_outbound", "purchase_order"]

    direct_map = {
        "sales_order": "sales_order",
        "sales_outbound": "sales_outbound",
        "sales_delivery_notice": "sales_delivery_notice",
        "material_master": "inventory_snapshot",
        "purchase_order": "purchase_order",
        "purchase_receipt": "purchase_receipt",
        "pur_requisition": "purchase_request",
        "pur_mrapp": "purchase_mr_app",
        "supplier_price": "purchase_order",
    }

    resolved: list[str] = []
    for dataset_id in normalized_ids:
        mapped = direct_map.get(dataset_id)
        if mapped:
            resolved.append(mapped)
            continue
        if dataset_id.startswith(("sales_", "sal_")):
            resolved.append("sales_delivery_notice" if "delivery" in dataset_id or "notice" in dataset_id else "sales_outbound")
            continue
        if dataset_id.startswith(("pur_", "scp_")):
            if "receive" in dataset_id or "receipt" in dataset_id:
                resolved.append("purchase_receipt")
            elif "requisition" in dataset_id or "mrapp" in dataset_id:
                resolved.append("purchase_request")
            else:
                resolved.append("purchase_order")
            continue
        if dataset_id.startswith("stk_"):
            resolved.append("inventory_snapshot")
            continue
        if dataset_id.startswith("bd_"):
            resolved.append("inventory_snapshot")
            continue
    deduped: list[str] = []
    seen = set()
    for key in resolved:
        if key in seen:
            continue
        seen.add(key)
        deduped.append(key)
    return deduped or ["sales_order", "sales_outbound", "purchase_order"]


def load_candidate_material_rows(
    *,
    engine,
    selected_dataset_ids: list[str],
    selected_material_ids: list[str] | None = None,
    input_period: dict[str, Any],
    allowed_org_ids: list[str] | None,
    schema: str = "sandbox_v1",
    limit: int = 12,
) -> list[dict[str, Any]]:
    import pandas as pd

    if engine is None:
        return []
    safe_schema = _safe_schema(schema)
    normalized_dataset_ids = _normalize_selected_dataset_ids(selected_dataset_ids)
    normalized_org_ids = _normalize_allowed_org_ids(allowed_org_ids)
    normalized_selected_material_ids = _normalize_selected_material_ids(selected_material_ids)
    start_date = str(input_period.get("startDate") or "").strip()
    end_date = str(input_period.get("endDate") or "").strip()
    if not start_date or not end_date:
        raise ValueError("sandbox_input_period_invalid")

    dataset_queries = {
        "sales_order": f"""
            SELECT
                material_id::text AS material_id,
                MAX(COALESCE(material_name, material_id))::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_sales_order
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "sales_outbound": f"""
            SELECT
                material_id::text AS material_id,
                MAX(COALESCE(material_name, material_id))::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_sales_outstock
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "sales_delivery_notice": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_sales_delivery_notice
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "purchase_order": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_purchase_order
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "purchase_receipt": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_purchase_receive
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "purchase_request": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_purchase_request
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "purchase_mr_app": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_purchase_mr_app
             WHERE biz_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
               {{org_filter}}
             GROUP BY material_id
        """,
        "inventory_snapshot": f"""
            SELECT
                material_id::text AS material_id,
                MAX(material_id)::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_inventory_snapshot
             WHERE (snapshot_date IS NULL OR snapshot_date <= CAST(:end_date AS date))
               {{org_filter}}
             GROUP BY material_id
        """,
        "material_master": f"""
            SELECT
                material_id::text AS material_id,
                MAX(COALESCE(material_name, material_id))::text AS material_name,
                SUM(COALESCE(qty, 0))::numeric AS activity_qty
              FROM {safe_schema}.v_inventory_snapshot
             WHERE material_id IS NOT NULL
               AND (snapshot_date IS NULL OR snapshot_date <= CAST(:end_date AS date))
               {{org_filter}}
             GROUP BY material_id
        """,
    }
    ordered_dataset_ids = _resolve_candidate_query_keys(normalized_dataset_ids)

    params: dict[str, object] = {
        "start_date": start_date,
        "end_date": end_date,
    }
    org_filter = ""
    if normalized_org_ids:
        params["org_ids"] = normalized_org_ids
        org_filter = "AND org_id = ANY(:org_ids)"

    ranked_rows: dict[str, dict[str, Any]] = {}
    for dataset_id in ordered_dataset_ids:
        template = dataset_queries.get(dataset_id)
        if not template:
            continue
        query = text(template.replace("{org_filter}", org_filter))
        try:
            frame = pd.read_sql_query(query, engine, params=params)
        except Exception:
            continue
        for record in frame.to_dict("records"):
            material_id = str(record.get("material_id") or "").strip()
            if not material_id:
                continue
            activity_qty = float(record.get("activity_qty") or 0.0)
            material_name = str(record.get("material_name") or material_id).strip() or material_id
            previous = ranked_rows.get(material_id)
            if previous is None or activity_qty > float(previous.get("activityQty", 0.0) or 0.0):
                ranked_rows[material_id] = {
                    "materialId": material_id,
                    "materialName": material_name,
                    "activityQty": activity_qty,
                }
    rows = sorted(
        ranked_rows.values(),
        key=lambda item: (-float(item.get("activityQty", 0.0) or 0.0), str(item.get("materialId", ""))),
    )
    if normalized_selected_material_ids:
        selected_material_id_set = set(normalized_selected_material_ids)
        selected_rows = [row for row in rows if str(row.get("materialId") or "").strip() in selected_material_id_set]
        if selected_rows:
            return selected_rows
    return rows[: max(int(limit or 12), 1)]


def compute_live_material_rows(
    *,
    engine,
    tenant_id: str,
    allowed_org_ids: list[str] | None,
    candidate_materials: list[dict[str, Any]],
    target_months: list[date],
    history_start_date: str,
    history_end_date: str,
    history_month_count: int,
    model_dir: Path | None = None,
    schema: str = "sandbox_v1",
) -> list[dict[str, Any]]:
    normalized_org_ids = _normalize_allowed_org_ids(allowed_org_ids)
    material_ids = [str(item.get("materialId") or "").strip() for item in candidate_materials if str(item.get("materialId") or "").strip()]
    material_lookup = {
        str(item.get("materialId") or "").strip(): item
        for item in candidate_materials
        if str(item.get("materialId") or "").strip()
    }
    if not material_ids:
        return []
    totals: dict[str, dict[str, Any]] = {}
    for target_month in target_months:
        forecast_rows = predict_demand(
            tenant_id=tenant_id,
            org_id=normalized_org_ids[0] if normalized_org_ids else "all",
            org_ids=normalized_org_ids,
            material_ids=material_ids,
            target_month=target_month,
            model_dir=model_dir,
            engine=engine,
            schema=schema,
            history_start_date=history_start_date,
            history_end_date=history_end_date,
        )
        for row in forecast_rows:
            candidate = material_lookup.get(row.material_id, {})
            material = totals.setdefault(
                row.material_id,
                {
                    "materialId": row.material_id,
                    "materialName": str(candidate.get("materialName") or row.material_name or row.material_id).strip() or row.material_id,
                    "predictedDemandQty": 0.0,
                    "inventoryAvailableQty": 0.0,
                    "recommendedQty": 0.0,
                    "estimatedCost": 0.0,
                    "riskLevel": "low",
                },
            )
            forecast_demand_qty = max(float(row.p50 or 0.0), 0.0)
            inventory_available_qty = max(float(row.p10 or 0.0), 0.0)
            activity_qty = max(float(candidate.get("activityQty", 0.0) or 0.0), 0.0)
            confirmed_sales_order_qty = activity_qty / max(history_month_count, 1)
            procurement = build_procurement_recommendation(
                ProcurementInputs(
                    forecast_demand_qty=forecast_demand_qty,
                    confirmed_sales_order_qty=confirmed_sales_order_qty,
                    inventory_available_qty=inventory_available_qty,
                    purchase_in_transit_qty=0.0,
                    production_in_transit_qty=0.0,
                    reserved_qty=0.0,
                    safety_stock_qty=max(forecast_demand_qty * 0.15, 8.0),
                    reorder_min_qty=max(forecast_demand_qty * 0.4, 12.0),
                    order_multiple_qty=1.0,
                    scrap_rate=0.03,
                    unit_purchase_cost=max(float(row.p90 or 0.0) / 10.0, 1.0),
                )
            )
            material["predictedDemandQty"] += round(forecast_demand_qty, 6)
            material["inventoryAvailableQty"] = max(
                float(material["inventoryAvailableQty"]),
                round(inventory_available_qty, 6),
            )
            material["recommendedQty"] += round(float(procurement.recommended_order_qty), 6)
            material["estimatedCost"] += round(float(procurement.estimated_purchase_cost), 6)
            if procurement.net_requirement_qty > 100:
                material["riskLevel"] = "high"
            elif procurement.net_requirement_qty > 20 and material["riskLevel"] != "high":
                material["riskLevel"] = "medium"
    return sorted(
        totals.values(),
        key=lambda item: (
            {"high": 0, "medium": 1, "low": 2}.get(str(item.get("riskLevel", "low")).lower(), 3),
            -float(item.get("estimatedCost", 0.0) or 0.0),
            str(item.get("materialId", "")),
        ),
    )


def build_live_run_payload(input_payload: dict[str, Any]) -> dict[str, Any]:
    target_months = covered_target_months(
        input_payload["targetPeriod"]["startDate"],
        input_payload["targetPeriod"]["endDate"],
    )
    selected_material_ids = _normalize_selected_material_ids(input_payload.get("selectedMaterialIds"))
    if not selected_material_ids:
        raise ValueError("sandbox_selected_material_ids_required")
    selected_dataset_ids = [
        str(item or "").strip()
        for item in input_payload.get("selectedDatasetIds", [])
        if str(item or "").strip()
    ]
    history_month_count = compute_history_month_count(input_payload["inputPeriod"])
    org_ids = _normalize_allowed_org_ids(input_payload.get("orgScope", {}).get("allowedOrgIds") or [])
    data_source = input_payload.get("dataSource", {}) or {}
    tenant_id = str(
        data_source.get("sourceTenantCode")
        or data_source.get("dataSourceId")
        or "tenant-sandbox"
    ).strip()
    try:
        engine = get_engine()
    except Exception:
        engine = None
    candidate_materials = load_candidate_material_rows(
        engine=engine,
        selected_dataset_ids=selected_dataset_ids,
        selected_material_ids=selected_material_ids,
        input_period=input_payload["inputPeriod"],
        allowed_org_ids=org_ids,
        schema="sandbox_v1",
        limit=12,
    )
    selected_material_id_set = set(selected_material_ids)
    candidate_materials = [
        item for item in candidate_materials if str(item.get("materialId") or "").strip() in selected_material_id_set
    ]
    if not candidate_materials:
        raise ValueError("sandbox_selected_materials_not_found")
    recommendations = compute_live_material_rows(
        engine=engine,
        tenant_id=tenant_id,
        allowed_org_ids=org_ids,
        candidate_materials=candidate_materials,
        target_months=target_months,
        history_start_date=str(input_payload["inputPeriod"]["startDate"]).strip(),
        history_end_date=str(input_payload["inputPeriod"]["endDate"]).strip(),
        history_month_count=history_month_count,
        model_dir=None,
        schema="sandbox_v1",
    )
    if not recommendations:
        raise ValueError("sandbox_selected_materials_not_found")
    report_bullets = [
        f"本次按 {input_payload['targetPeriod']['startDate']} 至 {input_payload['targetPeriod']['endDate']} 汇总 {len(target_months)} 个预测月。",
        f"历史依据期间为 {input_payload['inputPeriod']['startDate']} 至 {input_payload['inputPeriod']['endDate']}。",
        f"投入数据包含 {', '.join(selected_dataset_ids) if selected_dataset_ids else '默认目录'}。",
    ]
    return build_sandbox_payload(
        sandbox_name=str(input_payload.get("sandboxName") or "沙盒模拟").strip(),
        agent_name=str(input_payload.get("agentName") or "沙盒模拟助手").strip(),
        recommendations=recommendations,
        report_bullets=report_bullets,
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    input_path = Path(args.input).resolve()
    run_dir = input_path.parent
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    run_id = str(payload.get("runId") or run_dir.name).strip() or run_dir.name
    write_status(run_dir, run_id, "running")
    try:
        result_payload = build_live_run_payload(payload)
        write_json(run_dir / "result.json", result_payload)
        write_json(run_dir / "forecast.json", result_payload)
        write_json(run_dir / "graph.json", result_payload.get("graph") or {})
        write_json(run_dir / "report.json", result_payload.get("report") or {})
        write_status(run_dir, run_id, "succeeded", result_available=True)
        return 0
    except Exception as error:
        write_status(run_dir, run_id, "failed", error_message=str(error)[:300])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
