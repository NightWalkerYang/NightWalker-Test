from __future__ import annotations

import argparse
from pathlib import Path
import json

from sqlalchemy import create_engine, text

from sandbox_simulation.dataset import build_feature_query
from sandbox_simulation.procurement import ProcurementInputs, build_procurement_recommendation
from sandbox_simulation.sandbox_payload import build_sandbox_payload, sanitize_sandbox_name
from sandbox_simulation.training import load_feature_frame


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Sandbox/*.json payload that the OpenClaw sandbox-view route can render."
    )
    parser.add_argument("--dsn", required=True, help="PostgreSQL DSN")
    parser.add_argument(
        "--table-name",
        default="sandbox_simulation.feature_material_monthly",
        help="Feature table or materialized view name",
    )
    parser.add_argument("--tenant-id", help="Optional tenant filter")
    parser.add_argument("--org-id", help="Optional organization filter")
    parser.add_argument("--sandbox-name", default="采购沙盒模拟", help="Visible sandbox name")
    parser.add_argument("--agent-name", default="沙盒模拟助手", help="Visible agent name")
    parser.add_argument("--workspace-dir", required=True, help="Target derived workspace directory")
    parser.add_argument("--top-n", type=int, default=12, help="How many materials to include")
    parser.add_argument("--safety-stock-qty", type=float, default=30, help="Default safety stock")
    parser.add_argument("--reorder-min-qty", type=float, default=50, help="Default reorder minimum")
    parser.add_argument("--order-multiple-qty", type=float, default=10, help="Default order multiple")
    parser.add_argument("--neo4j-uri", help="Optional Neo4j bolt/http URI")
    parser.add_argument("--neo4j-username", help="Optional Neo4j username")
    parser.add_argument("--neo4j-password", help="Optional Neo4j password")
    parser.add_argument("--neo4j-database", default="neo4j", help="Neo4j database")
    return parser.parse_args()


def load_material_name_lookup(dsn: str, rows) -> dict[tuple[str, str, str], str]:
    keys = [
        (
            str(getattr(row, "tenant_id", "") or ""),
            str(getattr(row, "org_id", "") or ""),
            str(getattr(row, "material_id", "") or ""),
        )
        for row in rows
    ]
    keys = [key for key in keys if all(key)]
    if not keys:
        return {}
    tenant_ids = sorted({key[0] for key in keys})
    org_ids = sorted({key[1] for key in keys})
    material_ids = sorted({key[2] for key in keys})

    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    """
                    SELECT DISTINCT ON (tenant_id, org_id, material_id)
                           tenant_id::text AS tenant_id,
                           org_id::text AS org_id,
                           material_id::text AS material_id,
                           material_name::text AS material_name
                      FROM sandbox_v1.v_sales_outstock
                     WHERE tenant_id::text = ANY(:tenant_ids)
                       AND org_id::text = ANY(:org_ids)
                       AND material_id::text = ANY(:material_ids)
                       AND material_name IS NOT NULL
                       AND btrim(material_name::text) <> ''
                     ORDER BY tenant_id, org_id, material_id, biz_date DESC NULLS LAST
                    """
                ),
                {
                    "tenant_ids": tenant_ids,
                    "org_ids": org_ids,
                    "material_ids": material_ids,
                },
            )
            return {
                (row.tenant_id, row.org_id, row.material_id): row.material_name
                for row in result
                if row.material_name
            }
    except Exception:
        return {}
    finally:
        engine.dispose()


def load_sales_unit_price_lookup(dsn: str, rows) -> dict[tuple[str, str, str], float]:
    keys = [
        (
            str(getattr(row, "tenant_id", "") or ""),
            str(getattr(row, "org_id", "") or ""),
            str(getattr(row, "material_id", "") or ""),
        )
        for row in rows
    ]
    keys = [key for key in keys if all(key)]
    if not keys:
        return {}
    tenant_ids = sorted({key[0] for key in keys})
    org_ids = sorted({key[1] for key in keys})
    material_ids = sorted({key[2] for key in keys})

    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    """
                    SELECT tenant_id::text AS tenant_id,
                           org_id::text AS org_id,
                           material_id::text AS material_id,
                           SUM(amount) / NULLIF(SUM(qty), 0) AS unit_price
                      FROM sandbox_v1.v_sales_outstock
                     WHERE tenant_id::text = ANY(:tenant_ids)
                       AND org_id::text = ANY(:org_ids)
                       AND material_id::text = ANY(:material_ids)
                       AND qty > 0
                       AND amount > 0
                     GROUP BY 1, 2, 3
                    """
                ),
                {
                    "tenant_ids": tenant_ids,
                    "org_ids": org_ids,
                    "material_ids": material_ids,
                },
            )
            return {
                (row.tenant_id, row.org_id, row.material_id): float(row.unit_price or 0)
                for row in result
                if float(row.unit_price or 0) > 0
            }
    except Exception:
        return {}
    finally:
        engine.dispose()


def resolve_unit_cost(*, purchase_unit_price: float, fallback_sales_unit_price: float) -> float:
    purchase_price = float(purchase_unit_price or 0)
    if purchase_price > 0:
        return purchase_price
    return max(float(fallback_sales_unit_price or 0), 0.0)


def main() -> int:
    args = parse_args()
    query = build_feature_query(
        table_name=args.table_name,
        tenant_id=args.tenant_id,
        org_id=args.org_id,
    )
    frame = load_feature_frame(dsn=args.dsn, query=query)
    if frame.empty:
        raise SystemExit("No rows returned from feature table")

    month_column = "target_month" if "target_month" in frame.columns else "stat_month"
    demand_column = "rolling_mean_3" if "rolling_mean_3" in frame.columns else "demand_qty_avg_3m"
    inventory_column = (
        "on_hand_qty" if "on_hand_qty" in frame.columns else "inventory_available_qty"
    )
    in_transit_column = "in_transit_qty" if "in_transit_qty" in frame.columns else "purchase_in_transit_qty"
    unit_cost_column = "last_unit_price" if "last_unit_price" in frame.columns else "material_unit_cost"

    latest_rows = (
        frame.loc[frame["material_id"].astype(str).str.strip() != ""]
        .sort_values(["tenant_id", "org_id", "material_id", month_column])
        .groupby(["tenant_id", "org_id", "material_id"], as_index=False)
        .tail(1)
        .copy()
    )
    latest_rows["predictedDemandQty"] = latest_rows[demand_column].fillna(0)
    latest_rows["riskScore"] = (
        latest_rows["predictedDemandQty"].fillna(0) - latest_rows[inventory_column].fillna(0)
    )
    ranked_rows = latest_rows.sort_values(["riskScore", "predictedDemandQty"], ascending=False).head(
        max(int(args.top_n), 1)
    )
    ranked_records = list(ranked_rows.itertuples(index=False))
    material_name_lookup = load_material_name_lookup(args.dsn, ranked_records)
    sales_unit_price_lookup = load_sales_unit_price_lookup(args.dsn, ranked_records)

    recommendations = []
    for row in ranked_records:
        lookup_key = (str(row.tenant_id), str(row.org_id), str(row.material_id))
        unit_cost = resolve_unit_cost(
            purchase_unit_price=float(getattr(row, unit_cost_column, 0) or 0),
            fallback_sales_unit_price=sales_unit_price_lookup.get(lookup_key, 0),
        )
        recommendation = build_procurement_recommendation(
            ProcurementInputs(
                forecast_demand_qty=float(row.predictedDemandQty or 0),
                confirmed_sales_order_qty=0.0,
                inventory_available_qty=float(getattr(row, inventory_column, 0) or 0),
                purchase_in_transit_qty=float(getattr(row, in_transit_column, 0) or 0),
                production_in_transit_qty=0.0,
                reserved_qty=0.0,
                safety_stock_qty=float(args.safety_stock_qty),
                reorder_min_qty=float(args.reorder_min_qty),
                order_multiple_qty=float(args.order_multiple_qty),
                scrap_rate=0.05,
                unit_purchase_cost=unit_cost,
            )
        )
        net_gap = recommendation.net_requirement_qty
        if net_gap > 100:
            risk_level = "high"
        elif net_gap > 20:
            risk_level = "medium"
        else:
            risk_level = "low"
        recommendations.append(
            {
                "materialId": row.material_id,
                "materialName": material_name_lookup.get(lookup_key, row.material_id),
                "unitCost": round(float(unit_cost), 6),
                "predictedDemandQty": round(float(row.predictedDemandQty or 0), 6),
                "inventoryAvailableQty": round(float(getattr(row, inventory_column, 0) or 0), 6),
                "recommendedQty": round(float(recommendation.recommended_order_qty), 6),
                "estimatedCost": round(float(recommendation.estimated_purchase_cost), 6),
                "riskLevel": risk_level,
            }
        )

    report_bullets = [
        f"本次纳入 {len(recommendations)} 个重点物料进行采购沙盒模拟。",
        "建议优先关注高缺口、高成本物料的补货时点。",
        "当前结果基于 feature_material_monthly 和默认采购规则参数生成。",
    ]
    payload = build_sandbox_payload(
        sandbox_name=args.sandbox_name,
        agent_name=args.agent_name,
        recommendations=recommendations,
        report_bullets=report_bullets,
    )

    workspace_dir = Path(args.workspace_dir)
    output_dir = workspace_dir / "Sandbox"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / sanitize_sandbox_name(args.sandbox_name)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.neo4j_uri and args.neo4j_username and args.neo4j_password:
        from sandbox_simulation.neo4j_projection import write_payload_to_neo4j

        write_payload_to_neo4j(
            payload=payload,
            uri=args.neo4j_uri,
            username=args.neo4j_username,
            password=args.neo4j_password,
            database=args.neo4j_database,
        )

    print(f"sandbox payload: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
