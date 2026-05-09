from __future__ import annotations

from collections import Counter


def sanitize_sandbox_name(sandbox_name: str) -> str:
    normalized = str(sandbox_name or "").strip() or "sandbox-simulation"
    if normalized.endswith("_sandbox.json"):
        return normalized
    return f"{normalized}_sandbox.json"


def build_sandbox_payload(
    *,
    sandbox_name: str,
    agent_name: str,
    recommendations: list[dict],
    report_bullets: list[str],
) -> dict:
    normalized_recommendations = list(recommendations or [])
    total_forecast_demand = sum(float(item.get("predictedDemandQty", 0) or 0) for item in normalized_recommendations)
    total_recommended_qty = sum(float(item.get("recommendedQty", 0) or 0) for item in normalized_recommendations)
    total_estimated_cost = sum(float(item.get("estimatedCost", 0) or 0) for item in normalized_recommendations)
    risk_counter = Counter(
        str(item.get("riskLevel", "low") or "low").strip().lower()
        for item in normalized_recommendations
    )
    shortage_risk_level = "low"
    if risk_counter.get("high", 0) > 0:
        shortage_risk_level = "high"
    elif risk_counter.get("medium", 0) > 0:
        shortage_risk_level = "medium"

    graph_nodes = [
        {
            "id": "scenario-root",
            "label": sandbox_name,
            "type": "scenario",
            "riskLevel": shortage_risk_level,
        }
    ]
    graph_edges = []
    for item in normalized_recommendations:
        material_id = str(item.get("materialId", "") or "").strip() or "unknown-material"
        material_name = str(item.get("materialName", material_id) or material_id).strip()
        risk_level = str(item.get("riskLevel", "low") or "low").strip().lower()

        material_node_id = f"material:{material_id}"
        forecast_node_id = f"forecast:{material_id}"
        inventory_node_id = f"inventory:{material_id}"
        purchase_node_id = f"purchase:{material_id}"

        graph_nodes.extend(
            [
                {
                    "id": material_node_id,
                    "label": material_name,
                    "type": "material",
                    "riskLevel": risk_level,
                },
                {
                    "id": forecast_node_id,
                    "label": f"需求 {item.get('predictedDemandQty', 0)}",
                    "type": "forecast",
                    "riskLevel": risk_level,
                },
                {
                    "id": inventory_node_id,
                    "label": f"库存 {item.get('inventoryAvailableQty', 0)}",
                    "type": "inventory",
                    "riskLevel": "low",
                },
                {
                    "id": purchase_node_id,
                    "label": f"建议采购 {item.get('recommendedQty', 0)}",
                    "type": "purchase",
                    "riskLevel": risk_level,
                },
            ]
        )
        graph_edges.extend(
            [
                {"source": "scenario-root", "target": material_node_id, "label": "SIMULATES"},
                {"source": material_node_id, "target": forecast_node_id, "label": "PREDICTS"},
                {"source": material_node_id, "target": inventory_node_id, "label": "STOCK"},
                {"source": material_node_id, "target": purchase_node_id, "label": "RECOMMENDS"},
            ]
        )

    return {
        "sandboxName": sandbox_name,
        "agentName": agent_name,
        "summary": {
            "forecastDemandQty": round(total_forecast_demand, 6),
            "recommendedPurchaseQty": round(total_recommended_qty, 6),
            "estimatedPurchaseCost": round(total_estimated_cost, 6),
            "shortageRiskLevel": shortage_risk_level,
        },
        "graph": {
            "nodes": graph_nodes,
            "edges": graph_edges,
        },
        "recommendations": normalized_recommendations,
        "report": {
            "headline": report_bullets[0] if report_bullets else "",
            "bullets": list(report_bullets or []),
        },
    }
