from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation.sandbox_payload import build_sandbox_payload, sanitize_sandbox_name
from generate_sandbox_payload import resolve_unit_cost


def test_sanitize_sandbox_name_creates_expected_workspace_file_name():
    assert sanitize_sandbox_name("采购沙盒模拟") == "采购沙盒模拟_sandbox.json"


def test_build_sandbox_payload_summarizes_recommendations_and_builds_graph():
    payload = build_sandbox_payload(
        sandbox_name="采购沙盒模拟",
        agent_name="苏博泰克财务分析助手",
        recommendations=[
            {
                "materialId": "M001",
                "materialName": "原料 B",
                "predictedDemandQty": 150,
                "inventoryAvailableQty": 40,
                "recommendedQty": 130,
                "estimatedCost": 1105,
                "riskLevel": "high",
            }
        ],
        report_bullets=["原料 B 是主要瓶颈"],
    )

    assert payload["sandboxName"] == "采购沙盒模拟"
    assert payload["agentName"] == "苏博泰克财务分析助手"
    assert payload["summary"]["forecastDemandQty"] == 150
    assert payload["summary"]["recommendedPurchaseQty"] == 130
    assert payload["summary"]["estimatedPurchaseCost"] == 1105
    assert payload["summary"]["shortageRiskLevel"] == "high"
    assert len(payload["graph"]["nodes"]) >= 4
    assert len(payload["graph"]["edges"]) >= 3


def test_build_sandbox_payload_includes_prediction_evidence_summary_contract():
    payload = build_sandbox_payload(
        sandbox_name="采购沙盒模拟",
        agent_name="苏博泰克财务分析助手",
        recommendations=[
            {
                "materialId": "M001",
                "materialName": "原料 B",
                "predictedDemandQty": 150,
                "inventoryAvailableQty": 20,
                "recommendedQty": 130,
                "estimatedCost": 1105,
                "riskLevel": "high",
            }
        ],
        report_bullets=["本次纳入 1 个重点物料。"],
        evidence_summary={
            "defaultProfile": "balanced",
            "availableProfiles": [
                "balanced",
                "risk",
                "cost",
                "supply_assurance",
                "inventory_safety",
            ],
            "defaultVisibleCount": 5,
            "ruleCatalogVersion": "sandbox-evidence-v1",
        },
    )

    assert payload["evidenceSummary"] == {
        "defaultProfile": "balanced",
        "availableProfiles": [
            "balanced",
            "risk",
            "cost",
            "supply_assurance",
            "inventory_safety",
        ],
        "defaultVisibleCount": 5,
        "ruleCatalogVersion": "sandbox-evidence-v1",
    }


def test_build_sandbox_payload_preserves_prediction_evidence_row_fields():
    payload = build_sandbox_payload(
        sandbox_name="采购沙盒模拟",
        agent_name="苏博泰克财务分析助手",
        recommendations=[
            {
                "materialId": "M001",
                "materialName": "原料 B",
                "predictedDemandQty": 150,
                "inventoryAvailableQty": 20,
                "recommendedQty": 130,
                "estimatedCost": 1105,
                "riskLevel": "high",
                "impactScore": 0.84,
                "impactProfile": "balanced",
                "whyText": "当前库存不足以覆盖预测需求。",
                "evidence": {
                    "historyDemandAvg": 120,
                    "historyDemandRecent3Months": [
                        {"month": "2024-01", "demandQty": 110},
                        {"month": "2024-02", "demandQty": 120},
                        {"month": "2024-03", "demandQty": 130},
                    ],
                    "historyDemandTrend": "up",
                    "historyDemandVolatility": 0.25,
                    "gapQty": 130,
                    "coverageDays": 6.5,
                    "triggeredRules": [
                        {
                            "ruleId": "inventory_gap",
                            "label": "库存缺口",
                            "severity": "high",
                            "values": {"gapQty": 130},
                        }
                    ],
                },
            }
        ],
        report_bullets=["本次纳入 1 个重点物料。"],
    )

    row = payload["recommendations"][0]
    assert row["impactScore"] == 0.84
    assert row["impactProfile"] == "balanced"
    assert row["whyText"] == "当前库存不足以覆盖预测需求。"
    assert row["evidence"]["historyDemandTrend"] == "up"
    assert row["evidence"]["triggeredRules"] == [
        {
            "ruleId": "inventory_gap",
            "label": "库存缺口",
            "severity": "high",
            "values": {"gapQty": 130},
        }
    ]


def test_resolve_unit_cost_uses_sales_unit_price_when_purchase_price_is_missing():
    assert resolve_unit_cost(
        purchase_unit_price=0,
        fallback_sales_unit_price=12.5,
    ) == 12.5
    assert resolve_unit_cost(
        purchase_unit_price=8.25,
        fallback_sales_unit_price=12.5,
    ) == 8.25
